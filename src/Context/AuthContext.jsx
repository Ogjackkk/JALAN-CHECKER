import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          
          // First check admin table
          const { data: adminData } = await supabase
            .from('admins')
            .select('email')
            .eq('email', session.user.email)
            .single();

          if (adminData) {
            setUserRole('admin');
            localStorage.setItem('userRole', 'admin');
          } else {
            // Then check teacher table
            const { data: teacherData } = await supabase
              .from('teachers')
              .select('email')
              .eq('email', session.user.email)
              .single();

            if (teacherData) {
              setUserRole('teacher');
              localStorage.setItem('userRole', 'teacher');
            }
          }
        } else {
          setUser(null);
          setUserRole(null);
          localStorage.removeItem('userRole');
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        setUser(session.user);
        const role = localStorage.getItem('userRole');
        if (role) {
          setUserRole(role);
        }
      } else {
        setUser(null);
        setUserRole(null);
        localStorage.removeItem('userRole');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [navigate]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    localStorage.removeItem('userRole');
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, userRole, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};