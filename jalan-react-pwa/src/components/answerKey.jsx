const AnswerKey = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { answerKeyId } = location.state || {};

  // Number of questions + answers array
  const [numQuestions, setNumQuestions] = useState(1);
  const [answers, setAnswers] = useState(Array(1).fill(""));

  // State for exam code and modal
  const [examCode, setExamCode] = useState("");
  const [showExamModal, setShowExamModal] = useState(false);
  const [isEditingExamCode, setIsEditingExamCode] = useState(false);

  // Progress bar
  const answeredCount = answers.filter((a) => a !== "").length;
  const progressPercent = Math.round((answeredCount / numQuestions) * 100);

  // New: number of choices (A-D or A-E)
  const [numChoices, setNumChoices] = useState(4);
  const choiceLetters = ["A", "B", "C", "D", "E"].slice(0, numChoices);

  // Load existing data if editing
  useEffect(() => {
    if (answerKeyId) {
      // Fetch existing answer key data from Supabase
      const fetchAnswerKey = async () => {
        const { data } = await supabase
          .from('answer_keys')
          .select('*')
          .eq('id', answerKeyId)
          .single();
        if (data) {
          setNumQuestions(data.num_questions);
          setAnswers(data.answers);
          setExamCode(data.exam_code);
        }
      };
      fetchAnswerKey();
    }
  }, [answerKeyId]);

  const handleNumQuestionsChange = (e) => {
    const value = parseInt(e.target.value);
    setNumQuestions(value);
    setAnswers(Array(value).fill(""));
  };

  const handleSelectAnswer = (index, choice) => {
    const updatedAnswers = [...answers];
    updatedAnswers[index] = choice;
    setAnswers(updatedAnswers);
  };

  const clearAllAnswers = () => {
    setAnswers(Array(numQuestions).fill(""));
  };

  // Check for unanswered questions and exam code, then submit to Supabase
  const submitExamKey = async () => {
    if (examCode.trim() === "" || answeredCount < numQuestions) {
      alert("Please fill in all answers and the exam code.");
      return;
    }

    const { error } = await supabase
      .from('answer_keys')
      .upsert({
        id: answerKeyId,
        exam_code: examCode,
        num_questions: numQuestions,
        answers: answers,
      });

    if (error) {
      alert("Error saving answer key: " + error.message);
    } else {
      alert("Answer key saved successfully!");
      navigate('/answerKey');
    }
  };

  // Open modal when save is clicked
  const handleSave = () => {
    if (window.confirm("Are you sure you want to save the changes?")) {
      submitExamKey();
    }
  };

  // Copy answer key to clipboard
  const handleCopyAnswers = () => {
    navigator.clipboard.writeText(answers.join(", "));
    alert("Answers copied to clipboard!");
  };

  return (
    <div>
      <h2>Manage Answer Key</h2>
      <input
        type="text"
        value={examCode}
        onChange={(e) => setExamCode(e.target.value)}
        placeholder="Exam Code"
      />
      <div>
        <label>Number of Questions:</label>
        <input
          type="number"
          value={numQuestions}
          onChange={handleNumQuestionsChange}
          min="1"
        />
      </div>
      <div>
        {Array.from({ length: numQuestions }, (_, index) => (
          <div key={index}>
            <label>Question {index + 1}:</label>
            {choiceLetters.map((letter) => (
              <label key={letter}>
                <input
                  type="radio"
                  name={`answer-${index}`}
                  checked={answers[index] === letter}
                  onChange={() => handleSelectAnswer(index, letter)}
                />
                {letter}
              </label>
            ))}
          </div>
        ))}
      </div>
      <button onClick={handleSave}>Save Answer Key</button>
      <button onClick={clearAllAnswers}>Clear All Answers</button>
      <button onClick={handleCopyAnswers}>Copy Answers</button>
      <div>
        <progress value={progressPercent} max="100"></progress>
        <span>{progressPercent}% completed</span>
      </div>
    </div>
  );
};

export default AnswerKey;