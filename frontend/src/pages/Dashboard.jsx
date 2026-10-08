import { useEffect, useState, useCallback } from 'react';
import { ArrowDownCircle, ArrowUpCircle, LogIn, Activity, Bot } from 'lucide-react';
import api from '../api/client';

const PERIODOS = [
  { valor: 'dia', etiqueta: 'Hoy' },
  { valor: 'semana', etiqueta: 'Esta semana' },
  { valor: 'mes', etiqueta: 'Este mes' },
];

function fmtFechaHora(str) {
  if (!str) return '—';
  const limpia = str.replace('T', ' ');
  const [fecha, horaCompleta] = limpia.split(' ');
  const [year, month, day] = fecha.split('-');
  let [h, m] = (horaCompleta || '00:00').split(':').map(Number);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${day}/${month}/${year.slice(2)}, ${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

export default function Dashboard() {
  const [periodo, setPeriodo] = useState('dia');
  const [resumen, setResumen] = useState(null);
  const [movimientos, setMovimientos] = useState([]);
  const [logins, setLogins] = useState([]);
  const [vista, setVista] = useState('movimientos'); // 'movimientos' | 'logins'
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m, l] = await Promise.all([
        api.get(`/dashboard/resumen?periodo=${periodo}`),
        api.get(`/dashboard/movimientos?periodo=${periodo}`),
        api.get(`/dashboard/logins?periodo=${periodo}`),
      ]);
      setResumen(r.data);
      setMovimientos(m.data);
      setLogins(l.data);
    } catch (err) {
      console.error('Error cargando el dashboard de auditoría:', err);
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => { cargar(); }, [cargar]);

  const cards = resumen ? [
    { label: 'Movimientos', value: resumen.totalMovimientos, icon: Activity, bg: 'bg-gray-800' },
    { label: 'Entradas', value: resumen.entradas, icon: ArrowDownCircle, bg: 'bg-brand-600' },
    { label: 'Salidas', value: resumen.salidas, icon: ArrowUpCircle, bg: 'bg-slate-700' },
    { label: 'Cierres automáticos', value: resumen.automaticos, icon: Bot, bg: 'bg-amber-700' },
    { label: 'Inicios de sesión', value: resumen.totalLogins, icon: LogIn, bg: 'bg-brand-800' },
  ] : [];

  return (
    <div>
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Auditoría</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Quién registró cada movimiento (o si lo cerró el sistema) y quién inició sesión.
          </p>
        </div>

        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1 gap-1 self-start">
          {PERIODOS.map((p) => (
            <button
              key={p.valor}
              onClick={() => setPeriodo(p.valor)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                periodo === p.valor
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
        {cards.map(({ label, value, icon: Icon, bg }) => (
          <div key={label} className={`relative overflow-hidden rounded-2xl ${bg} text-white p-4 shadow-sm`}>
            <Icon size={44} className="absolute -right-3 -bottom-3 opacity-15" />
            <div className="text-2xl font-bold">{loading ? '—' : value}</div>
            <div className="text-xs opacity-90 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {resumen?.usuariosActivos?.length > 0 && (
        <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-4 mb-6">
          <h3 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-3">
            Usuarios más activos {PERIODOS.find(p => p.valor === periodo)?.etiqueta.toLowerCase()}
          </h3>
          <div className="flex flex-wrap gap-2">
            {resumen.usuariosActivos.map((u) => (
              <span key={u.usuario} className="inline-flex items-center gap-1.5 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-300 text-xs font-semibold px-3 py-1.5 rounded-full">
                {u.nombre} {u.apellidos}
                <span className="bg-brand-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{u.total}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-100 dark:border-gray-700">
          <button
            onClick={() => setVista('movimientos')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              vista === 'movimientos'
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Movimientos de equipos
          </button>
          <button
            onClick={() => setVista('logins')}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              vista === 'logins'
                ? 'border-brand-600 text-brand-700 dark:text-brand-400'
                : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            Inicios de sesión
          </button>
        </div>

        {vista === 'movimientos' ? (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[11px] uppercase sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5">Equipo</th>
                  <th className="text-left px-5 py-2.5">Serial</th>
                  <th className="text-center px-5 py-2.5">Tipo</th>
                  <th className="text-left px-5 py-2.5">Fecha / Hora</th>
                  <th className="text-left px-5 py-2.5">Registrado por</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {movimientos.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-400 dark:text-gray-500 py-10">Sin movimientos en este periodo</td></tr>
                ) : movimientos.map((m) => (
                  <tr key={m.id_registro} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40">
                    <td className="px-5 py-2.5 text-gray-800 dark:text-gray-200">{m.nombre_marca} {m.modelo}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-brand-600 dark:text-brand-400">{m.serial}</td>
                    <td className="px-5 py-2.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${m.nombre_movimiento === 'Entrada' ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300' : 'bg-slate-800 text-white'}`}>
                        {m.nombre_movimiento}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono">{fmtFechaHora(m.fecha_hora)}</td>
                    <td className="px-5 py-2.5">
                      {m.es_automatico ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                          <Bot size={12} /> Sistema (cierre automático)
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">@{m.registrado_por}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-[11px] uppercase sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5">Usuario</th>
                  <th className="text-left px-5 py-2.5">Rol</th>
                  <th className="text-left px-5 py-2.5">Fecha / Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {logins.length === 0 ? (
                  <tr><td colSpan={3} className="text-center text-gray-400 dark:text-gray-500 py-10">Sin inicios de sesión en este periodo</td></tr>
                ) : logins.map((l) => (
                  <tr key={l.id_auditoria} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/40">
                    <td className="px-5 py-2.5">
                      <div className="font-semibold text-gray-800 dark:text-gray-200">{l.nombre} {l.apellidos}</div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">@{l.usuario}</div>
                    </td>
                    <td className="px-5 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${l.nombre_rol === 'Super Administrador' ? 'bg-brand-800 text-white' : l.nombre_rol === 'Administrador' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'}`}>
                        {l.nombre_rol}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono">{fmtFechaHora(l.fecha)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-3">
        &ldquo;Hoy&rdquo; se reinicia solo a las 00:00 (igual que en Control de Acceso). El reinicio operativo de las 11:59 p.m.
        cierra automáticamente los equipos que seguían &ldquo;Adentro&rdquo; — esos cierres aparecen aquí marcados como Sistema.
      </p>
    </div>
  );
}
