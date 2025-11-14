import { Link, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '../supabaseClient';
import "/src/components/style.css"; // Corrected import path

const TeacherDashboard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkGoogleTeacher = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.app_metadata?.provider === 'google') {
        // Check if teacher exists
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!teacher) {
          // Redirect to register page to complete profile
          navigate('/register');
        }
      }
    };
    checkGoogleTeacher();
  }, [navigate]);

  return (
    <div>
      {/* ----------------------------------------------- LOGO --------------------------------------------------------------- */}
      <div className="logo-container">
        <img src="/stcathlogo.png" alt="Logo" className="logo" />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* Improve touch targets for mobile */
        @media (max-width: 760px) {
          .top-icons {
            padding: 10px;
            gap: 16px;
          }
          
          .top-icons a {
            display: block;
            padding: 8px;
          }

          .settings-icon, .pdf-icon {
            width: 32px;
            height: 32px;
            display: block;
          }
        }
      `}} />

      <div className="dashboard-container">
        <header className="dashboard-header">
          <div className="header-text">
            <h1>WELCOME TEACHER</h1>
            <p>
              A web-based system designed to streamline the examination process by storing student scores and providing real-time feedback and data analysis. It works in tandem with a Scantron machine, which is responsible for scanning and checking the exams.
            </p>
          </div>

          {/* TOP RIGHT ICONS - Updated for better mobile touch */}
          <div className="top-icons" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* PDF Icon: Opens bubblesheet.pdf in a new tab */}
            <a 
              href="bubble-sheet.pdf" 
              download
              title="Download Bubblesheet PDF"
              style={{ display: 'block' }}
            >
              <img src="/pdf.png" alt="Download Bubblesheet PDF" className="pdf-icon" />
            </a>
            {/* Settings Icon */}
            <Link 
              to="/setting" 
              title="Settings"
              style={{ display: 'block' }}
            >
              <img src="/Settingss.png" alt="Settings" className="settings-icon" />
            </Link>
          </div>
        </header>

        {/* ----------------------------------------------- DASHBOARD ITEMS --------------------------------------------------------------- */}
        <div className="dashboard">

          {/* Answer Key */}
          <div className="dashboard-item">
            <Link to="/answerKey">
              <div className="icon">
                <img src="/AnswerKeys.png" alt="Answer Key" />
              </div>
              <p>Answer Key</p>
            </Link>
          </div>

          {/* Answer Sheet */}
          <div className="dashboard-item">
            <Link to="/answerSheet">
              <div className="icon">
                <img src="/Sheet.png" alt="Answer Sheet" />
              </div>
              <p>Answer Sheet</p>
            </Link>
          </div>

          {/* Grade Report */}
          <div className="dashboard-item">
            <Link to="/gradeReport">
              <div className="icon">
                <img src="/ReportGrade.png" alt="Grade Report" />
              </div>
              <p>Exam</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherDashboard;
