import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

const Admin = () => {
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchMessage, setBatchMessage] = useState("");
  const [parsedStudents, setParsedStudents] = useState([]);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const studentsPerPage = 10;

  const handleStudentExcelUpload = async (event) => {
    // Logic to handle Excel file upload and parsing
  };

  const saveParsedStudents = async () => {
    // Logic to save parsed students to Supabase in batches
  };

  const filteredStudents = parsedStudents.filter(student => 
    student.student_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  return (
    <div>
      <h1>Admin Dashboard</h1>
      <input 
        type="text" 
        placeholder="Search students..." 
        value={searchTerm} 
        onChange={(e) => setSearchTerm(e.target.value)} 
      />
      <button onClick={handleStudentExcelUpload}>Upload Students</button>
      {batchProcessing && <p>{batchMessage}</p>}
      <ul>
        {currentStudents.map(student => (
          <li key={student.id}>{student.username} - {student.student_number}</li>
        ))}
      </ul>
      {/* Pagination controls can be added here */}
    </div>
  );
};

export default Admin;