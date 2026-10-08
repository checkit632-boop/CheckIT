import { Search, Plus } from 'lucide-react';

// Barra superior del módulo: búsqueda local y botón de nuevo usuario. El
// botón se deshabilita si el rol actual no puede asignar ningún rol.
export default function FiltroUsuarios({ busqueda, onBuscar, onNuevo, puedeCrear }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="relative max-w-xs w-full">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          placeholder="Buscar usuario..."
          value={busqueda}
          onChange={(e) => onBuscar(e.target.value)}
        />
      </div>
      <button
        onClick={onNuevo}
        disabled={!puedeCrear}
        className="ml-auto flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
      >
        <Plus size={16} /> Nuevo Usuario
      </button>
    </div>
  );
}
