import "/src/components/style.css";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { FaCopy, FaEdit, FaTrash, FaCheckCircle } from "react-icons/fa";

const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const terms = ["1st Term", "2nd Term"];

const AnswerSheet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [answerKeys, setAnswerKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setLoading(false);
        return;
      }

      // fetch user's answer keys including status/admin remarks
      const { data, error } = await supabase
        .from("answer_keys")
        .select("*")
        .eq("user_id", user.id)
        .order('created_at', { ascending: false });

      if (!error) setAnswerKeys(data || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  // Helper for navigation with refresh
  const navigateWithRefresh = (path, state = {}) => {
    navigate(path, { state });
    // REMOVE the reload! It breaks state passing.
    // setTimeout(() => {
    //   window.location.reload();
    // }, 200);
  };

  const handleEdit = (id) => {
    // Just navigate, do not reload
    navigate("/answerKey", { state: { answerKeyId: id } });
  };

  // Delete confirmation modal
  const handleDelete = async (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from("answer_keys")
      .delete()
      .eq("id", deleteId);
    if (!error) {
      setAnswerKeys((prev) => prev.filter((key) => key.id !== deleteId));
    }
    setShowDeleteModal(false);
    setDeleteId(null);
  };

  // Format answer key
  const formatAnswerKey = (answers) => {
    try {
      const parsed = JSON.parse(answers);
      if (Array.isArray(parsed)) {
        return parsed.join(", ");
      }
      return answers;
    } catch (err) {
      return answers;
    }
  };

  // Copy answer key to clipboard
  const handleCopyAnswers = (answers) => {
    const answerString = formatAnswerKey(answers);
    navigator.clipboard.writeText(answerString);
    alert("Answer key copied to clipboard!");
  };

  const filteredKeys = answerKeys.filter((key) =>
    key.exam_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close delete modal when location changes OR when component unmounts
  useEffect(() => {
    setShowDeleteModal(false);
    return () => {
      setShowDeleteModal(false);
    };
  }, [location.pathname]);

  return (
    <div className="dashboard-container">
      {/* TOP NAVBAR copied from answerKey.jsx */}
      <style dangerouslySetInnerHTML={{ __html: `
        /* small, non-intrusive navbar helpers for mobile */
        .nav-hamburger { display: none; background: transparent; border: none; padding: 6px; cursor: pointer; }
        .nav-hamburger .bar { display:block; width:18px; height:2px; background:#fff; margin:3px 0; border-radius:2px; }

        /* Mobile menu drawer styles (match GradeReport look) */
        .mobile-menu-overlay { position: fixed; inset: 0; z-index: 6000; background: rgba(0,0,0,0.35); display:flex; justify-content:flex-end; }
        .mobile-menu { width: 84%; max-width: 360px; background:#fff; height:100%; padding:20px; box-sizing:border-box; overflow:auto; }
        .mobile-menu .menu-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; font-weight:800; }
        .mobile-menu .mobile-link { display:block; padding:12px 8px; color:#222; text-decoration:none; font-weight:600; border-bottom:1px solid #f1f1f1; }
        .mobile-menu .mobile-link:last-child { border-bottom: none; }

        @media (max-width: 760px) {
          .top-navbar .nav-right { display: none !important; }
          .nav-hamburger { display: inline-block !important; }
          /* ensure no horizontal overflow */
          html, body, #root, .dashboard-container, .main-content { max-width:100% !important; overflow-x:hidden !important; }
        }
      `}} />
      <nav
        className="top-navbar"
        style={{
          width: "100%",
          height: "64px",
          background: "#54b948", // Green
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 32px",
          position: "fixed",
          top: 0,
          left: 0,
          zIndex: 100,
          boxShadow: "0 2px 8px #0001",
        }}
      >
        <div className="nav-left" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            to="/home"
            onClick={e => {
              e.preventDefault();
              navigateWithRefresh("/home");
            }}
            aria-label="Home"
          >
            <img src="/src/img/house.png" alt="Back" style={{ width: "32px", marginRight: "12px", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: "22px", letterSpacing: "1px" }}>
            ANSWER SHEET
          </span>
        </div>

        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link
            to="/answerKey"
            onClick={e => {
              e.preventDefault();
              navigateWithRefresh("/answerKey");
            }}
            className=""
            style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}
          >
            <img src="/src/img/AnswerKeys.png" alt="Answer Key" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Answer Key
          </Link>
          <Link
            to="/answerSheet"
            onClick={e => {
              e.preventDefault();
              navigateWithRefresh("/answerSheet");
            }}
            className="active"
            style={{ color: "#fff", textDecoration: "underline", fontWeight: 700 }}
          >
            <img src="/src/img/Sheet.png" alt="Answer Sheet" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Answer Sheet
          </Link>
          <Link
            to="/gradeReport"
            onClick={e => {
              e.preventDefault();
              navigateWithRefresh("/gradeReport");
            }}
            style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}
          >
            <img src="/src/img/ReportGrade.png" alt="Grade Report" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Exam
          </Link>
        </div>

        {/* Mobile hamburger (keeps same visual style on desktop) */}
        <button
          className="nav-hamburger"
          aria-label="Open menu"
          onClick={() => setMobileMenuOpen(true)}
          style={{ background: "transparent", border: "none" }}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
      </nav>

      {/* Mobile menu drawer (appears only on small screens) */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(0,0,0,0.35)', display: 'flex', justifyContent: 'flex-end' }}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()} style={{ width: '84%', maxWidth: 360, background: '#fff', height: '100%', padding: 20, boxSizing: 'border-box', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Menu</div>
              <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 20 }}>✕</button>
            </div>
            <Link
              to="/answerKey"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigateWithRefresh('/answerKey'); }}
              className="mobile-link"
            >
              Answer Key
            </Link>
            <Link
              to="/answerSheet"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigateWithRefresh('/answerSheet'); }}
              className="mobile-link"
            >
              Answer Sheet
            </Link>
            <Link
              to="/gradeReport"
              onClick={(e) => { e.preventDefault(); setMobileMenuOpen(false); navigateWithRefresh('/gradeReport'); }}
              className="mobile-link"
            >
              Exam
            </Link>
          </div>
        </div>
      )}
      {/* MAIN CONTENT */}
      <div className="main-content" style={{ marginTop: "84px" }}>
        <div className="search-bar" style={{ marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search by exam code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px",
              fontSize: "16px",
              border: "1px solid #ccc",
              borderRadius: "5px",
            }}
          />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", marginTop: "40px" }}>
            <div className="spinner" style={{
              width: "40px",
              height: "40px",
              border: "4px solid #eee",
              borderTop: "4px solid #1976d2",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "auto"
            }} />
            <p>Loading...</p>
          </div>
        ) : filteredKeys.length === 0 ? (
          <p>No answer keys found for your account.</p>
        ) : (
          <div style={{ display: "grid", gap: "20px" }}>
            {filteredKeys.map((key) => {
              // Improved question count logic
              let numQuestions = 0;
              try {
                if (Array.isArray(key.answers)) {
                  numQuestions = key.answers.length;
                } else if (typeof key.answers === "string") {
                  // Try to parse as JSON array first
                  try {
                    const arr = JSON.parse(key.answers);
                    if (Array.isArray(arr)) {
                      numQuestions = arr.length;
                    } else if (/^[A-Za-z]+$/.test(key.answers.trim())) {
                      // If it's a plain string of letters (e.g., "BBCDCBABCC...")
                      numQuestions = key.answers.trim().length;
                    }
                  } catch {
                    // If not JSON, check if it's a plain string of letters
                    if (/^[A-Za-z]+$/.test(key.answers.trim())) {
                      numQuestions = key.answers.trim().length;
                    }
                  }
                }
              } catch {}
              return (
                <div key={key.id} className="answer-key-card" style={{
                  background: "#fff",
                  borderRadius: "12px",
                  boxShadow: "0 2px 12px #0001",
                  padding: "20px",
                  position: "relative",
                  transition: "box-shadow 0.2s",
                  border: "1px solid #eee"
                }}>
                  <div style={{ position: "absolute", top: "18px", right: "18px" }}>
                    <span style={{
                      background: "#1976d2",
                      color: "#fff",
                      borderRadius: "20px",
                      padding: "4px 12px",
                      fontSize: "13px",
                      fontWeight: "bold"
                    }}>
                      {numQuestions} Questions
                    </span>
                  </div>
                  <h2 style={{ marginBottom: "8px" }}>
                    <FaCheckCircle style={{ color: "#81c784", marginRight: "8px" }} />
                    {key.exam_code}
                  </h2>

                  {/* NEW: status badge + admin remarks */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <div style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 12,
                      fontWeight: 700,
                      color: key.status === 'approved' ? '#155724' : key.status === 'declined' ? '#721c24' : '#856404',
                      background: key.status === 'approved' ? '#d4edda' : key.status === 'declined' ? '#f8d7da' : '#fff3cd'
                    }}>
                      { (key.status || 'pending').toUpperCase() }
                    </div>
                    {key.admin_remarks && (
                      <div style={{ fontSize: 13, color: '#666' }}>
                        Remarks: {key.admin_remarks}
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: "8px" }}>
                    <strong>Answer Key:</strong> <span style={{ color: "#1976d2" }}>{formatAnswerKey(key.answers)}</span>
                  </div>
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button
                      onClick={() => handleEdit(key.id)}
                      disabled={key.status !== 'approved' && key.status !== 'pending'}
                      style={{
                        background: "#e3f2fd",
                        border: "none",
                        color: "#1976d2",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        cursor: key.status === 'approved' ? 'pointer' : 'not-allowed',
                        display: "flex",
                        alignItems: "center"
                      }}
                      title="Edit Answer Key"
                    >
                      <FaEdit style={{ marginRight: "6px" }} /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(key.id)}
                      style={{
                        background: "#ffebee",
                        border: "none",
                        color: "#c62828",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center"
                      }}
                      title="Delete Answer Key"
                    >
                      <FaTrash style={{ marginRight: "6px" }} /> Delete
                    </button>
                    <button
                      onClick={() => handleCopyAnswers(key.answers)}
                      style={{
                        background: "#fffde7",
                        border: "none",
                        color: "#fbc02d",
                        borderRadius: "6px",
                        padding: "8px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center"
                      }}
                      title="Copy Answer Key"
                    >
                      <FaCopy style={{ marginRight: "6px" }} /> Copy Key
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            background: "#fff",
            padding: "24px",
            borderRadius: "10px",
            minWidth: "320px",
            textAlign: "center"
          }}>
            <h3>Delete Answer Key?</h3>
            <p>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "18px" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                style={{
                  background: "#e3f2fd",
                  border: "none",
                  color: "#1976d2",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{
                  background: "#ffebee",
                  border: "none",
                  color: "#c62828",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  cursor: "pointer"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner animation CSS */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg);}
            100% { transform: rotate(360deg);}
          }
          .answer-key-card:hover {
            box-shadow: 0 4px 24px #1976d233;
            border: 1px solid #1976d2;
          }
        `}
      </style>
    </div>
  );
};

export default AnswerSheet;
