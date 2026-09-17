// NC-8: tabla de movimientos recientes extraída de EntradasSalidas.jsx —
// solo se encarga de mostrar la lista ya agrupada, no de calcularla ni de
// pedirla a la API (esa lógica se queda en el componente padre).
import { fmtHora } from '../../utils/fechas';

export default function MovimientosRecientesPanel({ movimientos, isSuperAdmin }) {
  return (
    <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-brand-300  dark:border-gray-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden mb-2">
      <div className="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
        <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100">
          {isSuperAdmin ? 'Movimientos de Hoy (todos)' : 'Mis Movimientos de Hoy'}
        </h3>
        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">Resumen por equipo</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <thead className=" bg-green-100 dark:bg-brand-900/40 sticky top-0 backdrop-blur-sm z-10 text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
            <tr>
              <th className="py-2 px-5 font-bold text-black dark:text-gray-100">MARCA PC / SERIAL / PROPIETARIO</th>
              <th className="py-2 px-5 font-bold text-center text-black dark:text-gray-100">ENTRADA</th>
              <th className="py-2 px-5 font-bold text-center text-black dark:text-gray-100">SALIDA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-xs">
            {movimientos.length === 0 ? (
              <tr>
                <td colSpan={3} className="text-center text-gray-600 dark:text-gray-400 py-6 text-xs">
                  Sin movimientos registrados hoy
                </td>
              </tr>
            ) : (
              movimientos.map((item) => (
                <tr key={item.serial} className="hover:bg-gray-50/50 dark:hover:bg-gray-700/40 transition-colors">
                  <td className="py-2.5 px-4">
                    <div className="font-bold text-gray-900 dark:text-gray-100 leading-snug">{item.equipo || 'Equipo'}</div>
                    <div className="text-[10px] text-brand-600 dark:text-brand-400 font-mono font-bold leading-tight">{item.serial}</div>
                    <div className="text-[10px] text-gray-700 dark:text-gray-300 leading-tight">{item.propietario}</div>
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {item.entrada ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-brand-100/80 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300">
                          Entrada
                        </span>
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                          {fmtHora(item.entrada)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 font-mono">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-center">
                    {item.salida ? (
                      <div className="inline-flex flex-col items-center">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 text-white">
                          Salida
                        </span>
                        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-mono mt-0.5">
                          {fmtHora(item.salida)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
