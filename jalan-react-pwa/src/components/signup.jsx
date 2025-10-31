import "/src/components/style.css";
import { Link } from 'react-router-dom';

const SignUp = () => {
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
          <header>ROLE</header>
          <p>Please select your role:</p>
          <div className="field">
            <Link to="/st-register">Student</Link>
            <Link to="/register">Teacher</Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SignUp;