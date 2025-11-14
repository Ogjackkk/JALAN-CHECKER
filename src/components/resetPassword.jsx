import { useState } from 'react';
import { supabase } from '../supabaseClient';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleReset = async (e) => {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
    }
  };

  return (
    <div className="container">
      <div className="box form-box">
        <h2>Reset Password</h2>
        {done ? (
          <p>Password updated! You can now log in with your new password.</p>
        ) : (
          <form onSubmit={handleReset}>
            <label>
              New Password:
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </label>
            {error && <div className="error-message">{error}</div>}
            <button type="submit" className="btn">Update Password</button>
          </form>
        )}
      </div>
    </div>
  
  );
};

export default ResetPassword;