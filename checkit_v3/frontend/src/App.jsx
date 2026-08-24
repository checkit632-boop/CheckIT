import { Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { Menu } from 'lucide-react';

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

  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-gray-50">

      <Sidebar
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <div className="flex-1 flex flex-col">

        {/* Barra superior solo en celular */}
        <header className="lg:hidden flex items-center justify-between bg-white shadow px-4 py-3">

          <button
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={28}/>
          </button>

          <h1 className="font-bold text-lg text-brand-700">
            CheckIT
          </h1>

          <div className="w-7"/>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">

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
      <Route path="/register" element={<Register />} />

      <Route path="/dashboard" element={
        <ProtectedRoute>
          <AppLayout>
            <Dashboard />
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

      <Route path="/entradas-salidas" element={
        <ProtectedRoute>
          <AppLayout>
            <EntradasSalidas />
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

      <Route path="/generar-qr" element={
        <ProtectedRoute>
          <AppLayout>
            <GenerarQR />
          </AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />

    </Routes>
  );
}