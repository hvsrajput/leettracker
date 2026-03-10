import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <div className="navbar-brand">
          <span className="brand-icon">⚡</span>
          <span className="brand-text">LeetTracker</span>
        </div>

        <div className="navbar-links">
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="nav-icon">📊</span>
            Dashboard
          </NavLink>
          <NavLink to="/problems" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="nav-icon">💡</span>
            Problems
          </NavLink>
          <NavLink to="/groups" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            <span className="nav-icon">👥</span>
            Groups
          </NavLink>
        </div>

        <div className="navbar-user">
          <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
          <span className="user-name">{user.username}</span>
          <button onClick={handleLogout} className="btn-logout" title="Logout">
            ↗
          </button>
        </div>
      </div>
    </nav>
  );
}
