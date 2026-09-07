import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, adminOnly = false, superAdminOnly = false }) {
  const { user, isAdmin, isSuperAdmin } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/entradas-salidas" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/entradas-salidas" replace />;

  return children;
}
