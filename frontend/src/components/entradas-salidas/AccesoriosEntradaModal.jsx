// Ventana que aparece antes de registrar una ENTRADA: el vigilante indica qué
// accesorios trae la persona junto con el computador (selección múltiple).
// Es opcional: si solo trae el computador, basta con pulsar "Aceptar".
// Las salidas no pasan por aquí, para no frenar la fila en portería.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import api from '../../api/client';
import Modal from '../Modal';

export default function AccesoriosEntradaModal({ equipo, enviando, onAceptar, onCancelar }) {
  const [catalogo, setCatalogo] = useState([]);
  const [errorCatalogo, setErrorCatalogo] = useState(false);
  const [seleccionados, setSeleccionados] = useState([]);
  const [desplegado, setDesplegado] = useState(false);
  const contenedorRef = useRef(null);
  const abierto = Boolean(equipo);

  useEffect(() => {
    if (!abierto) return;
    setSeleccionados([]);
    setDesplegado(false);
    setErrorCatalogo(false);
    // El foco no se deja en ningún botón: la pistola lectora termina cada
    // lectura con Enter, y una segunda lectura por error "pulsaría" Aceptar
    // o el botón Registrar que quedó detrás de esta ventana.
    contenedorRef.current?.focus();
    api.get('/catalogos/accesorios')
      .then(({ data }) => setCatalogo(data))
      .catch(() => setErrorCatalogo(true));
  }, [abierto]);

  const alternar = (id) => {
    setSeleccionados((actuales) => (
      actuales.includes(id) ? actuales.filter((a) => a !== id) : [...actuales, id]
    ));
  };

  const resumen = catalogo
    .filter((a) => seleccionados.includes(a.id_accesorio))
    .map((a) => a.nombre_accesorio)
    .join(', ');

  return (
    <Modal open={abierto} onClose={onCancelar} title="Registrar entrada" maxWidth="max-w-md">
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
          </div>

          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block mb-1">Accesorios</label>
          <button
            type="button"
            onClick={() => setDesplegado((d) => !d)}
            aria-expanded={desplegado}
            className="w-full flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-600 dark:bg-gray-900 rounded-xl px-3 py-2.5 text-sm text-left focus:outline-none focus:border-brand-500"
          >
            <span className={resumen ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
              {resumen || 'Seleccionar accesorios'}
            </span>
            <ChevronDown size={16} className={`shrink-0 text-gray-500 dark:text-gray-400 transition-transform ${desplegado ? 'rotate-180' : ''}`} />
          </button>

          {desplegado && (
            <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-xl divide-y divide-gray-100 dark:divide-gray-700">
              {catalogo.map((a) => (
                <label
                  key={a.id_accesorio}
                  className="flex items-center gap-3 px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-900/30"
                >
                  <input
                    type="checkbox"
                    checked={seleccionados.includes(a.id_accesorio)}
                    onChange={() => alternar(a.id_accesorio)}
                    className="w-4 h-4 accent-brand-600"
                  />
                  {a.nombre_accesorio}
                </label>
              ))}
            </div>
          )}

          {errorCatalogo && (
            <p className="text-xs text-red-600 dark:text-red-300 mt-2">
              No se pudo cargar la lista de accesorios. Puedes registrar la entrada sin ellos.
            </p>
          )}
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            Puedes elegir varios. Si la persona solo trae el computador, pulsa Aceptar sin seleccionar nada.
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
              onClick={() => onAceptar(seleccionados)}
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
