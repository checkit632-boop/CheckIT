// NC-8: tarjeta "Validar Acceso" extraída de EntradasSalidas.jsx. Antes vivía
// mezclada con el resto de la página (tabla de movimientos, footer de
// estado, reloj...); ahora es un componente independiente, enfocado en una
// sola responsabilidad: buscar un equipo por serial y registrar su
// entrada/salida.
import { Search, ArrowDownCircle, ArrowUpCircle, AlertCircle } from 'lucide-react';
import { fmtHora } from '../../utils/fechas';

export default function ValidarAccesoCard({
  serialQuery,
  setSerialQuery,
  buscarEquipo,
  searching,
  equipo,
  estadoInfo,
  registrar,
  registrando,
  esEntrada,
}) {
  return (
    <div className="flex-1 bg-surface dark:bg-gray-800 rounded-2xl border border-brand-300 dark:border-brand-700 shadow-sm p-5 flex flex-col justify-between">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">Validar Acceso</h3>
      </div>

      <div className="space-y-8">
        <div>
          <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-2">Serial del equipo</label>
          <div className="flex gap-2">
            <input
              className="flex-1 border border-gray-300 dark:border-gray-600 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-sm"
              placeholder="Escribe el serial o escanea el QR..."
              value={serialQuery}
              onChange={(e) => setSerialQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscarEquipo(serialQuery)}
            />
            <button
              onClick={() => buscarEquipo(serialQuery)}
              disabled={searching}
              className="bg-slate-800 hover:bg-black text-white px-3.5 rounded-xl transition-colors shrink-0 flex items-center justify-center shadow-sm"
            >
              <Search size={16} />
            </button>
          </div>
        </div>

        {equipo && (
          <div className={`border rounded-xl p-3 space-y-1.5 ${
            equipo.activo
              ? 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900'
              : 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
          }`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">
                {equipo.nombre_marca} {equipo.modelo}
              </span>
              <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 shrink-0">{equipo.serial}</span>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">
              Propietario: <span className="font-semibold text-gray-800 dark:text-gray-200">
                {`${equipo.persona_nombres || ''} ${equipo.persona_apellidos || ''}`.trim() || 'Sin asignar'}
              </span>
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400">
              Último movimiento:{' '}
              {estadoInfo?.estado === 'Adentro' && estadoInfo?.ultima_entrada ? (
                <span className="font-semibold text-gray-800 dark:text-gray-200">Entrada — {fmtHora(estadoInfo.ultima_entrada)}</span>
              ) : estadoInfo?.estado === 'Afuera' && estadoInfo?.ultima_salida ? (
                <span className="font-semibold text-gray-800 dark:text-gray-200">Salida — {fmtHora(estadoInfo.ultima_salida)}</span>
              ) : (
                <span className="text-gray-400 dark:text-gray-500">Sin movimientos registrados</span>
              )}
            </div>
            {!equipo.activo && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-red-700 dark:text-red-400 pt-1">
                <AlertCircle size={13} />
                Equipo inactivo — no puede registrar movimientos
              </div>
            )}
          </div>
        )}

        <button
          onClick={registrar}
          disabled={!equipo || !equipo.activo || registrando}
          className={`w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-sm flex items-center justify-center gap-2 disabled:bg-slate-400 disabled:cursor-not-allowed ${
            esEntrada ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-500 hover:bg-slate-600'
          }`}
        >
          {esEntrada ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />}
          {registrando ? 'Procesando...' : !equipo?.activo && equipo ? 'Equipo inactivo' : esEntrada ? 'Registrar Entrada' : 'Registrar Salida'}
        </button>
      </div>
    </div>
  );
}
