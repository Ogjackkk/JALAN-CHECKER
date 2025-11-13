import "/src/components/style.css";
import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { PDFDocument } from 'pdf-lib';
import { supabase } from '../supabaseClient';
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, pdf } from '@react-pdf/renderer';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const GradeReport = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [showExamCodeModal, setShowExamCodeModal] = useState(false);
  const [examCodeInput, setExamCodeInput] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [examCodes, setExamCodes] = useState([]);
  const [scannedSearch, setScannedSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedExamCode, setSelectedExamCode] = useState(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [modalStep, setModalStep] = useState('enter'); // 'enter' | 'upload' | 'processing' | 'done'
const [showAnalysisModal, setShowAnalysisModal] = useState(false);
const [showDifficultyModal, setShowDifficultyModal] = useState(false);
const [showArchiveModal, setShowArchiveModal] = useState(false);
const [archivedExamCodes, setArchivedExamCodes] = useState([]);
const [archiveLoading, setArchiveLoading] = useState(false);
const [archiveSearch, setArchiveSearch] = useState('');
const [deleteMode, setDeleteMode] = useState(false);
const [selectedForDelete, setSelectedForDelete] = useState([]);

const handleConfirmDelete = async () => {
  if (selectedForDelete.length === 0) return;
  if (!window.confirm(`Delete ${selectedForDelete.length} scanned student(s)? This cannot be undone.`)) return;
  try {
    const { error } = await supabase
      .from('scan_results')
      .delete()
      .in('id', selectedForDelete);
    if (error) throw error;
    setExamResults((prev) => prev.filter((r) => !selectedForDelete.includes(r.id)));
    setStatusMsg('Deleted selected students.');
    setSelectedForDelete([]);
    setDeleteMode(false);
    fetchScannedCounts();
  } catch (e) {
    setError('Failed to delete: ' + (e.message || e.toString()));
  }
};

const cancelDeleteMode = () => {
  setDeleteMode(false);
  setSelectedForDelete([]);
};

const toggleSelectStudent = (id) => {
  setSelectedForDelete((prev) =>
    prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
  );
};

// Fetch archived exams
const fetchArchivedExamCodes = async () => {
  setArchiveLoading(true);
  try {
    const { data, error } = await supabase
      .from('answer_keys')
      .select('*')
      .eq('archived', true)
      .order('created_at', { ascending: false });
    if (error) throw error;
    setArchivedExamCodes(data || []);
  } catch (e) {
    setError('Failed to load archived exams: ' + (e.message || e.toString()));
  } finally {
    setArchiveLoading(false);
  }
};

// Archive an exam
const archiveExam = async (exam) => {
  if (!window.confirm("Are you sure you want to archive this exam result? Have you already finalized it and have nothing else to change?")) return;
  try {
    const { error } = await supabase
      .from('answer_keys')
      .update({ archived: true, archived_at: new Date().toISOString() })
      .eq('id', exam.id);
    if (error) throw error;
    setStatusMsg('Exam archived.');
    fetchExamCodes();
    fetchArchivedExamCodes();
  } catch (e) {
    setError('Failed to archive: ' + (e.message || e.toString()));
  }
};

// Restore an archived exam
const restoreExam = async (exam) => {
  try {
    const { error } = await supabase
      .from('answer_keys')
      .update({ archived: false, archived_at: null })
      .eq('id', exam.id);
    if (error) throw error;
    setStatusMsg('Exam restored.');
    fetchExamCodes();
    fetchArchivedExamCodes();
  } catch (e) {
    setError('Failed to restore: ' + (e.message || e.toString()));
  }
};

  // NEW: scanned counts and exam results view
  const [scannedCounts, setScannedCounts] = useState({}); // map answer_key_id -> count
  const [showExamResultsModal, setShowExamResultsModal] = useState(false);
  const [examResults, setExamResults] = useState([]);
  const [examResultsLoading, setExamResultsLoading] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');

  // per-row saving state for edits
  const [editingSaving, setEditingSaving] = useState({});

  // update local examResults when input changes (optimistic)
  const onStudentNumberChange = (index, value) => {
    setExamResults(prev => {
      const copy = Array.isArray(prev) ? [...prev] : [];
      const item = copy[index] ? { ...copy[index] } : null;
      if (!item) return prev;
      item.student_number = value;
      item.name = value; // optimistic display
      copy[index] = item;
      return copy;
    });
  };

  // Enter key saves edited student number
  const onStudentNumberKeyDown = (e, index) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveStudentNumber(index);
    }
  };

  // Persist the edited student_number, lookup username and update scan_results
  const saveStudentNumber = async (index) => {
    const item = (examResults || [])[index];
    if (!item) return;
    const scanId = item.id;
    const newStudentNumber = (item.student_number || '').toString().trim();
    if (!newStudentNumber) {
      setError('Student number cannot be empty.');
      return;
    }

    setEditingSaving(prev => ({ ...prev, [scanId]: true }));
    setError('');
    try {
      // lookup username in students table
      const studentInfo = await lookupStudentInfo(newStudentNumber);
      const username = studentInfo?.username ?? null;

      // update scan_results record
      const { error: updErr } = await supabase
        .from('scan_results')
        .update({ student_number: newStudentNumber, username })
        .eq('id', scanId);

      if (updErr) throw updErr;

      // update local state
      setExamResults(prev => {
        const copy = Array.isArray(prev) ? [...prev] : [];
        const existing = copy[index] ? { ...copy[index] } : null;
        if (!existing) return prev;
        existing.student_number = newStudentNumber;
        existing.username = username;
        existing.name = username || newStudentNumber;
        copy[index] = existing;
        return copy;
      });

      setStatusMsg(`Saved ${newStudentNumber}${username ? ' → ' + username : ''}`);
      // refresh counts
      fetchScannedCounts();
    } catch (e) {
      console.error('Failed to save student_number edit', e);
      setError('Failed to save student number: ' + (e.message || e.toString()));
    } finally {
      setEditingSaving(prev => ({ ...prev, [scanId]: false }));
    }
  };

  // NEW: student analysis modal
  const [showStudentAnalysisModal, setShowStudentAnalysisModal] = useState(false);
  const [analysisStudent, setAnalysisStudent] = useState(null);
  const [analysisImage, setAnalysisImage] = useState(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const imgRef = useRef(null);

  // editable student id in analysis modal
  const [analysisStudentNumber, setAnalysisStudentNumber] = useState('');

  // sync input when analysisStudent changes
  useEffect(() => {
    setAnalysisStudentNumber(analysisStudent?.student_number ?? '');
  }, [analysisStudent]);

  // Prevent background scroll when any modal is open (mobile-friendly)
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (showExamCodeModal || showExamResultsModal || showStudentAnalysisModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, [showExamCodeModal, showExamResultsModal, showStudentAnalysisModal]);

  // Ensure no horizontal scrolling site-wide (avoid sideward scroll on small screens)
  useEffect(() => {
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    const prevBodyOverflowX = document.body.style.overflowX;
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.documentElement.style.overflowX = prevHtmlOverflowX || '';
      document.body.style.overflowX = prevBodyOverflowX || '';
    };
  }, []);
  
  // save edited student number from analysis modal
  const saveAnalysisStudentNumber = async () => {
    if (!analysisStudent) return;
    const scanId = analysisStudent.id;
    const newNumber = (analysisStudentNumber || '').toString().trim();

    if (!newNumber) {
      setError('Student number cannot be empty.');
      return;
    }

    setEditingSaving(prev => ({ ...prev, [scanId]: true }));
    setError('');

    try {
      // 1) Try to fetch existing student by number
      const { data: existingStudent, error: fetchErr } = await supabase
        .from('students')
        .select('student_number, username')
        .eq('student_number', newNumber)
        .maybeSingle();
      if (fetchErr) throw fetchErr;

      let student = existingStudent;

      // 2) If not found, create a minimal student record (so FK is satisfied)
      if (!student) {
        const { data: created, error: createErr } = await supabase
          .from('students')
          .insert({ student_number: newNumber }, { returning: 'representation' })
          .select('student_number, username')
          .maybeSingle();
        if (createErr) throw createErr;
        student = created;
      }

      if (!student) throw new Error('Failed to ensure student record exists.');

      // 3) Update scan_results with the canonical student_number and username from students table
      const { error: updateErr } = await supabase
        .from('scan_results')
        .update({
          student_number: student.student_number,
          username: student.username ?? null
        })
        .eq('id', scanId)
        .select();
      if (updateErr) throw updateErr;

      // 4) Update local UI state after a successful DB update
      const updatedStudent = {
        ...analysisStudent,
        student_number: student.student_number,
        username: student.username ?? null,
        name: student.username || student.student_number
      };
      setAnalysisStudent(updatedStudent);
      setExamResults(prev => Array.isArray(prev) ? prev.map(r => r.id === scanId ? updatedStudent : r) : prev);

      setStatusMsg(`Saved ${student.student_number}${student.username ? ' → ' + student.username : ''}`);

      // 5) Refresh list to guarantee consistency
      if (selectedExamCode?.id) {
        await viewExamResults(selectedExamCode);
      }
    } catch (e) {
      console.error('Failed to save student_number edit:', e);
      setError('Failed to save: ' + (e.message || e.toString()));
    } finally {
      setEditingSaving(prev => ({ ...prev, [scanId]: false }));
    }
  };

  const onAnalysisStudentKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveAnalysisStudentNumber();
    }
  };

  // Fetch exam codes when component mounts
  useEffect(() => {
    fetchExamCodes();
  }, []);

  // When examCodes change, update scanned counts
  useEffect(() => {
    if (examCodes.length) fetchScannedCounts();
  }, [examCodes]);

  const fetchExamCodes = async () => {
    // Only approved and NOT archived answer keys are available for scanning
    const { data, error } = await supabase
      .from('answer_keys')
      .select('*')
      .eq('status', 'approved')
      .eq('archived', false) // <-- Only show NOT archived
      .order('created_at', { ascending: false });

    console.log('fetchExamCodes result:', { data, error });

    if (error) {
      setError('Failed to load exam codes: ' + (error.message || error.toString()));
      setExamCodes([]);
      return;
    }

    // Normalize rows so UI always has exam_code
    const normalized = (data || []).map(row => {
      return {
        ...row,
        exam_code: row.exam_code || row.code || row.examCode || row.name || '' // common alternatives
      };
    });

    // If nothing has exam_code, keep raw data visible for debug
    setExamCodes(normalized);
  };

  // NEW: fetch counts per exam (groups client-side for simplicity)
  const fetchScannedCounts = async () => {
    try {
      const { data } = await supabase
        .from('scan_results')
        .select('answer_key_id'); // fetch all rows (keep small)
      const counts = {};
      (data || []).forEach(r => {
        counts[r.answer_key_id] = (counts[r.answer_key_id] || 0) + 1;
      });
      setScannedCounts(counts);
    } catch (e) {
      console.error('Failed to fetch scanned counts', e);
    }
  };

  const handleScanExam = () => {
    console.log('Scan Exam clicked');
    // open modal that asks teacher to input exam code
    setExamCodeInput('');
    setError('');
    setShowExamCodeModal(true);
    setSearchQuery('');
    setModalStep('enter');
  };

  // verify exam code input by teacher and load answer key
  const verifyExamCode = async () => {
    if (!examCodeInput || !examCodeInput.trim()) {
      setError('Please enter an exam code');
      return;
    }
    setVerifying(true);
    setError('');
    try {
      const { data: answerKey, error: keyError } = await supabase
        .from('answer_keys')
        .select('*')
        .eq('exam_code', examCodeInput.trim())
        .maybeSingle();

      if (keyError) throw keyError;
      if (!answerKey) {
        setError('Exam code not found. Please check and try again.');
        return;
      }

      setSelectedExamCode(answerKey);
      // keep modal open and move to upload step
      setModalStep('upload');
    } catch (e) {
      console.error('verifyExamCode error', e);
      setError(e.message || 'Failed to verify exam code');
    } finally {
      setVerifying(false);
    }
  };
  
  const handleExamCodeSelect = (examCode) => {
    setSelectedExamCode(examCode);
    setShowExamCodeModal(true);
    setModalStep('upload');
  };

  // NEW: view existing scanned results for an exam code (includes student name resolution)
  const viewExamResults = async (exam) => {
    setExamResultsLoading(true);
    setShowExamResultsModal(true);
    setExamResults([]);
    setSelectedExamCode(exam); // Make sure we set the selected exam code
    
    try {
      const { data: scanData, error: scanError } = await supabase
        .from('scan_results')
        .select(`
          id,
          student_number,
          username,
          answers,
          score,
          total_questions,
          created_at
        `)
        .eq('answer_key_id', exam.id)
        .order('created_at', { ascending: false });

      if (scanError) throw scanError;

      // Get all unique student numbers
      const studentNumbers = [...new Set(scanData.map(r => r.student_number))];

      // Fetch current usernames for all students
      const { data: studentData } = await supabase
        .from('students')
        .select('student_number, username')
        .in('student_number', studentNumbers);

      // Create lookup map
      const studentMap = {};
      (studentData || []).forEach(s => {
        if (s.student_number) studentMap[s.student_number] = s;
      });

      // Merge data and ensure answers are properly parsed
      const merged = (scanData || []).map(r => {
        const studentInfo = studentMap[r.student_number] || {};
        let parsedAnswers;
        try {
          parsedAnswers = Array.isArray(r.answers) ? r.answers : JSON.parse(r.answers || '[]');
        } catch (e) {
          console.error('Failed to parse answers for student:', r.student_number);
          parsedAnswers = [];
        }

        return {
          ...r,
          answers: parsedAnswers,
          username: studentInfo.username || r.username,
          name: studentInfo.username || r.username || r.student_number || 'Unknown'
        };
      });

      setExamResults(merged);
    } catch (e) {
      console.error('Failed to load exam results:', e);
      setError('Failed to load exam results: ' + (e.message || e.toString()));
    } finally {
      setExamResultsLoading(false);
    }
  };

  const processOMR = async (answersInOrder, pdfFile) => {
    try {
      // 1. Fetch JSON files from public folder
      const [configRes, templateRes] = await Promise.all([
        fetch('/config.json'),
        fetch('/template.json')
      ]);

      const configJson = await configRes.json();
      const templateJson = await templateRes.json();

      // 2. If you want, inject answers into evaluation JSON
      const evaluationJson = {
        source_type: "custom",
        options: {
          questions_in_order: answersInOrder.map((_, i) => `q${i+1}`),
          answers_in_order: answersInOrder
        },
        marking_schemes: {
          DEFAULT: { correct: "1", incorrect: "0", unmarked: "0" }
        }
      };

      // 3. Fetch OMR marker image from public folder as Blob
      const markerRes = await fetch('/omr_marker.jpg');
      const markerBlob = await markerRes.blob();

      // 4. Prepare FormData
      const formData = new FormData();
      formData.append("config", new Blob([JSON.stringify(configJson)], { type: "application/json" }));
      formData.append("template", new Blob([JSON.stringify(templateJson)], { type: "application/json" }));
      formData.append("evaluation", new Blob([JSON.stringify(evaluationJson)], { type: "application/json" }));
      formData.append("omr_marker", markerBlob);
      formData.append("pdf_file", pdfFile);

      // 5. Send to API
      const response = await fetch('https://sairusses-jalan-api.hf.space/process-omr', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OMR API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.error("OMR processing failed:", err);
      return null;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Please select a valid PDF file');
      return;
    }

    setProcessing(true);
    setModalStep('processing');
    setError('');

    try {
      // Fetch the answer key data
      const { data: answerKey, error: keyError } = await supabase
        .from('answer_keys')
        .select('*')
        .eq('id', selectedExamCode.id)
        .single();

      if (keyError || !answerKey) {
        throw new Error('Could not fetch answer key data');
      }

      const correctAnswers = Array.isArray(answerKey.answers)
        ? answerKey.answers
        : JSON.parse(answerKey.answers || '[]');

      if (!Array.isArray(correctAnswers)) {
        throw new Error('Invalid answer key format');
      }

      // Read PDF as ArrayBuffer
      const fileArrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(fileArrayBuffer);
      const totalPages = pdfDoc.getPageCount();

      const processedResults = [];

      for (let i = 0; i < totalPages; i++) {
        // Create a new PDF with only the current page
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);
        const pdfBytes = await newPdf.save();
        const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

        // Call your existing processOMR function
        const apiResponse = await processOMR(correctAnswers, pdfBlob);

        if (!apiResponse) continue;

        const studentNumber = apiResponse.read_response?.Student_No || `UNKNOWN_PAGE_${i + 1}`;
        const studentAnswers = Object.keys(apiResponse.read_response || {})
          .filter((k) => k.startsWith('q'))
          .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
          .map((k) => apiResponse.read_response[k] || '');

        const score = Number(apiResponse.score || 0);
        const totalQuestions = correctAnswers.length;

        processedResults.push({
          studentNumber,
          answers: studentAnswers,
          score,
          totalQuestions,
          page: i + 1
        });
      }

      // Save all page results
      await saveResults(processedResults);
      setResults(processedResults);
      setModalStep('done');

      // Refresh UI counts
      fetchScannedCounts();

    } catch (err) {
      console.error('Processing error:', err);
      setError(err.message || 'Failed to process PDF');
      setModalStep('upload'); // allow retry
    } finally {
      setProcessing(false);
    }
  };

  // Add at the top of your component (with other useState)
const [sortField, setSortField] = useState('name'); // 'name' | 'student_number' | 'score'
const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'

// Sorting handler
const handleSort = (field) => {
  if (sortField === field) {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  } else {
    setSortField(field);
    setSortOrder('asc');
  }
};

// Sorted and filtered results
const getSortedFilteredResults = () => {
  let arr = filterStudentResults(examResults);
  if (!arr || arr.length === 0) return [];
  return [...arr].sort((a, b) => {
    let aVal, bVal;
    if (sortField === 'score') {
      aVal = Number(a.score) || 0;
      bVal = Number(b.score) || 0;
    } else if (sortField === 'student_number') {
      aVal = (a.student_number || '').toString().toLowerCase();
      bVal = (b.student_number || '').toString().toLowerCase();
    } else {
      aVal = (a.name || '').toString().toLowerCase();
      bVal = (b.name || '').toString().toLowerCase();
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });
};

  // Add this function near your other utility functions
  const lookupStudentInfo = async (studentNumber) => {
    if (!studentNumber) return null;
    
    try {
      const { data, error } = await supabase
        .from('students')
        .select('student_number, username')
        .eq('student_number', studentNumber)
        .maybeSingle();
        
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error looking up student:', err);
      return null;
    }
  };

  // Replace existing saveResults with this version
  const saveResults = async (results) => {
    if (!selectedExamCode?.id || !Array.isArray(results)) {
      throw new Error('Invalid data for saving results');
    }

    try {
      // Get current user for uploaded_by
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;

      // 1. Fetch existing UNKNOWNs for this exam to determine next suffix
      const { data: existingUnknowns, error: unknownsErr } = await supabase
        .from('scan_results')
        .select('student_number')
        .eq('answer_key_id', selectedExamCode.id)
        .like('student_number', 'UNKNOWN%');
      if (unknownsErr) throw unknownsErr;

      // Find the highest UNKNOWN N used so far
      const unknownNumbers = (existingUnknowns || [])
        .map(r => r.student_number)
        .filter(n => /^UNKNOWN( \d+)?$/.test(n));
      let unknownSuffix = 0;
      unknownNumbers.forEach(n => {
        if (n === 'UNKNOWN') unknownSuffix = Math.max(unknownSuffix, 1);
        else {
          const match = n.match(/^UNKNOWN (\d+)$/);
          if (match) unknownSuffix = Math.max(unknownSuffix, parseInt(match[1], 10) + 1);
        }
      });

      // 2. Assign unique UNKNOWN names to new results
      let nextUnknown = unknownSuffix;
      const enrichedResults = results.map(result => {
        let studentNumber = result.studentNumber || 'UNKNOWN';
        if (/^UNKNOWN$/i.test(studentNumber)) {
          studentNumber = nextUnknown === 0 ? 'UNKNOWN' : `UNKNOWN ${nextUnknown}`;
          nextUnknown++;
        }
        const studentAnswers = result.answers.map(ans => {
          if (Array.isArray(ans)) return ans.join(',');
          return ans?.toString().trim() || '';
        });
        return {
          answer_key_id: selectedExamCode.id,
          uploaded_by: user.id,
          student_number: studentNumber,
          answers: studentAnswers,
          score: result.score,
          total_questions: result.totalQuestions,
          username: null,
          created_at: new Date().toISOString()
        };
      });

      // 3. Upsert all (no need to split, all UNKNOWNs are now unique)
      const { data, error } = await supabase
        .from('scan_results')
        .upsert(enrichedResults, { onConflict: ['answer_key_id', 'student_number'] })
        .select();
      if (error) throw error;

      // 4. Update usernames where possible (same as before)
      const studentNumbers = data
        .map(r => r.student_number)
        .filter(Boolean)
        .filter(n => !/^UNKNOWN( \d+)?$/.test(n));

      if (studentNumbers.length > 0) {
        const { data: students } = await supabase
          .from('students')
          .select('student_number, username')
          .in('student_number', studentNumbers);

        const studentMap = {};
        if (students) {
          students.forEach(s => {
            if (s.student_number) {
              studentMap[s.student_number] = s;
            }
          });
        }

        for (const result of data) {
          const studentInfo = studentMap[result.student_number];
          if (studentInfo) {
            await supabase
              .from('scan_results')
              .update({ username: studentInfo.username })
              .eq('id', result.id);
          }
        }
      }

      return data;

    } catch (e) {
      console.error('Failed to save scan results:', e);
      throw new Error('Failed to save scan results: ' + (e.message || e.toString()));
    }
  };

  // Updated score calculation - treats missing/empty answers as wrong
  const calculateScore = (studentAnswers, correctAnswers) => {
    if (!Array.isArray(studentAnswers) || !Array.isArray(correctAnswers)) {
      return 0;
    }

    let score = 0;
    let debugOutput = [];

    for (let i = 0; i < correctAnswers.length; i++) {
      const studentAns = (studentAnswers[i] || '').trim().toUpperCase();
      const correctAns = (correctAnswers[i] || '').trim().toUpperCase();
      
      const isCorrect = studentAns && correctAns && studentAns === correctAns;
      if (isCorrect) score++;

      debugOutput.push(`Q${i + 1}: Student=${studentAns}, Correct=${correctAns}, Match=${isCorrect}`);
    }

    // Log detailed scoring
    console.log('Scoring Details:');
    console.log(debugOutput.join('\n'));
    console.log(`Total Score: ${score}/${correctAnswers.length}`);

    return score;
  };

  const filterStudentResults = (results) => {
    const query = studentSearchQuery.toLowerCase().trim();
    if (!query) return results;
    
    return results.filter(student => 
      (student.name || '').toLowerCase().includes(query) ||
      (student.student_number || '').toLowerCase().includes(query)
    );
  };

  // open analysis for a student (call when clicking a student card)
  const openStudentAnalysis = async (student) => {
    try {
      setAnalysisStudent(student);
      setAnalysisImage(null);
      setImgSize({ w: 0, h: 0 });

      // attempt to find an image URL in the student record
      if (student.image_url) {
        setAnalysisImage(student.image_url);
      } else {
        // fallback: try to fetch stored scan image by scan_result id (adjust table/column names as needed)
        if (student.id) {
          const { data, error } = await supabase
            .from('scan_images') // change to your images table if different
            .select('url')
            .eq('scan_result_id', student.id)
            .maybeSingle();

          if (!error && data?.url) {
            setAnalysisImage(data.url);
          }
        }
      }

      // If still no image, you can set a placeholder or leave null (modal will still show overlay grid)
      setShowStudentAnalysisModal(true);
    } catch (e) {
      console.error('openStudentAnalysis error', e);
      setError('Failed to open analysis');
    }
  };

  // helper to close
  const closeStudentAnalysis = () => {
    setShowStudentAnalysisModal(false);
    setAnalysisStudent(null);
    setAnalysisImage(null);
    setImgSize({ w: 0, h: 0 });
  };
  
  // --- INSERT: computeQuestionDifficulty helper (place BEFORE the return/UI) ---
  const computeQuestionDifficulty = (results = [], answerKey = null) => {
    try {
      // Normalize correct answers
      let correctAnswers = [];
      if (Array.isArray(answerKey)) correctAnswers = answerKey;
      else if (answerKey && Array.isArray(answerKey.answers)) correctAnswers = answerKey.answers;
      else if (answerKey && typeof answerKey.answers === 'string') {
        correctAnswers = JSON.parse(answerKey.answers || '[]');
      }

      const totalQuestions = (correctAnswers || []).length;
      const totalStudents = (results || []).length;

      // Initialize per-question counters
      const questions = Array.from({ length: totalQuestions }, (_, i) => ({
        index: i + 1,
        correctAnswer: (correctAnswers[i] || '').toString().toUpperCase(),
        correctCount: 0,
        incorrectCount: 0,
        unansweredCount: 0
      }));

      // Tally student answers
      (results || []).forEach(r => {
        let studentAnswers = [];
        try {
          if (Array.isArray(r.answers)) studentAnswers = r.answers;
          else if (typeof r.answers === 'string' && r.answers.trim().startsWith('[')) studentAnswers = JSON.parse(r.answers || '[]');
          else if (typeof r.answers === 'string' && r.answers.trim() !== '') studentAnswers = r.answers.split(',').map(s => s.trim());
          else studentAnswers = [];
        } catch (e) {
          studentAnswers = [];
        }

        for (let i = 0; i < totalQuestions; i++) {
          const corr = (correctAnswers[i] || '').toString().toUpperCase();
          const raw = studentAnswers[i];
          let sel = [];

          if (Array.isArray(raw)) sel = raw.map(x => (x || '').toString().toUpperCase()).filter(Boolean);
          else if (raw == null || raw === '') sel = [];
          else sel = (raw || '').toString().split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

          if (sel.length === 0) {
            questions[i].unansweredCount++;
          } else if (sel.length > 1) {
            // multiple selections -> count as incorrect
            questions[i].incorrectCount++;
          } else {
            const answer = sel[0];
            if (answer === corr && corr !== '') questions[i].correctCount++;
            else questions[i].incorrectCount++;
          }
        }
      });

      const topWrong = questions.slice().sort((a, b) => b.incorrectCount - a.incorrectCount).filter(q => q.incorrectCount > 0).slice(0, 5);

      return {
        totalQuestions,
        questions,
        overall: {
          totalStudents,
          topWrong
        }
      };
    } catch (err) {
      console.error('computeQuestionDifficulty error', err);
      return { totalQuestions: 0, questions: [], overall: { totalStudents: 0, topWrong: [] } };
    }
  };

  // UI render: add "Scanned Exam" section with clickable Exam Codes
  return (
    <div className="dashboard-container" style={{ fontSize: "18px", lineHeight: "1.5", padding: "20px" }}>
      {/* Global modal & mobile-friendly overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
         /* Make modal cards adapt to mobile: full-screen on narrow widths, centered on desktop */
         .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 4000; display:flex; align-items:center; justify-content:center; padding:12px; box-sizing:border-box; }
         .modal-card { position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(920px, 94%); max-height: 86vh; overflow-y: auto; background: #fff; padding: 24px; border-radius: 12px; box-sizing: border-box; }
         /* Ensure student analysis modal scales and doesn't produce horizontal scroll */
         .modal-card * { box-sizing: border-box; word-wrap: break-word; }
 
         /* NAVBAR: keep visual style but make responsive for mobile (no style changes) */
         .top-navbar .nav-right { display: flex; gap: 32px; align-items: center; }
         .top-navbar .nav-right a { display: inline-flex; align-items: center; gap: 8px; color: #fff; text-decoration: none; font-weight: 500; }
         .top-navbar .nav-left { display:flex; align-items:center; gap:24px; }
         .nav-hamburger { display:none; background: transparent; border: none; padding: 6px; cursor: pointer; }
         .nav-hamburger .bar { display:block; width:18px; height:2px; background:#fff; margin:3px 0; border-radius:2px; }
         /* Mobile: hide right links and show hamburger */
         @media (max-width: 760px) {
           .top-navbar .nav-right { display: none !important; }
           .nav-hamburger { display: inline-block !important; }
         }
 
         /* Mobile menu drawer (simple, keeps app look) */
         .mobile-menu-overlay { position: fixed; inset: 0; z-index: 6000; background: rgba(0,0,0,0.35); display:flex; justify-content:flex-end; }
         .mobile-menu { width: 84%; max-width: 360px; background:#fff; height:100%; padding:20px; box-sizing:border-box; overflow:auto; }
         .mobile-menu a { color:#222; display:block; padding:12px 8px; text-decoration:none; font-weight:600; border-bottom:1px solid #f1f1f1; }
 
         /* make sure no horizontal scroll */
         html, body, #root, .dashboard-container, .main-content { max-width:100% !important; overflow-x:hidden !important; }
 
         /* Responsive grids inside modals */
         .student-grid { display: grid !important; grid-template-columns: repeat(5, 1fr); gap: 12px; }
         .answer-grid { display: grid !important; grid-template-columns: repeat(5, 1fr); gap: 12px; }
 
         /* Mobile adjustments */
         @media (max-width: 640px) {
           .modal-overlay { align-items: flex-start; padding-top: 62px; }
           .modal-card { position: fixed; left: 0; top: 0; transform: none; width: 100%; height: 100vh; max-height: 100vh; border-radius: 0; padding: 16px; overflow-y: auto; }
           /* Make lists and grids usable on small screens */
           .student-grid { grid-template-columns: repeat(2, 1fr) !important; }
           .answer-grid { grid-template-columns: repeat(2, 1fr) !important; }
           .modal-card h2, .modal-card h3 { font-size: 18px !important; }
           .modal-card p { font-size: 14px !important; }
           /* Reduce gap/padding for mobile so content fits vertically */
           .modal-card { padding-bottom: 84px; }
         }
       `}} />
      {/* TOP NAVBAR (green, consistent with other pages) */}
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
          <Link to="/home" aria-label="Home">
            <img src="/src/img/house.png" alt="Back" style={{ width: "32px", marginRight: "12px", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: "22px", letterSpacing: "1px" }}>
            Exam
          </span>
        </div>
        <div className="nav-right" style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <Link to="/answerKey" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>
            <img src="/src/img/AnswerKeys.png" alt="Answer Key" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Answer Key
          </Link>
          <Link to="/answerSheet" style={{ color: "#fff", textDecoration: "none", fontWeight: 500 }}>
            <img src="/src/img/Sheet.png" alt="Answer Sheet" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Answer Sheet
          </Link>
          <Link to="/gradeReport" className="active" style={{ color: "#fff", textDecoration: "underline", fontWeight: 500 }}>
            <img src="/src/img/ReportGrade.png" alt="Grade Report" style={{ width: "28px", verticalAlign: "middle", marginRight: "6px" }} />
            Exam
          </Link>
        </div>

        {/* Mobile hamburger (keeps same look on desktop) */}
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
      {/* Mobile menu drawer (appears on small screens) */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 800 }}>Menu</div>
              <button onClick={() => setMobileMenuOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: 20 }}>✕</button>
            </div>
            <Link to="/answerKey" onClick={() => setMobileMenuOpen(false)}>Answer Key</Link>
            <Link to="/answerSheet" onClick={() => setMobileMenuOpen(false)}>Answer Sheet</Link>
            <Link to="/gradeReport" onClick={() => setMobileMenuOpen(false)}>Exam</Link>
          </div>
        </div>
      )}

      <div className="main-content" style={{ marginTop: "84px", padding: "20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={handleScanExam}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "#54b948",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Scan Exam
          </button>
          <button
            onClick={() => { setShowArchiveModal(true); fetchArchivedExamCodes(); }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "#1976d2",
              color: "#fff",
              border: "none",
              padding: "10px 18px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            📦 Archived Exams
          </button>
        </div>

        {/* Scanned Exam section */}
        <div style={{ marginTop: 20 }}>
          <h3>Scanned Exam</h3>

          {/* Search bar for scanned exam codes */}
          <div style={{ marginTop: 8, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Search scanned exam codes by code, date or scanned count..."
              value={scannedSearch}
              onChange={(e) => setScannedSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #e6e6e6',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box'
              }}
            />
          </div>

           <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
             {/* Only show exam codes that have scanned results */}
             {examCodes.filter(code => (scannedCounts[code.id] || 0) > 0).length === 0 && (
               <div style={{ color: "#666" }}>No scanned exams found.</div>
             )}
             
            {examCodes
              .filter(code => (scannedCounts[code.id] || 0) > 0) // Only show codes with scanned results
              .filter(code => {
                const q = (scannedSearch || '').trim().toLowerCase();
                if (!q) return true;
                const codeText = (code.exam_code || code.code || '').toString().toLowerCase();
                const refText = (code.reference || '').toString().toLowerCase();
                const dateText = (code.date || code.created_at || '').toString().toLowerCase();
                const countText = String(scannedCounts[code.id] || 0);
                return codeText.includes(q) || refText.includes(q) || dateText.includes(q) || countText.includes(q);
              })
              .map(code => (
                 <div
  key={code.id}
  onClick={() => viewExamResults(code)}
  style={{
    width: '100%',
    textAlign: 'left',
    padding: '12px 14px',
    cursor: 'pointer',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderRadius: 8,
    border: '1px solid #f3f3f3',
    boxShadow: '0 6px 18px rgba(12,20,28,0.03)',
    position: 'relative'
  }}
>
  <div style={{ fontSize: 12, color: '#666' }}>
    {code.date ? new Date(code.date).toLocaleString() : (code.created_at ? new Date(code.created_at).toLocaleString() : "")}
  </div>
  <div style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>
    {code.exam_code || code.code || `ID:${code.id}`}
  </div>
  <div style={{ fontSize: 13, color: '#666' }}>{code.reference || ''}</div>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
    <div style={{ fontSize: 13, fontWeight: 800, color: '#2f7e12', background: '#eef9ee', padding: '6px 10px', borderRadius: 20 }}>
      {scannedCounts[code.id] || 0} scanned
    </div>
    <div style={{
      fontSize: 13,
      color: '#0055d4',
      background: '#f0f7ff',
      padding: '6px 10px',
      borderRadius: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 4
    }}>
      <span>View Details</span>
      <span style={{ fontSize: 16 }}>→</span>
    </div>
  </div>
  {/* Archive button - place above View Details */}
  <button
    onClick={e => { e.stopPropagation(); archiveExam(code); }}
    style={{
      position: 'absolute',
      top: 10,
      right: 10,
      background: '#f44336',
      color: '#fff',
      border: 'none',
      borderRadius: 6,
      padding: '4px 12px',
      cursor: 'pointer',
      fontWeight: 700,
      zIndex: 2
    }}
  >
    Archive
  </button>
</div>
            ))}
          </div>
        </div>

        {/* Exam Results Modal */}
        {showExamResultsModal && (
          <div
            className="modal-overlay"
            onClick={() => setShowExamResultsModal(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 4000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(900px, 96%)',
                maxHeight: '80vh',
                overflowY: 'auto',
                background: '#fff',
                padding: 24,
                borderRadius: 12,
                boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
                fontSize: 15,
                lineHeight: 1.45,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20 }}>Scanned Students</h3>
                  <p style={{ margin: '6px 0 0', color: '#666', fontSize: 13 }}>
                    {examResultsLoading ? 'Loading scanned students…' : `Showing ${examResults.length} scanned record(s).`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {!examResultsLoading && examResults.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowAnalysisModal(true)}
                        style={{
                          padding: '8px 14px',
                          background: '#2e7d32',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 700
                        }}
                      >
                        <span>📊</span>
                        <span>Exam Analysis</span>
                      </button>
                      <button
                        onClick={() => setShowDifficultyModal(true)}
                        style={{
                          padding: '8px 14px',
                          background: '#1976d2',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          fontWeight: 700
                        }}
                      >
                        <span>🧠</span>
                        <span>Question Difficulty</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                {examResultsLoading && <div style={{ padding: 18, textAlign: 'center', color: '#666' }}>Loading...</div>}
                {!examResultsLoading && examResults.length === 0 && (
                  <div style={{ padding: 18, color: '#666' }}>No scanned results.</div>
                )}
                {!examResultsLoading && examResults.length > 0 && (
                  <>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
  <input
    type="text"
    placeholder="Search by name or student number..."
    value={studentSearchQuery}
    onChange={(e) => setStudentSearchQuery(e.target.value)}
    style={{
      flex: 1,
      padding: '10px 12px',
      border: '1px solid #eee',
      borderRadius: 8,
      fontSize: 14
    }}
  />
  <button
    onClick={() => {
      setDeleteMode((prev) => !prev);
      setSelectedForDelete([]);
    }}
    style={{
      padding: '8px 14px',
      background: deleteMode ? '#bbb' : '#f44336',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      fontWeight: 700,
      whiteSpace: 'nowrap'
    }}
  >
    <span>🗑️</span>
    <span>Delete Student</span>
  </button>
</div>
                      
                    </div>
                    
                    {/* Sorting controls */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>Sort by:</span>
                      <button
                        onClick={() => handleSort('name')}
                        style={{
                          fontWeight: sortField === 'name' ? 700 : 400,
                          background: sortField === 'name' ? '#74A12E' : '#000000ff',
                          border: '1px solid #eee',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Name {sortField === 'name' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </button>
                      <button
                        onClick={() => handleSort('student_number')}
                        style={{
                          fontWeight: sortField === 'student_number' ? 700 : 400,
                          background: sortField === 'student_number' ? '#74A12E' : '#000000ff',
                          border: '1px solid #eee',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Student Number {sortField === 'student_number' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </button>
                      <button
                        onClick={() => handleSort('score')}
                        style={{
                          fontWeight: sortField === 'score' ? 700 : 400,
                          background: sortField === 'score' ? '#74A12E' : '#000000ff',
                          border: '1px solid #eee',
                          borderRadius: 6,
                          padding: '4px 10px',
                          cursor: 'pointer'
                        }}
                      >
                        Score {sortField === 'score' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                      </button>
                    </div>

                    <div className="student-grid" style={{ marginTop: '12px', width: '100%' }}>
                      {getSortedFilteredResults().map((r, i) => (
                        <div
                          key={i}
                          style={{
                            position: 'relative',
                            border: deleteMode && selectedForDelete.includes(r.id) ? '2px solid #f44336' : '1px solid #eee',
                            background: deleteMode && selectedForDelete.includes(r.id) ? '#ffebee' : '#fff',
                            borderRadius: '10px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                            minWidth: 0,
                            cursor: deleteMode ? 'pointer' : 'pointer',
                            opacity: deleteMode && !selectedForDelete.includes(r.id) ? 0.7 : 1,
                            transition: 'border 0.2s, background 0.2s'
                          }}
                          onClick={() => {
                            if (deleteMode) toggleSelectStudent(r.id);
                            else openStudentAnalysis(r);
                          }}
                        >
                          {deleteMode && (
                            <input
                              type="checkbox"
                              checked={selectedForDelete.includes(r.id)}
                              onChange={() => toggleSelectStudent(r.id)}
                              style={{
                                position: 'absolute',
                                top: 10,
                                right: 10,
                                zIndex: 2,
                                width: 18,
                                height: 18
                              }}
                              onClick={e => e.stopPropagation()}
                            />
                          )}
                          <div style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: '#222',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {r.name || 'Unknown'}
                          </div>
                          <div style={{
                            fontSize: '20px',
                            fontWeight: '700',
                            color: '#2f7e12'
                          }}>
                            {r.score}/{r.total_questions}
                            <span style={{
                              fontSize: '13px',
                              color: '#666',
                              marginLeft: '4px'
                            }}>
                              ({((r.score/r.total_questions) * 100).toFixed(1)}%)
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 13, color: '#333', fontWeight: 600 }}>{r.student_number || '-'}</div>
                            <div style={{ fontSize: 13, color: '#666' }}>{r.username || '-'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {filterStudentResults(examResults).length === 0 && (
                      <div style={{
                        padding: '20px',
                        textAlign: 'center',
                        color: '#666',
                        background: '#f9f9f9',
                        borderRadius: 8,
                        marginTop: 12
                      }}>
                        No students match your search
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                { /* PDF download button - use programmatic generation to avoid PDFDownloadLink runtime errors */ }


                { /* ZIP download: PDF + Excel in one file (reliable single click) */ }
                <button
                  onClick={async () => {
                    const studentsForExport = typeof filterStudentResults === 'function' ? filterStudentResults(examResults) : examResults || [];
                    await downloadZipWithPdfAndExcel({
                      examCode: selectedExamCode?.exam_code || selectedExamCode?.id || 'exam',
                      students: studentsForExport
                    });
                  }}
                  style={{
                    padding: '8px 14px',
                    background: '#2e7d32',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 700
                  }}
                >
                  Download PDF + Excel (ZIP)
                </button>
                {deleteMode && (
                  <>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={selectedForDelete.length === 0}
                      style={{
                        padding: '8px 14px',
                        background: selectedForDelete.length === 0 ? '#ccc' : '#f44336',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: selectedForDelete.length === 0 ? 'not-allowed' : 'pointer',
                        fontWeight: 700
                      }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={cancelDeleteMode}
                      style={{
                        padding: '8px 14px',
                        background: '#000000ff',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      Cancel
                    </button>
                  </>
                )}
                <button
                  onClick={() => setShowExamResultsModal(false)}
                  style={{ padding: '8px 14px', fontSize: 14 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* File Upload Section */}
        {showFileUpload && (
          <div className="upload-section">
            <h3>Upload Bubble Sheet PDF</h3>
            <p>Selected Exam: {selectedExamCode?.exam_code}</p>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={processing}
            />
            {processing && <div>Processing... Please wait.</div>}
          </div>
        )}

        {/* Results Section */}
        {results && (
          <div className="results-section">
            <h3>Results</h3>
            <table>
              <thead>
                <tr>
                  <th>Student Number</th>
                  <th>Score</th>
                  <th>Percentage</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={index}>
                    <td>{result.studentNumber}</td>
                    <td>{result.score}/{result.totalQuestions}</td>
                    <td>
                      {((result.score/result.totalQuestions) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {showExamCodeModal && (
          <div
            className="modal-overlay"
            onClick={() => { setShowExamCodeModal(false); setModalStep('enter'); }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 3000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              className="modal-card"
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'min(920px, 94%)',
                maxHeight: '86vh',
                overflowY: 'auto',
                background: '#fff',
                padding: 28,
                borderRadius: 12,
                boxShadow: '0 18px 50px rgba(0,0,0,0.25)',
                fontSize: 16,
                lineHeight: 1.45,
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
                    {modalStep === 'enter' && 'Enter Exam Code'}
                    {modalStep === 'upload' && 'Upload Bubble Sheet'}
                    {modalStep === 'processing' && 'Processing Exam'}
                    {modalStep === 'done' && 'Scan Results'}
                  </h2>
                  <p style={{ margin: '6px 0 0', color: '#666', fontSize: 14 }}>
                    {modalStep === 'enter' && 'Search or click the exam code below.'}
                    {modalStep === 'upload' && 'Select the bubble sheet PDF for the verified exam.'}
                    {modalStep === 'processing' && 'Scanning and scoring. Please wait — this can take a few moments.'}
                    {modalStep === 'done' && 'Review scanned students and scores.'}
                  </p>
                </div>

                {/* Removed internal X button per request — clicking outside modal will close it */}
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Left column: searchable list */}
                <div style={{ flex: '1 1 520px', minWidth: 320 }}>
                  {modalStep === 'enter' && (
                    <>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Search exam codes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          style={{
                            flex: 1,
                            padding: 12,
                            border: '1px solid #e3e3e3',
                            borderRadius: 8,
                            fontSize: 16,
                            boxSizing: 'border-box'
                          }}
                        />
                        <button
                          onClick={() => { setSearchQuery(''); }}
                          style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #eee', background: '#fafafa', cursor: processing ? 'default' : 'pointer' }}
                        >
                          Clear
                        </button>
                      </div>

                      <div style={{ marginTop: 14, maxHeight: '48vh', overflowY: 'auto', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                        {examCodes.filter(c => {
                          const q = (searchQuery || '').trim().toLowerCase();
                          if (!q) return true;
                          return (c.exam_code || c.code || '').toLowerCase().includes(q)
                            || (c.reference || '').toLowerCase().includes(q)
                            || (c.date || '').toLowerCase().includes(q);
                        }).length === 0 && (
                          <div style={{ padding: 14, color: '#666' }}>No exam codes match.</div>
                        )}

                        {examCodes.filter(c => {
                          const q = (searchQuery || '').trim().toLowerCase();
                          if (!q) return true;
                          return (c.exam_code || c.code || '').toLowerCase().includes(q)
                            || (c.reference || '').toLowerCase().includes(q)
                            || (c.date || '').toLowerCase().includes(q);
                        }).map(c => (
  <div
    key={c.id}
    onClick={() => handleExamCodeSelect(c)}
    style={{
      width: '100%',
      textAlign: 'left',
      padding: '12px 14px',
      borderBottom: '1px solid #fafafa',
      cursor: 'pointer',
      background: '#fff',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      borderRadius: 8
    }}
  >
    <div style={{ fontSize: 12, color: '#666' }}>
      {c.date ? new Date(c.date).toLocaleString() : (c.created_at ? new Date(c.created_at).toLocaleString() : "")}
    </div>
    <div style={{ fontWeight: 700, fontSize: 15, color: '#222' }}>{c.exam_code || c.code || `ID:${c.id}`}</div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 13, color: '#666' }}>{c.reference || ''}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#2f7e12', background: '#eef9ee', padding: '6px 10px', borderRadius: 20 }}>
        {scannedCounts[c.id] || 0} scanned
      </div>
    </div>
  </div>
))}

                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                        <button onClick={() => { setShowExamCodeModal(false); setModalStep('enter'); }} style={{ padding: '10px 16px', fontSize: 15 }}>
                          Close
                        </button>
                      </div>
                    </>
                  )}

                  {modalStep === 'upload' && (
                    <>
                      <div style={{ marginTop: 8, fontSize: 15, color: '#333' }}>
                        Selected Exam: <strong>{selectedExamCode?.exam_code || `ID:${selectedExamCode?.id}`}</strong>
                      </div>

                      <label
                        htmlFor="file-input"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          marginTop: 14,
                          padding: '22px',
                          borderRadius: 10,
                          border: '2px dashed #e4e4e4',
                          cursor: processing ? 'default' : 'pointer',
                          background: '#fbfbfb'
                        }}
                      >
                        <div style={{ fontSize: 28, color: '#999' }}>📁</div>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 600 }}>Upload PDF (or click to select)</div>
                          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{processing ? 'Processing...' : 'Accepted: .pdf — one or multiple pages'}</div>
                        </div>
                      </label>
                      <input id="file-input" type="file" accept=".pdf" onChange={handleFileUpload} disabled={processing} style={{ display: 'none' }} />

                      {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                        <button onClick={() => { setShowExamCodeModal(false); setModalStep('enter'); }} style={{ padding: '10px 16px' }}>Close</button>
                      </div>
                    </>
                  )}

                  {modalStep === 'processing' && (
                    <div style={{ marginTop: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Working…</div>
                      <div style={{ height: 10, background: '#eee', borderRadius: 6, overflow: 'hidden', width: '100%' }}>
                        <div style={{
                          width: processing ? '90%' : '0%',
                          height: '100%',
                          background: '#54b948',
                          transition: 'width 800ms ease'
                        }} />
                      </div>
                      <div style={{ marginTop: 10, color: '#666', fontSize: 14 }}>Please do not close this window.</div>
                    </div>
                  )}
                </div>

                {/* Right column: results / scanned count */}
                <div style={{ width: '360px', minWidth: 260 }}>
                  {modalStep === 'upload' && (
                    <div style={{ padding: 12, borderRadius: 8, background: '#fff', border: '1px solid #f0f0f0' }}>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Scanned Count</div>
                      <div style={{ color: '#333', fontSize: 28, fontWeight: 700 }}>{scannedCounts[selectedExamCode?.id] || 0}</div>
                      <div style={{ color: '#666', marginTop: 8, fontSize: 13 }}>Previously scanned for this exam</div>
                    </div>
                  )}

                  {modalStep === 'done' && results && (
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Latest Results</div>
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>Showing scanned students from this upload</div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: 8 }}>Student</th>
                            <th style={{ textAlign: 'left', padding:  8 }}>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.map((r, i) => (

                            <tr key={i} style={{ borderTop: '1px solid #f5f5f5' }}>
                              <td style={{ padding: 8 }}>{r.studentNumber}</td>
                              <td style={{ padding: 8 }}>{r.score}/{r.totalQuestions}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer for done step */}
              {modalStep === 'done' && results && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <button onClick={() => { setShowExamCodeModal(false); setModalStep('enter'); setResults(null); }} style={{ padding: '10px 16px', fontSize: 15 }}>Close</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Student Analysis Modal (AnswerKey-style view) */}
      {showStudentAnalysisModal && (
        <div
          className="modal-overlay"
          onClick={closeStudentAnalysis}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 5000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: 'min(1100px, 96%)',
              maxHeight: '92vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 12,
              padding: 18
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 320 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {analysisStudent?.name || analysisStudent?.student_number || 'Student'}
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                    <input
                      value={analysisStudentNumber}
                      onChange={(e) => setAnalysisStudentNumber(e.target.value)}
                      onKeyDown={onAnalysisStudentKeyDown}
                      placeholder="Edit student number"
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14 }}
                    />
                    <button
                      onClick={saveAnalysisStudentNumber}
                      disabled={editingSaving[analysisStudent?.id]}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 8,
                        background: editingSaving[analysisStudent?.id] ? '#ddd' : '#54b948',
                        color: editingSaving[analysisStudent?.id] ? '#666' : '#fff',
                        border: 'none',
                        cursor: editingSaving[analysisStudent?.id] ? 'not-allowed' : 'pointer',
                        fontWeight: 700
                      }}
                    >
                      {editingSaving[analysisStudent?.id] ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: 13, color: '#666', marginTop: 6 }}>{analysisStudent?.student_number}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Removed internal X button per request — clicking outside modal will close it */}
              </div>
            </div>

            {/* AnswerKey-style question grid */}
                                             <div style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontWeight: 700 }}>Answer Analysis</div>
                <div style={{ marginLeft: 'auto', fontWeight: 700, color: '#2f7e12', fontSize: 14 }}>
                  Score: {analysisStudent?.score}/{analysisStudent?.total_questions}
                </div>
              </div>

              {(() => {
                // Parse student answers
                const studentAnswers = (() => {
                  if (!analysisStudent?.answers) return [];
                  if (Array.isArray(analysisStudent.answers)) return analysisStudent.answers;
                  try {
                    return JSON.parse(analysisStudent.answers);
                  } catch (e) {
                    console.error('Failed to parse student answers:', e);
                    return [];
                  }
                })();

                // Parse correct answers
                const correctAnswers = (() => {
                  if (!selectedExamCode?.answers) return [];
                  if (Array.isArray(selectedExamCode.answers)) return selectedExamCode.answers;
                  try {
                    return JSON.parse(selectedExamCode.answers);
                  } catch (e) {
                    console.error('Failed to parse correct answers:', e);
                    return [];
                  }
                })();

                const totalQuestions = Math.max(correctAnswers.length || 0, studentAnswers.length || 0);
                const choiceLetters = ['A', 'B', 'C', 'D'];

                if (totalQuestions === 0) {
                  return <div style={{ color: '#666', padding: 12 }}>No answers available for analysis.</div>;
                }

                return (
                  <>
                    <div className="answer-grid" style={{ gap: 12 }}>
                      {Array.from({ length: totalQuestions }).map((_, qIndex) => {
                        const qNum = qIndex + 1;
                        const correctAnswer = (correctAnswers[qIndex] || '').toString().toUpperCase();
                        const studentAnswer = (studentAnswers[qIndex] || '').toString().toUpperCase();
                        
                        let selections = [];
                        if (studentAnswer) {
                          selections = studentAnswer.includes(',') ? 
                            studentAnswer.split(',').map(s => s.trim().toUpperCase()) : 
                            [studentAnswer.trim().toUpperCase()];
                        }

                        const multipleMarked = selections.length > 1;
                        const unanswered = selections.length === 0;

                        return (
                          <div key={qIndex} style={{ 
                            background: '#fafafa', 
                            padding: 10, 
                            borderRadius: 8, 
                            border: '1px solid #f0f0f0' 
                          }}>
                            <div style={{ fontWeight: 700, marginBottom: 8 }}>Q{qNum}</div>

                            <div style={{ 
                              display: 'flex',
                              gap: 6,
                              flexWrap: 'nowrap',
                              alignItems: 'center'
                            }}>
                              {choiceLetters.map(letter => {
                                const isSelected = selections.includes(letter);
                                const isCorrect = letter === correctAnswer;
                                
                                let bg = '#fff';
                                let color = '#222';
                                let border = '1px solid #ddd';

                                if (unanswered && isCorrect) {
                                  // No answer and this is the correct one - yellow
                                  bg = '#f1c40f';
                                  color = '#222';
                                  border = '2px solid #f39c12';
                                } else if (!unanswered) {
                                  // Student gave an answer
                                  if (isSelected) {
                                    if (multipleMarked || !isCorrect) {
                                      // Multiple answers or wrong answer - red
                                      bg = '#e74c3c';
                                      color = '#fff';
                                      border = '2px solid #c0392b';
                                    } else if (isCorrect) {
                                      // Single correct answer - green
                                      bg = '#54b948';
                                      color = '#fff';
                                      border = '2px solid #388e3c';
                                    }
                                  }
                                }

                                return (
                                  <div
                                    key={letter}
                                    style={{
                                      padding: '6px 8px',
                                      borderRadius: 6,
                                      background: bg,
                                      color: color,
                                      border: border,
                                      fontWeight: 700,
                                      minWidth: 32,
                                      textAlign: 'center',
                                      flex: '1 1 auto'
                                    }}
                                  >
                                    {letter}
                                  </div>
                                );
                              })}
                            </div>

                            <div style={{ 
                              marginTop: 8,
                              fontSize: 12,
                              color: '#666',
                              display: 'flex',
                              justifyContent: 'space-between'
                            }}>
                              <div>
                                {unanswered ? 
                                  <em>Unanswered</em> : 
                                  `Marked: ${selections.join(', ')}`}
                              </div>
                              <div>
                                Correct: <strong>{correctAnswer || '-'}</strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Legend */}
                    <div style={{ 
                      display: 'flex', 
                      gap: 16, 
                      marginTop: 16, 
                      padding: '12px',
                                          
                      background: '#fafafa',
                      borderRadius: 8
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, background: '#54b948', borderRadius: 4 }}/>
                        <span style={{ fontSize: 13 }}>Correct</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, background: '#e74c3c', borderRadius: 4 }}/>
                        <span style={{ fontSize: 13 }}>Incorrect/Multiple</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 16, height: 16, background: '#f1c40f', borderRadius: 4 }}/>
                        <span style={{ fontSize: 13 }}>Correct Answer (Unanswered)</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* legend */}
          </div>
        </div>
      )}

      {/* Exam Analysis Modal */}
      {showAnalysisModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 24,
            width: '90%',
            maxWidth: 800,
            maxHeight: '90vh',
            overflow: 'auto',
            position: 'relative'
          }}>
            <div style={{ position: 'absolute', right: 16, top: 16 }}>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ×
              </button>
            </div>

            <h3 style={{ margin: '0 0 20px', color: '#2e7d32' }}>Exam Analysis</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Total Students</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{examResults.length}</div>
              </div>

              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Passing Score</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {Math.round(examResults[0]?.total_questions * 0.6 || 0)}/{examResults[0]?.total_questions || 0}
                </div>
              </div>

              <div style={{ background: '#f8f9fa', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#666' }}>Average Score</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {examResults.length > 0 ? (examResults.reduce((sum, s) => sum + (Number(s.score) || 0), 0) / examResults.length).toFixed(1) : 0}/{examResults[0]?.total_questions || 0}
                </div>

              </div>
              <div style={{ background: '#ffebee', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#28c64aff', marginBottom: 8 }}>Highest Score</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  {Math.max(...examResults.map(s => Number(s.score) || 0))}/{examResults[0]?.total_questions}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: '#1cb72eff' }}>
                  {examResults
                    .filter(s => Number(s.score) === Math.max(...examResults.map(s => Number(s.score) || 0)))
                    .map(s => s.name || 'Unknown')
                    .join(', ')}
                </div>
              </div>

              <div style={{ background: '#ffebee', padding: 16, borderRadius: 8 }}>
                <div style={{ fontSize: 13, color: '#c62828', marginBottom: 8 }}>Lowest Score</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>
                  {Math.min(...examResults.map(s => Number(s.score) || 0))}/{examResults[0]?.total_questions}
                </div>
                <div style={{ fontSize: 13, marginTop: 8, color: '#b71c1c' }}>
                  {examResults
                    .filter(s => Number(s.score) === Math.min(...examResults.map(s => Number(s.score) || 0)))
                    .map(s => s.name || 'Unknown')
                    .join(', ')}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>Interpretation</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>
                {(() => {
                  const passRate = (examResults.filter(s =>
                    Number(s.score) >= Math.round(examResults[0]?.total_questions * 0.6 || 0)
                  ).length / Math.max(examResults.length,1)) * 100;

                  if (passRate >= 90) return 'Excellent performance with very high pass rate.';
                  if (passRate >= 70) return 'Good overall performance with majority passing.';
                  if (passRate >= 50) return 'Moderate performance. Some students may need additional support.';
                  return 'Low pass rate. Consider reviewing exam difficulty and coverage.';
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Difficulty Modal */}
      {showDifficultyModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowDifficultyModal(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(920px, 96%)',
              maxHeight: '88vh',
              overflow: 'auto',
              background: '#fff',
              borderRadius: 12,
              padding: 18,
              position: 'relative'
            }}
          >
            <button
              onClick={() => setShowDifficultyModal(false)}
              style={{ position: 'absolute', right: 12, top: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}
              aria-label="Close question difficulty"
            >
              ✕
            </button>

            <h3 style={{ margin: '0 0 12px' }}>Question Difficulty</h3>

            {(!selectedExamCode || examResultsLoading || examResults.length === 0) ? (
              <div style={{ color: '#666', padding: 12 }}>
                {examResultsLoading ? 'Loading...' : 'No scanned results or no exam selected.'}
              </div>
            ) : (
              (() => {
                const diff = computeQuestionDifficulty(examResults || [], selectedExamCode);
                if (!diff.totalQuestions) return <div style={{ color: '#666' }}>No question data available.</div>;

                const totalStudents = diff.overall.totalStudents || 0;
                const manyWrongThreshold = Math.max(1, Math.round(totalStudents * 0.35)); // >35% wrong = many
                const manyCorrectThreshold = Math.max(1, Math.round(totalStudents * 0.75)); // >75% correct = well understood

                return (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div style={{ fontSize: 13, color: '#666' }}>
                      Total students analyzed: <strong>{totalStudents}</strong>
                    </div>

                    <div style={{ display: 'grid', gap: 12 }}>
                      {diff.questions.map((q) => {
                        const correct = q.correctCount;
                        const incorrect = q.incorrectCount;
                        const unanswered = q.unansweredCount;
                        const correctPct = totalStudents ? Math.round((correct / totalStudents) * 1000) / 10 : 0;
                        const wrongPct = totalStudents ? Math.round((incorrect / totalStudents) * 1000) / 10 : 0;
                        const unansPct = totalStudents ? Math.round((unanswered / totalStudents) * 1000) / 10 : 0;

                        let interp = '';
                        if (incorrect >= manyWrongThreshold) {
                          interp = 'Many students answered this question incorrectly. Consider reviewing the topic, clarifying instructions, or checking wording.';
                        } else if (correct >= manyCorrectThreshold) {
                          interp = 'Most students answered this question correctly. Concept appears well understood.';
                        } else {
                          interp = 'Mixed results. Targeted review recommended.';
                        }

                        return (
                          <div key={q.index} style={{ padding: 12, borderRadius: 8, border: '1px solid #f0f0f0', background: '#fff' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontWeight: 700 }}>Question {q.index}</div>
                              <div style={{ fontSize: 13, color: '#666' }}>Correct answer: <strong>{q.correctAnswer || '-'}</strong></div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
                              <div style={{ minWidth: 120, background: '#e8f5e9', padding: 8, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: '#666' }}>Correct</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: '#1b5e20' }}>{correct} ({correctPct}%)</div>
                              </div>
                              <div style={{ minWidth: 120, background: '#ffebee', padding: 8, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: '#666' }}>Incorrect</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: '#b71c1c' }}>{incorrect} ({wrongPct}%)</div>
                              </div>
                              <div style={{ minWidth: 120, background: '#fff8e1', padding: 8, borderRadius: 8 }}>
                                <div style={{ fontSize: 12, color: '#666' }}>Unanswered</div>
                                <div style={{ fontWeight: 700, fontSize: 16, color: '#a97100' }}>{unanswered} ({unansPct}%)</div>
                              </div>
                            </div>

                            <div style={{ marginTop: 10, fontSize: 13, color: '#444' }}>
                              <strong>Interpretation:</strong> {interp}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ marginTop: 12, padding: 12, background: '#f7f7fb', borderRadius: 8 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>Overall recommendations</div>
                      <div style={{ color: '#444', fontSize: 14 }}>
                        {diff.overall.topWrong.length === 0 ? (
                          'No significant question-level issues detected.'
                        ) : (
                          <>
                            Most-missed questions: <strong>{diff.overall.topWrong.map(t => `Q${t.index}`).join(', ')}</strong>. Prioritize these for remediation.
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}

      {/* --- Archive Modal --- */}
      {showArchiveModal && (
        <div className="modal-overlay" onClick={() => setShowArchiveModal(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h3>Archived Exams</h3>
            {/* Archive search bar */}
            <div style={{ margin: '10px 0 18px 0' }}>
              <input
                type="text"
                placeholder="Search archived exams by code, reference, or date..."
                value={archiveSearch}
                onChange={e => setArchiveSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #e6e6e6',
                  borderRadius: 8,
                  fontSize: 14,
                  boxSizing: 'border-box'
                }}
              />
            </div>
            {archiveLoading && <div>Loading…</div>}
            {!archiveLoading && archivedExamCodes.filter(code => {
              const q = (archiveSearch || '').trim().toLowerCase();
              if (!q) return true;
              const codeText = (code.exam_code || code.code || '').toString().toLowerCase();
              const refText = (code.reference || '').toString().toLowerCase();
              const dateText = (code.date || code.created_at || '').toString().toLowerCase();
              return codeText.includes(q) || refText.includes(q) || dateText.includes(q);
            }).length === 0 && (
              <div style={{ color: '#666', padding: 16 }}>No archived exams.</div>
            )}
            {!archiveLoading && archivedExamCodes.filter(code => {
              const q = (archiveSearch || '').trim().toLowerCase();
              if (!q) return true;
              const codeText = (code.exam_code || code.code || '').toString().toLowerCase();
              const refText = (code.reference || '').toString().toLowerCase();
              const dateText = (code.date || code.created_at || '').toString().toLowerCase();
              return codeText.includes(q) || refText.includes(q) || dateText.includes(q);
            }).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {archivedExamCodes.filter(code => {
                  const q = (archiveSearch || '').trim().toLowerCase();
                  if (!q) return true;
                  const codeText = (code.exam_code || code.code || '').toString().toLowerCase();
                  const refText = (code.reference || '').toString().toLowerCase();
                  const dateText = (code.date || code.created_at || '').toString().toLowerCase();
                  return codeText.includes(q) || refText.includes(q) || dateText.includes(q);
                }).map(code => (
                  <div key={code.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, background: '#fafafa' }}>
                    <div style={{ fontWeight: 700 }}>{code.exam_code || code.code || `ID:${code.id}`}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{code.reference || ''}</div>
                    <div style={{ fontSize: 12, color: '#888' }}>Archived at: {code.archived_at ? new Date(code.archived_at).toLocaleString() : ''}</div>
                    <button
                      onClick={() => restoreExam(code)}
                      style={{
                        marginTop: 8,
                        background: '#54b948',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 12px',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => setShowArchiveModal(false)} style={{ padding: '8px 14px' }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const pdfStyles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 11,
    fontFamily: 'Helvetica'
  },
  headerContainer: {
    marginBottom: 12,
    textAlign: 'center'
  },
  university: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 6
  },
  examCode: {
    fontSize: 11,
    color: '#555',
    marginBottom: 8
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    fontSize: 10,
    color: '#666'
  },

  table: {
    display: 'table',
    width: 'auto',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'solid'
  },
  tableRow: {
    flexDirection: 'row'
  },
  tableHeader: {
    backgroundColor: '#f2f7f2',
    borderBottomWidth: 1,
    borderBottomColor: '#dfeede',
    borderBottomStyle: 'solid'
  },
  th: {
    padding: 8,
    fontSize: 11,
    fontWeight: '700',
    color: '#214b21'
  },
  td: {
    padding: 8,
    fontSize: 11,
    color: '#222'
  },

  colName: { width: '50%' },
  colNumber: { width: '30%' },
  colScore: { width: '20%', textAlign: 'right' },

  rowEven: { backgroundColor: '#ffffff' },
  rowOdd: { backgroundColor: '#fbfdfb' },

  footer: {
    marginTop: 18,
    fontSize: 9,
    color: '#666',
    textAlign: 'right'
  }
});

const GradeReportPDF = ({ examCode, students }) => {
  const dateStr = new Date().toLocaleString();
  const rows = (students || []).map((s, i) => {
    const name = s.name || s.username || 'N/A';
    const number = s.student_number || s.studentNumber || 'N/A';
    const score = (s.score != null ? `${s.score}` : '-') + (s.total_questions ? `/${s.total_questions}` : '');
    return { name, number, score, idx: i };
  });

  return (
    <Document>
        <Page size="A4" style={pdfStyles.page}>
          <View style={pdfStyles.headerContainer}>
            <Text style={pdfStyles.university}>College of St. Catherine - Quezon City</Text>
            <Text style={pdfStyles.reportTitle}>Grade Report </Text>
            <Text style={pdfStyles.examCode}>Exam Code: {examCode || 'N/A'}</Text>
            <Text style={pdfStyles.reportTitle}>Grade Report</Text>
            <Text style={pdfStyles.examCode}>Exam Code: {examCode || 'N/A'}</Text>
          </View>

        <View style={pdfStyles.metaRow}>
          <Text>Generated: {dateStr}</Text>
          <Text>Records: {rows.length}</Text>
        </View>

        <View style={pdfStyles.table}>
          {/* header */}
          <View style={[pdfStyles.tableRow, pdfStyles.tableHeader]}>
            <Text style={[pdfStyles.th, pdfStyles.colName]}>Student Name</Text>
            <Text style={[pdfStyles.th, pdfStyles.colNumber]}>Student Number</Text>
            <Text style={[pdfStyles.th, pdfStyles.colScore]}>Score</Text>
          </View>

          {/* rows */}
          {rows.map((r) => (
            <View key={r.idx} style={[pdfStyles.tableRow, (r.idx % 2 === 0) ? pdfStyles.rowEven : pdfStyles.rowOdd]}>
              <Text style={[pdfStyles.td, pdfStyles.colName]}>{r.name}</Text>
              <Text style={[pdfStyles.td, pdfStyles.colNumber]}>{r.number}</Text>
              <Text style={[pdfStyles.td, pdfStyles.colScore]}>{r.score}</Text>
            </View>
          ))}
        </View>

        <Text style={pdfStyles.footer}>JALAN — Exam Management System</Text>
      </Page>
    </Document>
  );
};

// --- helpers: build Excel blob, PDF blob, zip both and download ---
const buildExcelBlob = (students = []) => {
  // Prepare rows (including header)
  const rows = (students || []).map(s => ({
    Name: s.name || s.username || 'N/A',
    'Student number': s.student_number || s.studentNumber || 'N/A',
    Score: (s.score != null ? `${s.score}` : '-') + (s.total_questions ? `/${s.total_questions}` : '')
  }));

  // Build worksheet
  const ws = XLSX.utils.json_to_sheet(rows, { header: ['Name', 'Student number', 'Score'], skipHeader: false });

  // Calculate optimal column widths (wch) based on content length
  const cols = ['Name', 'Student number', 'Score'];
  const maxLens = cols.map((col, ci) => {
    const headerLen = String(col).length;
    const dataMax = rows.reduce((m, r) => {
      const v = r[col] != null ? String(r[col]) : '';
      return Math.max(m, v.length);
    }, 0);
    return Math.max(headerLen, dataMax);
  });
  ws['!cols'] = maxLens.map(len => ({ wch: Math.min(Math.max(len + 6, 12), 50) })); // padding
      
  // Style header cells with matcha green background and white bold text
  const headerFill = { fgColor: { rgb: '54B948' } }; // matcha green
  const headerFont = { name: 'Arial', sz: 12, bold: true, color: { rgb: 'FFFFFF' } };
  const headerAlign = { vertical: 'center', horizontal: 'left' };

  const A1 = 'A1', B1 = 'B1', C1 = 'C1';
  if (ws[A1]) ws[A1].s = { fill: { patternType: 'solid', bgColor: headerFill, fgColor: headerFill }, font: headerFont, alignment: headerAlign };
  if (ws[B1]) ws[B1].s = { fill: { patternType: 'solid', bgColor: headerFill, fgColor: headerFill }, font: headerFont, alignment: headerAlign };

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Grades');

  const ab = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true });
  return new Blob([ab], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

const buildPdfBlob = async (examCode, students = []) => {
  // use pdf() then updateContainer to avoid runtime errors in some react-pdf versions
  const doc = pdf(); // create PDF instance
  doc.updateContainer(<GradeReportPDF examCode={examCode} students={students} />);
  return await doc.toBlob();
};

const downloadZipWithPdfAndExcel = async ({ examCode, students = [] }) => {
  try {
    const safeCode = (examCode || 'exam').toString().replace(/\s+/g, '-').toLowerCase();
    const excelBlob = buildExcelBlob(students); // synchronous
    const pdfBlob = await buildPdfBlob(examCode, students); // async

    const zip = new JSZip();
    zip.file(`grade-report-${safeCode}.pdf`, pdfBlob);
    zip.file(`grade-report-${safeCode}.xlsx`, excelBlob);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `grade-report-${safeCode}.zip`);
  } catch (err) {
    console.error('Export failed', err);
    alert('Failed to prepare export. See console for details.');
  }
};
// --- end helpers ---

export default GradeReport;
