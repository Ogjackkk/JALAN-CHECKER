import "/src/components/style.css";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "/src/supabaseClient";

const Setting = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("about");
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null); // <-- admin profile (username + email)

  // Fetch user info from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data?.user) {
        setUser(data.user);
        // try to load admin row by auth uid; fallback to email if not found
        const { data: adminData, error: adminError } = await supabase
          .from('admins')
          .select('id, username, email')
          .eq('id', data.user.id)
          .single();
        if (adminData) {
          setAdmin(adminData);
        } else {
          // fallback: maybe admins.id isn't the auth uid, try email match
          const { data: adminByEmail } = await supabase
            .from('admins')
            .select('id, username, email')
            .eq('email', data.user.email)
            .single();
          if (adminByEmail) setAdmin(adminByEmail);
        }
      }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    console.log("User logged out");
    navigate("/login");
  };

  return (
    <div style={{ background: "#f7f7f7", minHeight: "100vh", maxWidth: "100vw", overflow: "hidden" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        /* Navbar mobile helpers */
        .nav-hamburger { display: none; background: transparent; border: none; padding: 6px; cursor: pointer; }
        .nav-hamburger .bar { display:block; width:18px; height:2px; background:#fff; margin:3px 0; border-radius:2px; }
        .mobile-menu-overlay { position: fixed; inset: 0; z-index: 6000; background: rgba(0,0,0,0.35); display:flex; justify-content:flex-end; }
        .mobile-menu {
          width: 84%;
          max-width: 360px;
          background: #fff;
          height: 100%;
          padding: 24px;
          box-sizing: border-box;
        }
        .mobile-menu .mobile-link {
          display: block;
          padding: 14px 16px;
          color: #333;
          text-decoration: none;
          font-weight: 500;
          font-size: 16px;
          margin: 4px 0;
          border: none;
          background: #f5f5f5;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s;
          width: 100%;
          text-align: left;
        }
        .mobile-menu .mobile-link:hover {
          background: #eee;
        }
        @media (max-width: 760px) {
          .nav-hamburger { display: inline-block !important; }
          .settings-sidebar { display: none !important; }
        }
      `}} />

      {/* TOP NAVBAR */}
      <nav style={{
        width: "100%",
        height: "64px",
        background: "#54b948",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 32px",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 100,
        boxShadow: "0 2px 8px #0001",
      }}>
        <div className="nav-left" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link to="/admin-home">
            <img src="/house.png" alt="Back" style={{ width: "32px", marginRight: "12px", cursor: "pointer" }} />
          </Link>
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: "22px", letterSpacing: "1px" }}>
            SETTINGS
          </span>
        </div>

        {/* Hamburger button */}
        <button
          className="nav-hamburger"
          aria-label="Open menu"
          onClick={() => setMobileMenuOpen(true)}
          style={{ background: "transparent", border: "none" }}
        >
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid #eee'
            }}>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Menu</div>
              <button 
                onClick={() => setMobileMenuOpen(false)} 
                style={{ 
                  background: 'transparent', 
                  border: 'none', 
                  fontSize: 20,
                  padding: '8px',
                  cursor: 'pointer',
                  color: '#666'
                }}
              >
                ✕
              </button>
            </div>
            <button 
              className="mobile-link" 
              onClick={() => { setActiveTab('myprofile'); setMobileMenuOpen(false); }}
            >
              My Profile
            </button>
            <button 
              className="mobile-link" 
              onClick={() => { setActiveTab('about'); setMobileMenuOpen(false); }}
            >
              About Jalan
            </button>
            <button 
              className="mobile-link" 
              onClick={() => { setActiveTab('help'); setMobileMenuOpen(false); }}
            >
              Help
            </button>
            <button 
              onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
              style={{ 
                marginTop: '24px',
                width: '100%',
                padding: '14px',
                background: '#ff5252',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}

      <div
        className="settings-container"
        style={{
          display: "flex",
          marginTop: "84px",
          maxWidth: "900px",
          marginLeft: "auto",
          marginRight: "auto",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 4px 24px #0001",
          minHeight: "500px",
        }}
      >
        {/* Sidebar */}
        <div
          className="settings-sidebar"
          style={{
            minWidth: "220px",
            background: "#e8f5e9",
            borderRadius: "16px 0 0 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            padding: "32px 0",
            boxShadow: "2px 0 8px #0001",
          }}
        >
          <button
            onClick={() => setActiveTab("myprofile")}
            style={{
              background: activeTab === "myprofile" ? "#54b948" : "transparent",
              color: activeTab === "myprofile" ? "#fff" : "#388e3c",
              border: "none",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: activeTab === "myprofile" ? "bold" : "500",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s, color 0.2s",
              borderRadius: "8px",
              margin: "0 16px 12px 16px",
            }}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab("about")}
            style={{
              background: activeTab === "about" ? "#54b948" : "transparent",
              color: activeTab === "about" ? "#fff" : "#388e3c",
              border: "none",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: activeTab === "about" ? "bold" : "500",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s, color 0.2s",
              borderRadius: "8px",
              margin: "0 16px 12px 16px",
            }}
          >
            About Jalan
          </button>
          <button
            onClick={() => setActiveTab("help")}
            style={{
              background: activeTab === "help" ? "#54b948" : "transparent",
              color: activeTab === "help" ? "#fff" : "#388e3c",
              border: "none",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: activeTab === "help" ? "bold" : "500",
              cursor: "pointer",
              textAlign: "left",
              transition: "background 0.2s, color 0.2s",
              borderRadius: "8px",
              margin: "0 16px 12px 16px",
            }}
          >
            Help
          </button>
          <button
            onClick={handleLogout}
            style={{
              background: "#e57373",
              color: "#fff",
              border: "none",
              padding: "16px 32px",
              fontSize: "18px",
              fontWeight: "bold",
              cursor: "pointer",
              textAlign: "left",
              borderRadius: "8px",
              margin: "0 16px 0 16px",
              marginTop: "auto",
              boxShadow: "0 2px 8px #e5737380",
            }}
          >
            Logout
          </button>
        </div>

        {/* Content */}
        <div
          className="settings-content"
          style={{
            flex: 1,
            padding: "40px 48px",
            overflowY: "auto",
            borderRadius: "0 16px 16px 0",
          }}
        >
          {activeTab === "myprofile" && (
            <div className="profile-section">
              <h2 style={{ fontWeight: "bold", color: "#54b948", marginBottom: "18px" }}>My Profile</h2>
              {(user || admin) ? (
                <div style={{
                  background: "#f7f7f7",
                  borderRadius: "12px",
                  padding: "24px",
                  boxShadow: "0 2px 8px #0001",
                  maxWidth: "400px",
                  marginBottom: "24px"
                }}>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "#388e3c" }}>Username:</strong>
                    <span style={{ marginLeft: "8px", color: "#333" }}>{admin?.username ?? "N/A"}</span>
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <strong style={{ color: "#388e3c" }}>Email:</strong>
                    <span style={{ marginLeft: "8px", color: "#333" }}>{admin?.email ?? user?.email}</span>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#888" }}>Loading user information...</p>
              )}
            </div>
          )}

          {activeTab === "about" && (
            <div className="about-section">
              <h2 style={{ fontWeight: "bold", color: "#54b948", marginBottom: "18px" }}>About Jalan</h2>
              <p style={{ fontSize: "18px", color: "#333", marginBottom: "18px" }}>
                <strong>JALAN</strong>: A Progressive Web Application Based Exam Checker with Real-Time Feedback Score and Data Analysis for College of St. Catherine Quezon City
              </p>
              <p style={{ fontSize: "16px", color: "#444", marginBottom: "12px" }}>
                JALAN is a modern, web-based examination system designed to streamline the assessment process through automation and real-time data analysis. By integrating with a Scantron machine, JALAN processes scanned exam sheets and delivers instant, accurate feedback—eliminating the inefficiencies and errors of traditional manual grading.
              </p>
              <p style={{ fontSize: "16px", color: "#444", marginBottom: "12px" }}>
                Drawing on findings by Ronnel C. et al. (2021), which demonstrated that Optical Mark Recognition (OMR) systems dramatically improve grading speed and accuracy compared to manual methods, JALAN harnesses these benefits to ensure reliable and efficient evaluation.
              </p>
              <p style={{ fontSize: "16px", color: "#444", marginBottom: "12px" }}>
                The system incorporates advanced technologies—such as Optical Character Recognition (OCR) and sentence embedding (Nithin, Y. et al., 2021)—to automatically assess both objective and descriptive answers, thereby enhancing the overall fairness and precision of academic assessments.
              </p>
              <p style={{ fontSize: "16px", color: "#444", marginBottom: "12px" }}>
                Designed specifically for the College of St. Catherine Quezon City, JALAN not only automates the grading process but also provides educators with valuable analytics. These insights support data-driven decision-making, helping teachers to identify learning trends and improve pedagogical strategies.
              </p>
              <p style={{ fontSize: "16px", color: "#444" }}>
                Ultimately, JALAN represents a significant innovation in examination management, reducing manual workload while ensuring that students receive prompt and accurate feedback to foster a more effective learning environment.
              </p>
            </div>
          )}

          {activeTab === "help" && (
            <div className="help-section">
              <h2 style={{ fontWeight: "bold", color: "#54b948", marginBottom: "18px" }}>Help</h2>
              <p style={{ fontSize: "16px", color: "#444" }}>
                This is a placeholder for the Help section. Content to be added later.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Setting;
