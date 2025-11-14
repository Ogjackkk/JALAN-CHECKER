// ForgotPasswordModal.jsx
import { useState } from "react";
import { supabase } from "../supabaseClient";

const ForgotPasswordModal = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <form onSubmit={handleSend}>
          <h3>Forgot Password</h3>
          {sent ? (
            <p>Check your email for a password reset link.</p>
          ) : (
            <>
              <label>
                Enter your email:
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              {error && <div className="error-message">{error}</div>}
              <button type="submit" className="btn">
                Send Reset Link
              </button>
            </>
          )}
          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{ marginTop: 10 }}
          >
            Close
          </button>
        </form>
      </div>
    </div>
  );
};

export default ForgotPasswordModal;