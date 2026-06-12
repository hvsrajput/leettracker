import { createContext, useState, useEffect } from 'react';
import * as authApi from '@/features/auth/services/authApi';

export const AuthContext = createContext(null);

// The session JWT now lives in an HttpOnly cookie (unreadable from JS). We keep
// only the non-sensitive user object in localStorage so the first render already
// has the correct user — the cookie's validity is confirmed in the background.
const readStoredUser = () => {
  const savedUser = localStorage.getItem('user');
  if (!savedUser) return null;
  try {
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readStoredUser);
  // Session is resolved synchronously from storage, so we never block on bootstrap.
  const [loading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('user')) return;

    // Confirm the cookie is still valid in the background so the app renders
    // immediately. A 401 here is handled by the api interceptor (clears user +
    // redirects); we also clear local state so the UI updates in place.
    authApi.getCurrentUser()
      .then(res => {
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
      })
      .catch(() => {
        localStorage.removeItem('user');
        setUser(null);
      });
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    // Token is set as an HttpOnly cookie by the server; we only persist the user.
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (username, email, password) => {
    const res = await authApi.register(username, email, password);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = async () => {
    // Ask the server to clear the cookie; clear local state regardless of outcome.
    try {
      await authApi.logout();
    } catch {
      // Network/Server error — the cookie may persist, but locally we're logged out.
    }
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (newUser) => {
    setUser(newUser);
    localStorage.setItem('user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
