import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
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

  const token = localStorage.getItem('token');
  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
