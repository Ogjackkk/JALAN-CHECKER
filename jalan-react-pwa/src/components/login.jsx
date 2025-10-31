import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    identifier: '', // Can be either email or username
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgot, setShowForgot] = useState(false); // State to control the Forgot Password modal

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let email = formData.identifier.trim();

      // If the identifier doesn't include an '@', assume it's a username
      if (!email.includes('@')) {
        // Try to find the user in the teachers table
        const { data: teacherData } = await supabase
          .from('teachers')
          .select('email')
          .eq('username', email)
          .maybeSingle();

        if (teacherData && teacherData.email) {
          email = teacherData.email;
        } else {
          // Try the students table
          const { data: studentData } = await supabase
            .from('students')
            .select('email')
            .eq('username', email)
            .maybeSingle();

          if (studentData && studentData.email) {
            email = studentData.email;
          } else {
            // Finally, try the admins table
            const { data: adminData } = await supabase
              .from('admins')
              .select('email')
              .eq('email', email)
              .maybeSingle();

            if (adminData && adminData.email) {
              email = adminData.email;
            } else {
              alert("User not found.");
              setLoading(false);
              return;
            }
          }
        }
      }

      // Clear any existing session before signing in
      await supabase.auth.signOut();

      // Attempt to sign in with the resolved email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      // Bypass role lookup: if the email matches admin@gmail.com, navigate to admin-home
      if (email.toLowerCase() === 'admin@gmail.com') {
        navigate('/admin-home');
        return;
      }

      // Check student role
      const { data: student } = await supabase
        .from('students')
        .select('*')
        .eq('email', email)
        .single();

      if (student) {
        navigate('/st-home');
        return;
      }

      // Check teacher role
      const { data: teacher } = await supabase
        .from('teachers')
        .select('*')
        .eq('email', email)
        .single();

      if (teacher) {
        navigate('/home');
        return;
      }

      // Check admin role
      const { data: admin } = await supabase
        .from('admins')
        .select('*')
        .eq('email', email)
        .single();

      if (admin) {
        navigate('/admin-home');
        return;
      }

      // Check custom user role
      const { data: custom } = await supabase
        .from('custom_users')
        .select('*')
        .eq('email', email)
        .single();

      if (custom) {
        navigate('/custom');
        return;
      }

      // If not found in any table:
      alert("User role not found. Please contact support.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body {
              background-image: url('/src/img/st cath bf.jpg');
              background-size: cover;
              background-repeat: no-repeat;
              background-position: center;
            }
          `,
        }}
      />
      <div className="container">
        <div className="box form-box">
          <header>Login</header>
          <form onSubmit={handleSubmit}>
            <div className="field input">
              <label htmlFor="identifier">Email or Username</label>
              <input
                type="text"
                name="identifier"
                id="identifier"
                autoComplete="off"
                required
                value={formData.identifier}
                onChange={(e) =>
                  setFormData({ ...formData, identifier: e.target.value })
                }
              />
            </div>

            <div className="field input">
              <label htmlFor="password">Password</label>
              <div className="password-field" style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  id="password"
                  autoComplete="off"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ marginLeft: '8px' }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div className="field">
              <input
                type="submit"
                className="btn"
                name="submit"
                value={loading ? 'Logging in...' : 'Log in'}
                disabled={loading}
              />
              {error && <div className="error-message">{error}</div>}
            </div>

            <div className="link">
              Don't have an account? <Link to="/register">Sign up</Link>
            </div>
            <div className="link">
              <span
                style={{
                  color: "#007bff",
                  textDecoration: "underline",
                  cursor: "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                  font: "inherit"
                }}
                onClick={() => setShowForgot(true)}
              >
                Forgot Password?
              </span>
            </div>
            {showForgot && (
              <ForgotPasswordModal onClose={() => setShowForgot(false)} />
            )}
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;