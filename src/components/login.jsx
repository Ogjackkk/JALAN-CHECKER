import "/src/components/style.css";
import { Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import ForgotPasswordModal from './ForgotPasswordModal';

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
      let role = null;

      // First check if input is email or username
      if (!email.includes('@')) {
        // Check admins first
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('email, username')
          .eq('username', email)
          .single();

        if (!adminError && adminData) {
          email = adminData.email;
          role = 'admin';
        } else {
          // Check teachers
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('email, username')
            .eq('username', email)
            .single();

          if (!teacherError && teacherData) {
            email = teacherData.email;
            role = 'teacher';
          }
        }
      } else {
        // Direct email login - check both tables
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('email')
          .eq('email', email)
          .single();

        if (!adminError && adminData) {
          role = 'admin';
        } else {
          const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('email')
            .eq('email', email)
            .single();

          if (!teacherError && teacherData) {
            role = 'teacher';
          }
        }
      }

      if (!role) {
        setError("User not found. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Sign in with Supabase Auth
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });

      if (signInError) {
        setError(signInError.message);
        return;
      }

      if (data?.user) {
        // Store role in localStorage for persistence
        localStorage.setItem('userRole', role);
        
        // Navigate based on role
        navigate(role === 'admin' ? '/admin-home' : '/home', { replace: true });
      }

    } catch (err) {
      console.error('Login error:', err);
      setError("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Google login handler
  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/login'
      }
    });
    if (error) {
      setError(error.message);
    }
  };

  // Check for Google user after redirect
  useEffect(() => {
    const checkGoogleUser = async () => {
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
        } else {
          navigate('/home');
        }
      }
    };
    checkGoogleUser();
  }, [navigate]);

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
              <label htmlFor="identifier">Email</label>
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
            <div className="field">
              <button
                type="button"
                className="btn"
                style={{ width: '100%', marginTop: '8px', background: '#4285F4', color: '#fff' }}
                onClick={handleGoogleLogin}
              >
                Login with Google
              </button>
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
