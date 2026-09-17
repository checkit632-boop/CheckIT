// NC-8: footer "Estado del sistema" (el slider animado) extraído de
// EntradasSalidas.jsx — es puramente decorativo/informativo, no tiene
// ninguna razón para vivir mezclado con la lógica de negocio del módulo.
import { Activity } from 'lucide-react';

export default function EstadoSistemaFooter({ lastUpdate }) {
  return (
    <div className="flex items-center justify-between text-xs pt-1 shrink-0 gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100 shrink-0">
          <Activity size={14} className="text-brand-600 dark:text-brand-400" />
          <span className="text-[11px]">Estado del sistema</span>
        </div>

        <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]">
          <div className="flex items-center gap-1.5 text-[11px] w-max animate-status-slide">
            {[0, 1].map((rep) => (
              <div key={rep} className="flex items-center gap-1.5 pr-8">
                <span className="text-gray-600 dark:text-gray-400">Sistema</span>
                <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 font-bold px-2 py-0.5 rounded-full text-[10px] ml-3">
                  Activo
                </span>

                <span className="text-gray-600 dark:text-gray-400 ml-9">Base de datos</span>
                <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 font-bold px-2 py-0.5 rounded-full text-[10px] ml-3">
                  Conectada
                </span>

                <span className="text-gray-600 dark:text-gray-400 ml-9">API</span>
                <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 font-bold px-2 py-0.5 rounded-full text-[10px] ml-3">
                  Disponible
                </span>

                <span className="text-gray-600 dark:text-gray-400 ml-9">Escáner QR</span>
                <span className="bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 font-bold px-2 py-0.5 rounded-full text-[10px] ml-3">
                  Listo
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-gray-600 dark:text-gray-400 font-mono flex items-center gap-1.5 shrink-0">
        <span>Última actualización</span>
        <span className="font-bold text-gray-700 dark:text-gray-300">
          {lastUpdate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
        </span>
      </div>
    </div>
  );
}
