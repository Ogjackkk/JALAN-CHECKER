import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const Setting = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("about");
  const [user, setUser] = useState(null);

  // Fetch user info from Supabase
  useEffect(() => {
    const fetchUserInfo = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error fetching user info:", error);
      } else {
        setUser(data.user);
      }
    };
    fetchUserInfo();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
    } else {
      navigate('/login');
    }
  };

  return (
    <div>
      <h1>User Settings</h1>
      {user && (
        <div>
          <p>Welcome, {user.email}</p>
          <button onClick={handleLogout}>Logout</button>
        </div>
      )}
      <div>
        <h2>Settings</h2>
        <button onClick={() => setActiveTab("about")}>About</button>
        <button onClick={() => setActiveTab("preferences")}>Preferences</button>
        {/* Add more tabs as needed */}
      </div>
      {activeTab === "about" && <div>About content goes here.</div>}
      {activeTab === "preferences" && <div>Preferences content goes here.</div>}
    </div>
  );
};

export default Setting;