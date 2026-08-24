import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Equipos from './pages/Equipos';
import EntradasSalidas from './pages/EntradasSalidas';
import Resumen from './pages/Resumen';
import Usuarios from './pages/Usuarios';
import GenerarQR from './pages/GenerarQR';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-6 sm:p-8 overflow-x-hidden">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={
        <ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>
      } />
      <Route path="/equipos" element={
        <ProtectedRoute><AppLayout><Equipos /></AppLayout></ProtectedRoute>
      } />
      <Route path="/entradas-salidas" element={
        <ProtectedRoute><AppLayout><EntradasSalidas /></AppLayout></ProtectedRoute>
      } />
      <Route path="/resumen" element={
        <ProtectedRoute adminOnly><AppLayout><Resumen /></AppLayout></ProtectedRoute>
      } />
      <Route path="/usuarios" element={
        <ProtectedRoute adminOnly><AppLayout><Usuarios /></AppLayout></ProtectedRoute>
      } />
      <Route path="/generar-qr" element={
        <ProtectedRoute><AppLayout><GenerarQR /></AppLayout></ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
