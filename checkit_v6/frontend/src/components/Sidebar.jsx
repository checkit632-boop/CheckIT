import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Laptop,
  FileBarChart2,
  Users,
  LogOut,
  X,
  Sun,
  Moon,
  ArrowUpDown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/dashboard', label: 'Auditoría', icon: LayoutGrid, superAdminOnly: true },
  { to: '/entradas-salidas', label: 'Control de Acceso', icon: ArrowUpDown, adminOnly: false },
  { to: '/equipos', label: 'Registro de Equipos', icon: Laptop, adminOnly: false },
  { to: '/resumen', label: 'Historial de Movimientos', icon: FileBarChart2, adminOnly: true },
  { to: '/usuarios', label: 'Registro de Usuarios', icon: Users, adminOnly: true },
];

export default function Sidebar({ menuOpen, setMenuOpen }) {
  const { user, isAdmin, isSuperAdmin, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const visibleItems = navItems.filter((item) => {
    if (item.superAdminOnly) return isSuperAdmin;
    return !item.adminOnly || isAdmin;
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Fondo oscuro cuando el menú está abierto */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:sticky
          top-0 left-0
          z-50
          h-screen
          w-64
          flex-shrink-0
          bg-brand-900
          text-white
          flex
          flex-col
          transition-transform
          duration-300
          ${menuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        {/* Encabezado */}
        <div className="px-5 py-6 border-b border-white/40">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">
                <img src="/logo.png" alt="Logo CheckIT" className="w-8 h-8 object-contain" />
              </div>

              <div>
                <div className="font-bold text-2xl">
                  CheckIT
                </div>

                <div className="text-xs text-gray-300">
                  Sistema de Control
                </div>
              </div>

            </div>

            <button
              className="lg:hidden"
              onClick={() => setMenuOpen(false)}
            >
              <X size={24} />
            </button>

          </div>

        </div>

        {/* Menú */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">

          <div className="text-[.68rem] font-bold tracking-wider text-gray-400 uppercase px-2 mb-2">
            Menú
          </div>

          <div className="flex flex-col gap-1">

            {visibleItems.map(({ to, label, icon: Icon }) => (

              <NavLink
                key={to}
                to={to}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white/15 text-white shadow ring-1 ring-white/10'
                      : 'text-gray-300 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon size={18} />
                <span>{label}</span>
              </NavLink>

            ))}

          </div>

        </nav>

        {/* Usuario */}
        <div className="px-4 py-4 border-t border-white/10">

          <button
            onClick={toggleTheme}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-xs font-medium text-gray-300 hover:text-white transition-colors mb-3"
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
            {isDark ? 'Modo claro' : 'Modo oscuro'}
          </button>

          <div className="flex items-center gap-3 mb-3">

            <div className="w-9 h-9 rounded-full bg-brand-400 flex items-center justify-center font-bold text-sm">
              {user?.nombre?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="min-w-0">

              <div className="text-sm font-semibold truncate">
                {user?.nombre} {user?.apellidos}
              </div>

              <div className="text-xs text-brand-300 truncate">
                {user?.rol}
              </div>

            </div>

          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/30 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>

        </div>

      </aside>
    </>
  );
}
