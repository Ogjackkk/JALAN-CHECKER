import "/src/components/style.css";
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { supabase } from '../supabaseClient';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    teacherIdNumber: '', // <-- Added
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

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

    // IMPORTANT: Use the auth user id as the teacher id.
    const teacherId = authData.user.id;

    // Use upsert to insert or update teacher record
    const { error: dbError } = await supabase
      .from('teachers')
      .upsert([
        {
          id: teacherId,
          teacher_id_number: teacherIdNumber, // <-- Added
          username,
          email
        }
      ], { onConflict: 'email' });

    if (dbError) {
      alert(dbError.message);
      return;
    }

    // Redirect teacher to the teacher dashboard
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
      <div className="logo-container">
        <img src="/src/img/stcathlogo.png" alt="Logo" className="logo" />
      </div>
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
            <div className="link">
              Already have an account? <Link to="/login">Log in</Link>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Register;
