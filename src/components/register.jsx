import "/src/components/style.css";
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../supabaseClient';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    teacherIdNumber: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  // For Google signup modal
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleProfile, setGoogleProfile] = useState({
    teacherIdNumber: '',
    username: '',
  });

  const [showConfirmNotice, setShowConfirmNotice] = useState(false);

  const handleChange = (e) =>
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { teacherIdNumber, username, email, password, confirmPassword } = formData;

    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      alert(authError.message);
      return;
    }

    const teacherId = authData.user.id;

    const { error: dbError } = await supabase
      .from('teachers')
      .upsert([
        {
          id: teacherId,
          teacher_id_number: teacherIdNumber,
          username,
          email
        }
      ], { onConflict: 'email' });

    if (dbError) {
      alert(dbError.message);
      return;
    }

    setShowConfirmNotice(true);
  };

  // Google signup handler
  const handleGoogleSignUp = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/register'
      }
    });
    if (error) {
      alert(error.message);
    }
  };

  // Check for Google user after redirect
  useState(() => {
    const checkGoogleUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.app_metadata?.provider === 'google') {
        // Check if teacher already exists
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('id', user.id)
          .single();

        if (!teacher) {
          setShowGoogleModal(true);
          setGoogleProfile({
            teacherIdNumber: '',
            username: user.user_metadata?.full_name || ''
          });
        } else {
          navigate('/home');
        }
      }
    };
    checkGoogleUser();
  }, []);

  // Handle Google profile modal submit
  const handleGoogleProfileSubmit = async (e) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('teachers').insert([{
      id: user.id,
      teacher_id_number: googleProfile.teacherIdNumber,
      username: googleProfile.username,
      email: user.email
    }]);
    setShowGoogleModal(false);
    navigate('/home');
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
          <header>Teacher Registration</header>
          <form onSubmit={handleSubmit}>
            <div className="field input">
              <label htmlFor="teacherIdNumber">Teacher ID Number</label>
              <input
                type="text"
                name="teacherIdNumber"
                id="teacherIdNumber"
                autoComplete="off"
                required
                onChange={handleChange}
              />
            </div>
            <div className="field input">
              <label htmlFor="username">Full Name</label>
              <input
                type="text"
                name="username"
                id="username"
                autoComplete="off"
                required
                onChange={handleChange}
              />
            </div>
            <div className="field input">
              <label htmlFor="email">Email</label>
              <input
                type="text"
                name="email"
                id="email"
                autoComplete="off"
                required
                onChange={handleChange}
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
                  onChange={handleChange}
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
            <div className="field input">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-field" style={{ display: 'flex', alignItems: 'center' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  name="confirmPassword"
                  id="confirmPassword"
                  autoComplete="off"
                  required
                  onChange={handleChange}
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
              <input type="submit" className="btn" name="submit" value="Sign up" />
            </div>
            <div className="field">
              <button
                type="button"
                className="btn"
                style={{ width: '100%', marginTop: '8px', background: '#4285F4', color: '#fff' }}
                onClick={handleGoogleSignUp}
              >
                Sign up with Google
              </button>
            </div>
            <div className="link">
              Already have an account? <Link to="/login">Log in</Link>
            </div>
          </form>
          {showConfirmNotice && (
            <div className="confirmation-notice">
              Registration successful! Please check your email and click the confirmation link before logging in.
            </div>
          )}
        </div>
      </div>
      {/* Google profile modal */}
      {showGoogleModal && (
        <div className="modal-overlay">
          <div className="modal modern-modal">
            <form onSubmit={handleGoogleProfileSubmit} className="modern-modal-form">
              <div className="modal-header">
                <img src="stcathlogo.png" alt="Logo" className="modal-logo" />
                <h2>Complete Your Profile</h2>
                <p className="modal-desc">
                  Welcome! Please provide your Teacher ID Number and Full Name to finish your registration.
                </p>
              </div>
              <div className="modal-fields">
                <label>
                  <span>Teacher ID Number</span>
                  <input
                    type="text"
                    value={googleProfile.teacherIdNumber}
                    onChange={e => setGoogleProfile({ ...googleProfile, teacherIdNumber: e.target.value })}
                    required
                    placeholder="Enter your Teacher ID Number"
                  />
                </label>
                <label>
                  <span>Full Name</span>
                  <input
                    type="text"
                    value={googleProfile.username}
                    onChange={e => setGoogleProfile({ ...googleProfile, username: e.target.value })}
                    required
                    placeholder="Enter your full name"
                  />
                </label>
              </div>
              <button type="submit" className="btn modern-btn">Save & Continue</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default Register;
