import { useEffect, useState } from 'react';
import { FileBarChart2 } from 'lucide-react';
import api from '../api/client';

const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

export default function Resumen() {
  const [summary, setSummary] = useState({ totales: [], total: 0 });
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    api.get('/registros/summary').then((res) => setSummary(res.data));
    api.get('/registros').then((res) => setRegistros(res.data));
  }, []);

  const entradas = summary.totales.find((t) => t.nombre_movimiento === 'Entrada')?.total || 0;
  const salidas = summary.totales.find((t) => t.nombre_movimiento === 'Salida')?.total || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resumen General</h1>
        <p className="text-sm text-gray-500 mt-1">Reportes y estadísticas del sistema</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 font-bold text-gray-900">
          <FileBarChart2 size={18} className="text-brand-600" /> Movimientos por Tipo
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Entradas</span>
            <span className="px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-bold">{entradas}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Salidas</span>
            <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-xs font-bold">{salidas}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total</span>
            <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">{summary.total}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Historial de Movimientos</div>
        <div className="overflow-y-auto max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
              <tr>
                <th className="text-left px-5 py-2.5">Fecha</th>
                <th className="text-left px-5 py-2.5">Persona</th>
                <th className="text-left px-5 py-2.5">Equipo</th>
                <th className="text-left px-5 py-2.5">Serial</th>
                <th className="text-left px-5 py-2.5">Tipo</th>
                <th className="text-left px-5 py-2.5">Registrado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registros.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-10">No hay movimientos</td></tr>
              )}
              {registros.map((m) => (
                <tr key={m.id_registro} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono-num text-xs">{fmt(m.fecha_hora)}</td>
                  <td className="px-5 py-3">{m.persona_nombres} {m.persona_apellidos}<br /><span className="text-xs text-gray-400">{m.numero_documento}</span></td>
                  <td className="px-5 py-3">{m.nombre_marca} {m.modelo}</td>
                  <td className="px-5 py-3 font-mono-num text-xs">{m.serial}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${m.nombre_movimiento === 'Entrada' ? 'bg-brand-100 text-brand-800' : 'bg-gray-800 text-white'}`}>{m.nombre_movimiento}</span></td>
                  <td className="px-5 py-3">{m.registrado_por}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
