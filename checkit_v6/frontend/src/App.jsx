import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu } from 'lucide-react';

import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Equipos from './pages/Equipos';
import EntradasSalidas from './pages/EntradasSalidas';
import Resumen from './pages/Resumen';
import Usuarios from './pages/Usuarios';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';

function AppLayout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-gray-900">
      <Sidebar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between bg-surface dark:bg-gray-800 shadow-sm px-4 py-3 shrink-0">
          <button onClick={() => setMenuOpen(true)}>
            <Menu size={28} className="dark:text-gray-100" />
          </button>

          <h1 className="font-bold text-lg text-brand-700 dark:text-brand-400">
            CheckIT
          </h1>

          <div className="w-7" />
        </header>

        <main className="flex-1 flex flex-col min-h-0 overflow-hidden p-4 lg:p-5">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      <Route path="/dashboard" element={
        <ProtectedRoute superAdminOnly>
          <AppLayout>
            <Dashboard />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/entradas-salidas" element={
        <ProtectedRoute>
          <AppLayout>
            <EntradasSalidas />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/equipos" element={
        <ProtectedRoute>
          <AppLayout>
            <Equipos />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/resumen" element={
        <ProtectedRoute adminOnly>
          <AppLayout>
            <Resumen />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/usuarios" element={
        <ProtectedRoute adminOnly>
          <AppLayout>
            <Usuarios />
          </AppLayout>
        </ProtectedRoute>
      } />

      {/* Redirección por defecto a Control de Accesos */}
      <Route path="/" element={<Navigate to="/entradas-salidas" replace />} />
      <Route path="*" element={<Navigate to="/entradas-salidas" replace />} />
    </Routes>
  );
}
