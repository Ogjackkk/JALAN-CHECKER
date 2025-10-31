import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import "/src/components/style.css";

const yearLevels = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const terms = ["1st Term", "2nd Term"];

const AnswerSheet = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [answerKeys, setAnswerKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    async function fetchData() {
      // Fetch answer keys from the database
      const { data, error } = await supabase.from('answer_keys').select('*');
      if (error) {
        console.error("Error fetching answer keys:", error);
      } else {
        setAnswerKeys(data);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const navigateWithRefresh = (path, state = {}) => {
    navigate(path, { state });
    window.location.reload();
  };

  const handleEdit = (id) => {
    navigate(`/answerKey`, { state: { answerKeyId: id } });
  };

  const handleDelete = async (id) => {
    setDeleteId(id);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    const { error } = await supabase.from('answer_keys').delete().eq('id', deleteId);
    if (error) {
      console.error("Error deleting answer key:", error);
    } else {
      setAnswerKeys(answerKeys.filter(key => key.id !== deleteId));
    }
    setShowDeleteModal(false);
  };

  const formatAnswerKey = (answers) => {
    return answers.join(", ");
  };

  const handleCopyAnswers = (answers) => {
    navigator.clipboard.writeText(formatAnswerKey(answers));
    alert("Answer key copied to clipboard!");
  };

  const filteredKeys = answerKeys.filter((key) =>
    key.exam_code?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    return () => {
      setShowDeleteModal(false);
    };
  }, [location.pathname]);

  return (
    <div className="dashboard-container">
      <nav className="top-navbar">
        <Link to="/home">
          <img src="/src/img/house.png" alt="Back" />
        </Link>
        <span>ANSWER SHEET</span>
      </nav>

      <div className="main-content">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search by exam code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {loading ? (
          <div>Loading...</div>
        ) : filteredKeys.length === 0 ? (
          <p>No answer keys found for your account.</p>
        ) : (
          <div>
            {filteredKeys.map((key) => (
              <div key={key.id} className="answer-key-card">
                <p>{key.exam_code}</p>
                <button onClick={() => handleEdit(key.id)}>Edit</button>
                <button onClick={() => handleDelete(key.id)}>Delete</button>
                <button onClick={() => handleCopyAnswers(key.answers)}>Copy</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="modal">
          <h3>Delete Answer Key?</h3>
          <p>This action cannot be undone.</p>
          <button onClick={() => setShowDeleteModal(false)}>Cancel</button>
          <button onClick={confirmDelete}>Delete</button>
        </div>
      )}
    </div>
  );
};

export default AnswerSheet;