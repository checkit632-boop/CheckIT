// Diálogo de confirmación con el mismo estilo que el resto de CheckIT.
// Reemplaza window.confirm(), que muestra una ventana del navegador distinta
// en cada equipo y no explica las consecuencias de la acción.
//
// Uso:
//   const confirmar = useConfirmacion();
//   if (!(await confirmar({ titulo, mensaje, textoConfirmar, peligro: true }))) return;
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Modal from '../components/Modal';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialogo, setDialogo] = useState(null);
  const resolver = useRef(null);

  const confirmar = useCallback((opciones) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialogo(opciones);
  }), []);

  const cerrar = (respuesta) => {
    resolver.current?.(respuesta);
    resolver.current = null;
    setDialogo(null);
  };

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <Modal open={Boolean(dialogo)} onClose={() => cerrar(false)} title={dialogo?.titulo || 'Confirmar'} maxWidth="max-w-md">
        <div className="flex gap-3 mb-5">
          {dialogo?.peligro && (
            <span className="shrink-0 h-9 w-9 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-300 flex items-center justify-center">
              <AlertTriangle size={18} />
            </span>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{dialogo?.mensaje}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => cerrar(false)}
            className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => cerrar(true)}
            className={`flex-1 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors ${
              dialogo?.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {dialogo?.textoConfirmar || 'Confirmar'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirmacion() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirmacion debe usarse dentro de <ConfirmProvider>');
  return ctx;
}
