import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const AdminSetting = () => {
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
      <h1>Admin Settings</h1>
      <div>
        <button onClick={() => setActiveTab("about")}>About</button>
        <button onClick={() => setActiveTab("logout")} onClick={handleLogout}>Logout</button>
      </div>
      {activeTab === "about" && user && (
        <div>
          <h2>About You</h2>
          <p>Email: {user.email}</p>
          <p>Username: {user.username}</p>
        </div>
      )}
    </div>
  );
};

export default AdminSetting;