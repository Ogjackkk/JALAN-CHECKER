import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, userRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    // Redirect to login but save the attempted location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(userRole)) {
    // Redirect to appropriate home page based on role
    const homePath = userRole === 'admin' ? '/admin-home' : '/home';
    return <Navigate to={homePath} replace />;
  }

  return children;
};

export const PublicRoute = ({ children }) => {
  const { user, userRole } = useAuth();

    if (user && userRole) {
// Redirect to appropriate home page based on role only if role is set
    const homePath = userRole === 'admin' ? '/admin-home' : '/home';
    return <Navigate to={homePath} replace />;
  }

  return children;

};
