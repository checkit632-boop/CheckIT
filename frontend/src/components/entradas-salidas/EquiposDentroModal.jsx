// Ventana que se abre al pulsar la tarjeta "Equipos Dentro" de Control de
// Acceso: lista los equipos que están adentro en este momento, con los datos
// de su propietario, para ubicar rápido a quién pertenece un equipo.
import { useEffect, useMemo, useState } from 'react';
import { Search, Laptop, UserRound, Clock, RefreshCw } from 'lucide-react';
import api from '../../api/client';
import Modal from '../Modal';
import { fmtHora } from '../../utils/fechas';

const coincide = (eq, texto) =>
  [eq.serial, eq.nombre_marca, eq.modelo, eq.persona_nombres, eq.persona_apellidos, eq.numero_documento]
    .join(' ')
    .toLowerCase()
    .includes(texto);

export default function EquiposDentroModal({ open, onClose, onCargado }) {
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargar = async () => {
    setCargando(true);
    setError('');
    try {
      const { data } = await api.get('/registros/dentro');
      setEquipos(data);
      // Mantiene el número de la tarjeta igual a la lista que se ve.
      onCargado?.(data.length);
    } catch (err) {
      setError('No se pudo cargar la lista de equipos dentro.');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setBusqueda('');
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- se recarga solo al abrir la ventana
  }, [open]);

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return t ? equipos.filter((eq) => coincide(eq, t)) : equipos;
  }, [equipos, busqueda]);

  return (
    <Modal open={open} onClose={onClose} title={`Equipos dentro (${equipos.length})`} maxWidth="max-w-4xl">
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input
            autoFocus
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por serial, equipo, propietario o documento..."
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={cargar}
          disabled={cargando}
          title="Actualizar lista"
          aria-label="Actualizar lista"
          className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <RefreshCw size={16} className={cargando ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-300 mb-3">{error}</p>}

      <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-50 dark:bg-brand-900/30 text-gray-700 dark:text-gray-300 text-[11px] uppercase tracking-wide sticky top-0">
              <tr>
                <th className="text-left px-4 py-2.5">Equipo</th>
                <th className="text-left px-4 py-2.5">Propietario</th>
                <th className="text-left px-4 py-2.5">Entrada</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
              {cargando && equipos.length === 0 && (
                <tr><td colSpan={3} className="text-center text-gray-500 dark:text-gray-400 py-10">Cargando...</td></tr>
              )}
              {!cargando && filtrados.length === 0 && (
                <tr>
                  <td colSpan={3} className="text-center text-gray-500 dark:text-gray-400 py-10">
                    {equipos.length === 0 ? 'No hay equipos dentro en este momento.' : 'Ningún equipo coincide con la búsqueda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((eq) => (
                <tr key={eq.id_equipo} className="hover:bg-gray-50 dark:hover:bg-gray-700/40 align-top">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Laptop size={15} className="mt-0.5 shrink-0 text-brand-600 dark:text-brand-400" />
                      <div>
                        <div className="font-semibold">{eq.nombre_marca} {eq.modelo}</div>
                        <div className="font-mono-num text-xs font-bold text-brand-700 dark:text-brand-300">{eq.serial}</div>
                        {!eq.activo && <div className="text-[11px] font-semibold text-red-600 dark:text-red-300">Equipo inactivo</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <UserRound size={15} className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" />
                      <div>
                        <div className="font-semibold">{eq.persona_nombres} {eq.persona_apellidos}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {eq.tipo_documento}: <span className="font-mono-num">{eq.numero_documento}</span>
                        </div>
                        {eq.celular && <div className="text-xs text-gray-600 dark:text-gray-400">Celular: {eq.celular}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      <Clock size={15} className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400" />
                      <div>
                        <div className="font-mono-num text-xs">{fmtHora(eq.fecha_entrada)}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">Registró: {eq.registrado_por}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {busqueda && (
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          Mostrando {filtrados.length} de {equipos.length}.
        </p>
      )}
    </Modal>
  );
}
