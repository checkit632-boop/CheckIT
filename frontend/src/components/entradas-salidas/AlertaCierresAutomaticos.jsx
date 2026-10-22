// Alerta de "equipos que quedaron dentro" en Control de Accesos.
//
// El reinicio operativo de las 11:59 p. m. registra una salida automática a
// los equipos que seguían adentro (por ejemplo, un funcionario que deja su
// portátil en el centro varios días). Para que el vigilante sepa que esos
// equipos en realidad no salieron por la portería, al iniciar sesión se le
// muestra esta ventana con los equipos del último cierre y su propietario.
// Se abre sola una vez por inicio de sesión; después queda un aviso en la
// pantalla para volver a consultarla.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import api from '../../api/client';
import Modal from '../Modal';
import { fmtHora } from '../../utils/fechas';

// Identifica el inicio de sesión actual (cada login genera un token nuevo).
function claveSesion(fechaReinicio) {
  try {
    const token = localStorage.getItem('checkit_token') || '';
    return `checkit_alerta_cierres|${token.slice(-24)}|${fechaReinicio}`;
  } catch {
    return null;
  }
}

function yaVista(clave) {
  try { return clave ? sessionStorage.getItem(clave) === '1' : false; } catch { return false; }
}

function marcarVista(clave) {
  try { if (clave) sessionStorage.setItem(clave, '1'); } catch { /* sin almacenamiento: se mostrará de nuevo */ }
}

export default function AlertaCierresAutomaticos({ onAbiertaCambio }) {
  const [datos, setDatos] = useState({ fecha_reinicio: null, equipos: [] });
  const [abierta, setAbierta] = useState(false);
  const [busqueda, setBusqueda] = useState('');

  useEffect(() => {
    api.get('/registros/cierres-automaticos')
      .then(({ data }) => {
        setDatos(data);
        if (data.equipos.length > 0 && !yaVista(claveSesion(data.fecha_reinicio))) setAbierta(true);
      })
      .catch(() => {});
  }, []);

  // Mientras la ventana está abierta, la pistola lectora no registra movimientos.
  useEffect(() => { onAbiertaCambio?.(abierta); }, [abierta, onAbiertaCambio]);

  const cerrar = () => {
    marcarVista(claveSesion(datos.fecha_reinicio));
    setAbierta(false);
  };

  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    if (!t) return datos.equipos;
    return datos.equipos.filter((e) =>
      [e.serial, e.nombre_marca, e.modelo, e.persona_nombres, e.persona_apellidos, e.numero_documento]
        .join(' ').toLowerCase().includes(t)
    );
  }, [datos.equipos, busqueda]);

  const total = datos.equipos.length;
  if (total === 0) return null;

  return (
    <>
      {/* Aviso permanente mientras haya cierres en el último reinicio. */}
      <div className="shrink-0 mb-3 flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
        <AlertTriangle size={16} className="shrink-0" />
        <span className="flex-1">
          <strong>{total} {total === 1 ? 'equipo quedó' : 'equipos quedaron'} dentro</strong> y el sistema les registró la salida automáticamente en el cierre del {fmtHora(datos.fecha_reinicio)}.
        </span>
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="shrink-0 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold px-3 py-1.5"
        >
          Ver equipos
        </button>
      </div>

      <Modal open={abierta} onClose={cerrar} title="Equipos que quedaron dentro" maxWidth="max-w-4xl">
        <div className="flex gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
          <AlertTriangle size={20} className="shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            Estos equipos <strong>no registraron su salida</strong> por la portería. En el cierre del{' '}
            <strong>{fmtHora(datos.fecha_reinicio)}</strong> el sistema les registró una <strong>salida automática</strong>,
            así que ahora figuran afuera, pero <strong>es posible que sigan dentro del centro</strong>. Tenlo en cuenta si el
            propietario se acerca a retirarlo.
          </p>
        </div>

        {total > 5 && (
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por serial, equipo, propietario o documento..."
              className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
        )}

        <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="max-h-[45vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-950/30 text-gray-700 dark:text-gray-300 text-[11px] uppercase tracking-wide sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2.5">Equipo</th>
                  <th className="text-left px-4 py-2.5">Propietario</th>
                  <th className="text-left px-4 py-2.5">Entró</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                {filtrados.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-gray-500 dark:text-gray-400 py-8">Ningún equipo coincide con la búsqueda.</td></tr>
                )}
                {filtrados.map((e) => (
                  <tr key={`${e.id_equipo}-${e.fecha_cierre}`} className="align-top">
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.nombre_marca} {e.modelo}</div>
                      <div className="font-mono-num text-xs font-bold text-brand-700 dark:text-brand-300">{e.serial}</div>
                      {e.tiene_movimiento_posterior && (
                        <span className="inline-block mt-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 text-[11px] font-semibold px-2 py-0.5">
                          Ya volvió a registrar movimiento
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{e.persona_nombres} {e.persona_apellidos}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {e.tipo_documento}: <span className="font-mono-num">{e.numero_documento}</span>
                      </div>
                      {e.celular && <div className="text-xs text-gray-600 dark:text-gray-400">Celular: {e.celular}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-mono-num text-xs">{e.fecha_entrada ? fmtHora(e.fecha_entrada) : '—'}</div>
                      {e.entrada_registrada_por && (
                        <div className="text-xs text-gray-600 dark:text-gray-400">Registró: {e.entrada_registrada_por}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end mt-4">
          <button
            type="button"
            autoFocus
            onClick={cerrar}
            className="bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm px-6 py-2.5 rounded-xl"
          >
            Entendido
          </button>
        </div>
      </Modal>
    </>
  );
}
