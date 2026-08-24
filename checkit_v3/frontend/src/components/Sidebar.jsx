import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Laptop,
  ArrowLeftRight,
  FileBarChart2,
  Users,
  QrCode,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: LayoutGrid, adminOnly: false },
  { to: '/equipos', label: 'Equipos', icon: Laptop, adminOnly: false },
  { to: '/entradas-salidas', label: 'Entradas/Salidas', icon: ArrowLeftRight, adminOnly: false },
  { to: '/resumen', label: 'Resumen', icon: FileBarChart2, adminOnly: true },
  { to: '/usuarios', label: 'Usuarios', icon: Users, adminOnly: true },
  { to: '/generar-qr', label: 'Generar QR', icon: QrCode, adminOnly: false },
];

export default function Sidebar({ menuOpen, setMenuOpen }) {
  const { user, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const visibleItems = navItems.filter(
    (item) => !item.adminOnly || isAdmin
  );

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
          fixed lg:static
          top-0 left-0
          z-50
          h-screen
          w-64
          bg-gradient-to-b
          from-brand-950
          via-gray-900
          to-brand-900
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
        <div className="px-5 py-6 border-b border-white/10">

          <div className="flex items-center justify-between">

            <div className="flex items-center gap-3">

              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center font-bold text-lg">
                C
              </div>

              <div>
                <div className="font-bold text-lg">
                  CheckIT
                </div>

                <div className="text-xs text-gray-400">
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
                      ? 'bg-gradient-to-r from-brand-700 to-brand-600 text-white shadow'
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

          <div className="flex items-center gap-3 mb-3">

            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-600 to-brand-400 flex items-center justify-center font-bold text-sm">
              {user?.nombre?.[0]?.toUpperCase() || '?'}
            </div>

            <div className="min-w-0">

              <div className="text-sm font-semibold truncate">
                {user?.nombre} {user?.apellidos}
              </div>

              <div className="text-xs text-brand-400 truncate">
                {user?.rol}
              </div>

            </div>

          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>

        </div>

      </aside>
    </>
  );
}