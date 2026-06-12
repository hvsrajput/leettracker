import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/hooks/useAuth';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        color: 'var(--text-secondary)'
      }}>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  // The session is a cookie now (not readable here); gate on the user object.
  // If the cookie is actually stale, the background /auth/me check and the api
  // 401 interceptor will clear the user and redirect.
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
