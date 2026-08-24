import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('checkit_user');
    return raw ? JSON.parse(raw) : null;
  });

  const login = useCallback(async (usuario, password) => {
    const { data } = await api.post('/auth/login', { usuario, password });
    localStorage.setItem('checkit_token', data.token);
    localStorage.setItem('checkit_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('checkit_token');
    localStorage.removeItem('checkit_user');
    setUser(null);
  }, []);

  const isAdmin = user?.rol === 'Administrador';

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
