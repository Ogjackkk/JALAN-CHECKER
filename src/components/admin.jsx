import "/src/components/style.css";
import { Link } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { supabase } from '../supabaseClient'; // add this near top with other imports

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

const useWindowSize = () => {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return size;
};

const Admin = () => {
  const { width } = useWindowSize();
  const isMobile = width < MOBILE_BREAKPOINT;
  const isTablet = width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;

  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [parsedStudents, setParsedStudents] = useState([]); // NEW: parsed preview from Excel
  const [saving, setSaving] = useState(false); // NEW: saving flag
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10; // Number of students to show per page

  // NEW: local tab state so Approval view works without extra routes/files
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'approval' | 'settings'
  // NEW: pending keys state
  const [pendingKeys, setPendingKeys] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // NEW: track admin check
  const [isAdmin, setIsAdmin] = useState(null); // null = unknown, false = not admin, true = admin

  // Modal state for approve/decline with remarks
  const [remarksModalOpen, setRemarksModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('approve'); // 'approve' | 'decline'
  const [selectedKey, setSelectedKey] = useState(null);
  const [remarksText, setRemarksText] = useState("");

  // Add new state for preview modal
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewKey, setPreviewKey] = useState(null);

  // Add new states for history
  const [showHistory, setShowHistory] = useState(false);
  const [historyKeys, setHistoryKeys] = useState([]);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all' | 'approved' | 'declined'
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');

  // Replace existing handleStudentExcelUpload with this version
  const handleStudentExcelUpload = async (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    setBatchProcessing(true);
    setBatchMessage("");
    setParsedStudents([]);

    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];

      // Convert to JSON objects using headers from first row (common case)
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (!rows || rows.length === 0) {
        setBatchMessage("Excel file contains no rows.");
        setBatchProcessing(false);
        return;
      }

      const out = [];

      rows.forEach((row, rowIndex) => {
        // Accept either header names 'student_number' or 'student_id_number' etc.
        const rawNums = (row.student_number ?? row.student_id_number ?? row["student number"] ?? "").toString();
        const rawNames = (row.username ?? row.name ?? row["full name"] ?? "").toString();

        if (!rawNums) return; // skip if no student numbers present

        // split numbers and names by comma or semicolon, tolerate multiple on one cell
        const nums = rawNums.split(/[,;]+/).map(s => s.trim()).filter(Boolean);
        const names = rawNames.split(/[,;]+/).map(s => s.trim()).filter(Boolean);

        // If single name but many numbers, apply same name to all numbers
        // If names length matches nums length, pair by index
        // If mismatch and names empty, keep username empty
        nums.forEach((num, idx) => {
          const username = names.length === nums.length ? (names[idx] || "") :
                           (names.length === 1 ? names[0] : (names[idx] || ""));
          out.push({
            student_number: num,
            username: username,
            _sourceRow: rowIndex + 2 // helpful for debugging (excel row)
          });
        });
      });

      if (out.length === 0) {
        setBatchMessage("No valid student entries found. Ensure 'student_number' and/or 'username' columns exist.");
        setBatchProcessing(false);
        return;
      }

      setParsedStudents(out);
      setBatchMessage(`Parsed ${out.length} student entry(ies). Review and click Save to persist.`);
      // clear input so same file can be re-selected if needed
      try { event.target.value = ""; } catch (e) {}
    } catch (err) {
      console.error("Excel processing error:", err);
      setBatchMessage("Failed to process Excel file. Please ensure .xlsx/.xls and the expected format.");
    } finally {
      setBatchProcessing(false);
    }
  };

  // NEW: save parsed students to Supabase (batches of 100)
  const saveParsedStudents = async () => {
    if (!parsedStudents || parsedStudents.length === 0) {
      setBatchMessage("No parsed students to save.");
      return;
    }

    setSaving(true);
    setBatchMessage("");
    try {
      const batchSize = 100;
      let saved = 0;

      for (let i = 0; i < parsedStudents.length; i += batchSize) {
        const chunk = parsedStudents.slice(i, i + batchSize).map(s => ({
          student_number: s.student_number,
          username: s.username || null,
          created_at: new Date().toISOString()
        }));

        // upsert to avoid duplicates (use student_number unique constraint in DB)
        const { error } = await supabase
          .from('students')
          .upsert(chunk, { onConflict: 'student_number' });

        if (error) {
          console.error("Supabase upsert error:", error);
          setBatchMessage(`Failed saving: ${error.message || error.toString()}`);
          setSaving(false);
          return;
        }
        saved += chunk.length;
      }

      setBatchMessage(`Saved ${saved} student(s) successfully.`);
      // optionally clear preview
      setParsedStudents([]);
    } catch (err) {
      console.error("saveParsedStudents error:", err);
      setBatchMessage("Failed to save students. See console for details.");
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = parsedStudents.filter(student => 
    student.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  // Fetch pending answer keys when Approval tab active
  const fetchPending = async () => {
    setLoadingPending(true);
    try {
      // First get pending answer keys
      const { data: keyData, error: keyError } = await supabase
        .from('answer_keys')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (keyError) {
        console.error('Failed to load pending keys', keyError);
        setPendingKeys([]);
        return;
      }

      // Then get teacher info for each key
      const teacherIds = [...new Set(keyData.map(key => key.user_id))];
      
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, username, email, teacher_id_number')
        .in('id', teacherIds);

      if (teacherError) {
        console.error('Failed to fetch teacher info', teacherError);
      }

      // Combine answer keys with teacher info
      const keysWithTeachers = keyData.map(key => {
        const teacher = teacherData?.find(t => t.id === key.user_id);
        return {
          ...key,
          teachers: teacher || {
            username: 'Unknown',
            email: 'Unknown',
            teacher_id_number: 'Unknown'
          }
        };
      });

      setPendingKeys(keysWithTeachers);
    } catch (err) {
      console.error('fetchPending error', err);
      setPendingKeys([]);
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'approval') fetchPending();
  }, [activeTab]);

  // Open remark modal
  const openRemarksModal = (mode, keyObj) => {
    setModalMode(mode);
    setSelectedKey(keyObj);
    setRemarksText(keyObj?.admin_remarks ?? '');
    setRemarksModalOpen(true);
  };

  const closeRemarksModal = () => {
    setRemarksModalOpen(false);
    setSelectedKey(null);
    setRemarksText('');
  };

  const confirmModalAction = async () => {
    if (!selectedKey) return;
    const keyId = selectedKey.id;
    const newStatus = modalMode === 'approve' ? 'approved' : 'declined';
    // require remarks for decline
    if (modalMode === 'decline' && (!remarksText || remarksText.trim() === '')) {
      alert('Please enter decline remarks.');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('answer_keys')
        .update({
          status: newStatus,
          admin_remarks: remarksText || null,
          approved_by: user?.id || null,
          approved_at: new Date().toISOString()
        })
        .eq('id', keyId);

      if (error) throw error;
      // remove from local list
      setPendingKeys(prev => prev.filter(k => k.id !== keyId));
      closeRemarksModal();
      alert(`Answer key ${newStatus}.`);
    } catch (e) {
      console.error('Confirm action failed', e);
      alert('Failed to update answer key. See console.');
    }
  };

  // Add this helper function to format answers for preview
  const formatAnswersForPreview = (answers) => {
    if (!answers) return [];
    const parsed = typeof answers === 'string' ? JSON.parse(answers) : answers;
    return Array.isArray(parsed) ? parsed : [];
  };

  // Add this state near your other useState declarations
  const [approvalSearchTerm, setApprovalSearchTerm] = useState('');

  // Add this function before the return statement
  const filteredPendingKeys = pendingKeys.filter(key => {
    const searchLower = approvalSearchTerm.toLowerCase();
    return (
      key.exam_code?.toLowerCase().includes(searchLower) ||
      key.teachers?.username?.toLowerCase().includes(searchLower) ||
      key.teachers?.teacher_id_number?.toLowerCase().includes(searchLower) ||
      key.teachers?.email?.toLowerCase().includes(searchLower)
    );
  });

  // NEW: fetch history keys
  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: keyData, error: keyError } = await supabase
        .from('answer_keys')
        .select('*')
        .in('status', ['approved', 'declined'])
        .order('approved_at', { ascending: false });

      if (keyError) {
        console.error('Failed to load history', keyError);
        setHistoryKeys([]);
        return;
      }

      // Get teacher info
      const teacherIds = [...new Set(keyData.map(key => key.user_id))];
      const { data: teacherData, error: teacherError } = await supabase
        .from('teachers')
        .select('id, username, email, teacher_id_number')
        .in('id', teacherIds);

      if (teacherError) {
        console.error('Failed to fetch teacher info', teacherError);
      }

      const keysWithTeachers = keyData.map(key => {
        const teacher = teacherData?.find(t => t.id === key.user_id);
        return {
          ...key,
          teachers: teacher || {
            username: 'Unknown',
            email: 'Unknown',
            teacher_id_number: 'Unknown'
          }
        };
      });

      setHistoryKeys(keysWithTeachers);
    } catch (err) {
      console.error('fetchHistory error', err);
      setHistoryKeys([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  // Responsive styles
  const navbarStyles = {
    width: "100%",
    height: isMobile ? "56px" : "64px",
    background: "#54b948",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: isMobile ? "0 16px" : "0 32px",
    position: "fixed",
    top: 0,
    left: 0,
    zIndex: 100,
    boxShadow: "0 2px 8px #0001",
    flexWrap: isMobile ? "wrap" : "nowrap",
  };

  const contentStyles = {
    marginTop: isMobile ? 72 : 84,
    padding: isMobile ? "16px" : "28px",
    display: "flex",
    justifyContent: "center",
  };

  const gridStyles = {
    display: "grid",
    boxSizing: "border-box",              // <-- added
    gridTemplateColumns: isMobile 
      ? "1fr" 
      : isTablet 
        ? "repeat(auto-fill,minmax(280px,1fr))" 
        : "repeat(auto-fill,minmax(320px,1fr))",
    gap: isMobile ? 8 : 12,
    width: "100%"                         // <-- ensure grid never exceeds container
  };

  // Add touch event handlers for mobile
  const touchHandlers = {
    onTouchStart: (e) => e.stopPropagation(),
    onTouchMove: (e) => e.stopPropagation(),
  };

  return (
    <>
      <nav className="top-navbar" style={navbarStyles}>
        <div style={{  
          gap: isMobile ? "12px" : "24px",
          width: isMobile ? "100%" : "auto",
          justifyContent: isMobile ? "center" : "flex-start",
          marginBottom: isMobile ? "8px" : 10
        }}>
          <span style={{ 
            color: "#fff",  
            fontWeight: "bold", 
            fontSize: isMobile ? "18px" : "22px", 
            letterSpacing: "1px" 
          }}>
          </span>
        </div>

        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          width: isMobile ? "100%" : "auto",
          justifyContent: isMobile ? "space-between" : "flex-end",
          flexWrap: isMobile ? "wrap" : "nowrap"
        }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            style={{
              background: activeTab === 'dashboard' ? "#fff" : "transparent",
              color: activeTab === 'dashboard' ? "#54b948" : "#fff",
              border: activeTab === 'dashboard' ? "1px solid rgba(0,0,0,0.06)" : "none",
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Upload Students
          </button>

          <button
            onClick={() => setActiveTab('approval')}
            style={{
              background: activeTab === 'approval' ? "#fff" : "transparent",
              color: activeTab === 'approval' ? "#54b948" : "#fff",
              border: activeTab === 'approval' ? "1px solid rgba(0,0,0,0.06)" : "none",
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            Approval
          </button>

          <button
            onClick={() => {
              setShowHistory(true);
              setActiveTab('history');
              fetchHistory();
            }}
            style={{
              background: activeTab === 'history' ? "#fff" : "transparent",
              color: activeTab === 'history' ? "#54b948" : "#fff",
              border: activeTab === 'history' ? "1px solid rgba(0,0,0,0.06)" : "none",
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            History
          </button>

          <Link
            to="/adminsetting"
            onClick={() => setActiveTab('settings')}
            style={{
              background: activeTab === 'settings' ? "#fff" : "transparent",
              color: activeTab === 'settings' ? "#54b948" : "#fff",
              border: activeTab === 'settings' ? "1px solid rgba(0,0,0,0.06)" : "none",
              padding: "6px 10px",
              borderRadius: 6,
              cursor: "pointer",
              fontWeight: 600,
              textDecoration: "none"
            }}
          >
            Settings
          </Link>
        </div>
      </nav>

      {/* Approval tab */}
      {activeTab === 'approval' ? (
        <div style={contentStyles}>
          <div style={{ width: "100%", maxWidth: 1100 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: "#2e7d32" }}>Answer Key Approvals</h2>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ position: "relative", minWidth: isMobile ? 0 : 300, flex: isMobile ? 1 : 'none' }}>
                  <input
                    type="text"
                    placeholder="Search by exam code, teacher name, ID, or email..."
                    value={approvalSearchTerm}
                    onChange={(e) => setApprovalSearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      paddingLeft: "36px",
                      borderRadius: 8,
                      border: "1px solid #e0e0e0",
                      fontSize: 14,
                      outline: "none",
                      transition: "border-color 0.2s",
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#999",
                    fontSize: 14
                  }}>
                    🔍
                  </span>
                </div>
                <button 
                  onClick={fetchPending} 
                  style={{ 
                    padding: "8px 12px", 
                    borderRadius: 8, 
                    background: "#000000ff", 
                    border: "1px solid #e6e6e6", 
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}
                >
                  <span style={{ fontSize: 14 }}>↻</span>
                  Refresh
                </button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 6px 18px rgba(0,0,0,0.04)" }}>
              {loadingPending ? (
                <div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading pending keys...</div>
              ) : isAdmin === false ? (
                <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
                  You are not an admin or admin lookup failed. Ensure your user is present in the public.admins table with id = auth.users.id and RLS policies allow admins to SELECT.
                </div>
              ) : filteredPendingKeys.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "#666" }}>
                  {approvalSearchTerm 
                    ? "No answer keys match your search." 
                    : "No pending answer keys."}
                </div>
              ) : (
                <div style={gridStyles}>
                  {filteredPendingKeys.map((k) => (
                    <div key={k.id} style={{ 
                      border: "1px solid #f0f0f0", 
                      borderRadius: 10, 
                      padding: 16,
                      background: "#fcfffb",
                      transition: 'transform 0.2s',
                      cursor: 'pointer',
                      ':hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                      }
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#155724", fontSize: 16 }}>
                            Exam Code: {k.exam_code || "Not specified"}
                          </div>
                          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
                            Teacher: {k.teachers?.username || "Unknown"}
                          </div>
                          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
                            ID Number: {k.teachers?.teacher_id_number || "Unknown"}
                          </div>
                          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
                            Email: {k.teachers?.email || "Unknown"}
                          </div>
                          <div style={{ fontSize: 13, color: "#444", marginTop: 6 }}>
                            Questions: {k.num_questions ?? "—"}
                          </div>
                          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                            Created: {k.created_at ? new Date(k.created_at).toLocaleString() : "—"}
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <button
                            onClick={() => {
                              setPreviewKey(k);
                              setShowPreviewModal(true);
                            }}
                            style={{ 
                              padding: "8px 12px",
                              background: "#f8f9fa",
                              color: "#1a1a1a",
                              border: "1px solid #dee2e6",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 13
                            }}
                          >
                            Preview
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemarksModal('approve', k);
                            }}
                            style={{ 
                              padding: "8px 12px",
                              background: "#2e7d32",
                              color: "#fff",
                              border: "none",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 13
                            }}
                          >
                            Approve
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openRemarksModal('decline', k);
                            }}
                            style={{ 
                              padding: "8px 12px",
                              background: "#fff",
                              color: "#b71c1c",
                              border: "1px solid #f2c8c8",
                              borderRadius: 8,
                              cursor: "pointer",
                              fontSize: 13
                            }}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'history' ? (
        // History tab
        <div style={contentStyles}>
          <div style={{ width: "100%", maxWidth: 1200 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: "#2e7d32" }}>Answer Key History</h2>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8, background: "#f8f9fa", padding: 4, borderRadius: 8 }}>
                  {['all', 'approved', 'declined'].map(filter => (
                    <button
                      key={filter}
                      onClick={() => setHistoryFilter(filter)}
                      style={{
                        padding: "6px 12px",
                        background: historyFilter === filter ? "#fff" : "transparent",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontSize: 14,
                        color: historyFilter === filter ? "#2e7d32" : "#666",
                        boxShadow: historyFilter === filter ? "0 2px 4px rgba(0,0,0,0.05)" : "none"
                      }}
                    >
                      {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                  ))}
                </div>
                <div style={{ position: "relative", minWidth: isMobile ? 0 : 300, flex: isMobile ? 1 : 'none' }}>
                  <input
                    type="text"
                    placeholder="Search history..."
                    value={historySearchTerm}
                    onChange={(e) => setHistorySearchTerm(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      paddingLeft: "36px",
                      borderRadius: 8,
                      border: "1px solid #e0e0e0",
                      fontSize: 14
                    }}
                  />
                  <span style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#999",
                    fontSize: 14
                  }}>
                    🔍
                  </span>
                </div>
                <button onClick={fetchHistory} style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e6e6e6", cursor: "pointer" }}>
                  <span style={{ fontSize: 14 }}>↻</span>
                </button>
              </div>
            </div>

            <div style={{ background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 6px 18px rgba(0,0,0,0.04)" }}>
              {loadingHistory ? (
                <div style={{ padding: 24, textAlign: "center", color: "#666" }}>Loading history...</div>
              ) : historyKeys
                .filter(k => historyFilter === 'all' || k.status === historyFilter)
                .filter(k => 
                  historySearchTerm === '' ||
                  k.exam_code?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                  k.teachers?.username?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                   k.teachers?.teacher_id_number?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                  k.teachers?.email?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
                  k.admin_remarks?.toLowerCase().includes(historySearchTerm.toLowerCase())
                )
                .map(k => (
                  <div
                    key={k.id}
                    style={{
                      borderBottom: "1px solid #f0f0f0",
                      padding: "16px 0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 20
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          padding: "4px 12px",
                          borderRadius: "999px",
                          fontSize: 12,
                          fontWeight: 600,
                          background: k.status === 'approved' ? "#e8f5e9" : "#ffebee",
                          color: k.status === 'approved' ? "#2e7d32" : "#c62828"
                        }}>
                          {k.status.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a" }}>
                          {k.exam_code}
                        </div>
                      </div>
                      <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                        Teacher: {k.teachers?.username} ({k.teachers?.teacher_id_number})
                      </div>
                      <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                        Questions: {k.num_questions}
                      </div>
                      {k.admin_remarks && (
                        <div style={{ fontSize: 14, color: "#666", marginTop: 8, fontStyle: "italic" }}>
                          "{k.admin_remarks}"
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#999", whiteSpace: "nowrap" }}>
                      {k.approved_at ? new Date(k.approved_at).toLocaleString() : "—"}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      ) : (
        // ...existing dashboard JSX...
        <>
          {/* Existing dashboard content starts here */}
          <div style={{
            marginTop: 84,
            padding: "20px 12px",
            display: "flex",
            justifyContent: "center",
            background: "transparent"
          }}>
            <div style={{
              width: "100%",
              maxWidth: 640,
              textAlign: "center",
              background: "#fff",
              padding: "18px",
              borderRadius: "12px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.04)"
            }}>
              <h3 style={{
                margin: "0 0 12px",
                fontSize: "18px",
                fontWeight: 700,
                color: "#2e7d32"
              }}>
                Batch Upload Students
              </h3>

              <div style={{
                border: "1.5px dashed #e6e6e6",
                borderRadius: "10px",
                padding: "16px",
                marginBottom: "14px",
                background: "#fafafa",
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <img src="/src/img/excel.png" alt="Excel" style={{ width: 36, opacity: batchProcessing ? 0.6 : 1 }} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ fontSize: 13, color: "#444" }}>Upload Excel (.xlsx/.xls)</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>Columns: student_number, username</div>
                  </div>
                </div>

                <label style={{
                  background: batchProcessing ? "#e0e0e0" : "#54b948",
                  color: "#fff",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: batchProcessing ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600
                }}>
                  {batchProcessing ? "Processing..." : "Choose File"}
                  <input type="file" accept=".xlsx,.xls" onChange={handleStudentExcelUpload} disabled={batchProcessing} style={{ display: "none" }} />
                </label>
              </div>

              {batchMessage && (
                <div style={{
                  marginTop: 8,
                  padding: "10px",
                  borderRadius: 8,
                  background: batchMessage.toLowerCase().includes("success") ? "#f1f8e9" : "#fff3f3",
                  color: batchMessage.toLowerCase().includes("success") ? "#2e7d32" : "#c62828",
                  fontSize: 13
                }}>
                  {batchMessage}
                </div>
              )}
            </div>
          </div>

          {/* BEGIN: parsed preview UI */}
          {parsedStudents && parsedStudents.length > 0 && (
            <div style={{ marginTop: 18, textAlign: 'center' }}>
              <div style={{ maxWidth: 920, margin: '0 auto', background: '#fff', borderRadius: 10, padding: 12, boxShadow: '0 6px 18px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontWeight: 700 }}>{parsedStudents.length} entries parsed</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => { setParsedStudents([]); setBatchMessage('Preview cleared'); }}
                      style={{ padding: '8px 12px' }}
                      disabled={saving}
                    >
                      Clear Preview
                    </button>
                    <button
                      onClick={saveParsedStudents}
                      style={{ padding: '8px 12px', background: '#54b948', color: '#fff', border: 'none', borderRadius: 6 }}
                      disabled={saving}
                    >
                      {saving ? 'Saving...' : 'Save to Database'}
                    </button>
                  </div>
                </div>

                {/* Search Bar */}
                <div style={{ marginBottom: 16, padding: '0 4px' }}>
                  <input
                    type="text"
                    placeholder="Search by student number or username..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1); // Reset to first page when searching
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: '1px solid #ddd',
                      fontSize: 14
                    }}
                  />
                </div>

                <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #f3f3f3' }}>
                        <th style={{ padding: '8px 6px' }}>#</th>
                        <th style={{ padding: '8px 6px' }}>Student Number</th>
                        <th style={{ padding: '8px 6px' }}>Username</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentStudents.map((s, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #fafafa' }}>
                          <td style={{ padding: '6px' }}>{indexOfFirstStudent + idx + 1}</td>
                          <td style={{ padding: '6px' }}>{s.student_number}</td>
                          <td style={{ padding: '6px' }}>{s.username}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '16px',
                    padding: '8px'
                  }}>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #ddd',
                        background: currentPage === 1 ? '#f5f5f5' : '#fff',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                      }}
                    >
                      &lt;
                    </button>

                    {[...Array(totalPages)].map((_, idx) => {
                      const pageNum = idx + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            onClick={() => setCurrentPage(pageNum)}
                            style={{
                              padding: '4px 8px',
                              borderRadius: 4,
                              border: '1px solid #ddd',
                              background: currentPage === pageNum ? '#54b948' : '#fff',
                              color: currentPage === pageNum ? '#fff' : '#000',
                              cursor: 'pointer'
                            }}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === currentPage - 2 ||
                        pageNum === currentPage + 2
                      ) {
                        return <span key={pageNum}>...</span>;
                      }
                      return null;
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid #ddd',
                        background: currentPage === totalPages ? '#f5f5f5' : '#fff',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                      }}
                    >
                      &gt;
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* END: parsed preview UI */}
        </>
      )}

      {/* Remarks modal */}
      {remarksModalOpen && (
        <div style={{
          position: "fixed",
          left: 0, top: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: isMobile ? "flex-end" : "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{ 
            width: isMobile ? "100%" : "min(720px,95%)",
            background: "#fff",
            borderRadius: isMobile ? "12px 12px 0 0" : "12px",
            padding: isMobile ? "16px" : "24px",
            maxHeight: isMobile ? "90vh" : "none",
            overflow: "auto",
            boxShadow: "0 12px 36px rgba(0,0,0,0.3)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>{modalMode === 'approve' ? 'Approve Answer Key' : 'Decline Answer Key'}</h3>
              <button
                onClick={closeRemarksModal}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#666",
                  padding: "0 4px"
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 13, display: "block", marginBottom: 6 }}>Remarks {modalMode === 'decline' ? '(required for decline)' : '(optional)'}</label>
              <textarea
                value={remarksText}
                onChange={(e) => setRemarksText(e.target.value)}
                rows={4}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e6e6e6", fontSize: 14 }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={closeRemarksModal} style={{ padding: "8px 12px", borderRadius: 8, background: "#fff", border: "1px solid #e6e6e6" }}>Cancel</button>
              <button onClick={confirmModalAction} style={{ padding: "8px 12px", borderRadius: 8, background: modalMode === 'approve' ? "#2e7d32" : "#b71c1c", color: "#fff", border: "none" }}>
                {modalMode === 'approve' ? 'Confirm Approve' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewKey && (
        <div style={{
          position: "fixed",
          left: 0, top: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999
        }}>
          <div style={{ 
            width: "min(800px,95%)",
            background: "#fff",
            borderRadius: 12,
            padding: 24,
            maxHeight: "90vh",
            overflow: "auto",
            boxShadow: "0 12px 36px rgba(0,0,0,0.3)"
          }}>
            <div style={{ 
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20
            }}>
              <h3 style={{ margin: 0, color: "#2e7d32" }}>Answer Key Preview</h3>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "#666"
                }}
              >
                ×
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                Exam Code: {previewKey.exam_code || "Not specified"}
              </div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                Teacher: {previewKey.teachers?.username || "Unknown"}
              </div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                ID Number: {previewKey.teachers?.teacher_id_number || "Unknown"}
              </div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                Email: {previewKey.teachers?.email || "Unknown"}
              </div>
              <div style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
                Total Questions: {previewKey.num_questions}
              </div>
              <div style={{ fontSize: 14, color: "#666" }}>
                Created: {previewKey.created_at ? new Date(previewKey.created_at).toLocaleString() : "—"}
              </div>
            </div>

            <div style={{ 
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))",
              gap: 12,
              padding: "20px",
              background: "#f8f9fa",
              borderRadius: 8
            }}>
              {formatAnswersForPreview(previewKey.answers).map((answer, idx) => (
                <div key={idx} style={{
                  padding: "12px",
                  background: "#fff",
                  borderRadius: 6,
                  textAlign: "center",
                  border: "1px solid #dee2e6",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
                }}>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Q{idx + 1}</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "#2e7d32" }}>{answer}</div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowPreviewModal(false)}
                style={{
                  padding: "8px 16px",
                  background: "#f8f9fa",
                  border: "1px solid #dee2e6",
                  borderRadius: 8,
                  cursor: "pointer"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Admin;