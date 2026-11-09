// Ventana que aparece antes de registrar una SALIDA: muestra los accesorios
// que se registraron cuando el equipo entró, para que el vigilante compruebe
// que la persona sale con ellos. Al pulsar "Aceptar" se registra la salida.
import { useEffect, useRef } from 'react';
import { PackageCheck } from 'lucide-react';
import Modal from '../Modal';
import { fmtHora } from '../../utils/fechas';

export default function AccesoriosSalidaModal({ salida, enviando, onAceptar, onCancelar }) {
  const contenedorRef = useRef(null);
  const abierto = Boolean(salida);
  const equipo = salida?.equipo;
  const accesorios = salida?.accesorios || [];

  // El foco no se deja en ningún botón: la pistola lectora termina cada
  // lectura con Enter, y una segunda lectura por error "pulsaría" Aceptar.
  useEffect(() => {
    if (abierto) contenedorRef.current?.focus();
  }, [abierto]);

  return (
    <Modal open={abierto} onClose={onCancelar} title="Registrar salida" maxWidth="max-w-md">
      {equipo && (
        <div ref={contenedorRef} tabIndex={-1} className="outline-none">
          <div className="rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 p-3 mb-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                {equipo.nombre_marca} {equipo.modelo}
              </span>
              <span className="text-xs font-mono text-gray-600 dark:text-gray-400 shrink-0">{equipo.serial}</span>
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Propietario:{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {`${equipo.persona_nombres || ''} ${equipo.persona_apellidos || ''}`.trim() || 'Sin asignar'}
              </span>
            </div>
            {salida.fechaEntrada && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Entrada: <span className="font-mono">{fmtHora(salida.fechaEntrada)}</span>
              </div>
            )}
          </div>

          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Accesorios registrados en la entrada
          </p>
          {accesorios.length > 0 ? (
            <ul className="border border-gray-200 dark:border-gray-600 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
              {accesorios.map((a) => (
                <li key={a.id_accesorio} className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200">
                  <PackageCheck size={16} className="shrink-0 text-brand-600 dark:text-brand-400" />
                  {a.nombre_accesorio}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2.5">
              Ingresó solo con el computador.
            </p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Verifica que la persona salga con estos accesorios y pulsa Aceptar para registrar la salida.
          </p>

          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onCancelar}
              disabled={enviando}
              className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onAceptar}
              disabled={enviando}
              className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              Aceptar
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
