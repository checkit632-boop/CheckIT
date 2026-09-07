import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('checkit_user');
    return raw ? JSON.parse(raw) : null;
  });

  // Primer/segundo factor (usuario + contraseña). Si el backend responde
  // requiereCodigo=true, el tercer factor debe completarse con verifyLoginCode.
  const login = useCallback(async (usuario, password) => {
    const { data } = await api.post('/auth/login', { usuario, password });
    if (data.requiereCodigo) {
      return { requiereCodigo: true, id_usuario: data.id_usuario, mensaje: data.mensaje, dev_codigo: data.dev_codigo };
    }
    localStorage.setItem('checkit_token', data.token);
    localStorage.setItem('checkit_user', JSON.stringify(data.user));
    setUser(data.user);
    return { requiereCodigo: false, user: data.user };
  }, []);

  // Tercer factor de seguridad: código de 6 dígitos enviado al correo.
  const verifyLoginCode = useCallback(async (id_usuario, codigo) => {
    const { data } = await api.post('/auth/login/codigo', { id_usuario, codigo });
    localStorage.setItem('checkit_token', data.token);
    localStorage.setItem('checkit_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  }, []);

  const resendLoginCode = useCallback(async (id_usuario) => {
    const { data } = await api.post('/auth/login/reenviar', { id_usuario });
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('checkit_token');
    localStorage.removeItem('checkit_user');
    setUser(null);
  }, []);

  const isSuperAdmin = user?.rol === 'Super Administrador';
  const isAdmin = isSuperAdmin || user?.rol === 'Administrador';

  return (
    <AuthContext.Provider value={{ user, login, verifyLoginCode, resendLoginCode, logout, isAdmin, isSuperAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
