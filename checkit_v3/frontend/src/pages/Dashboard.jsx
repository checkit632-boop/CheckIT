import { useEffect, useState } from 'react';
import { Laptop, ArrowDownCircle, ArrowUpCircle, Activity } from 'lucide-react';
import api from '../api/client';

export default function Dashboard() {
  const [stats, setStats] = useState({ equipos: 0, entradas: 0, salidas: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    const load = async () => {
      try {
        const [eqRes, hoyRes] = await Promise.all([
          api.get('/equipos'),
          api.get('/registros/stats/hoy'),
        ]);
        const hoy = hoyRes.data;
        const entradas = hoy.find((h) => h.nombre_movimiento === 'Entrada')?.total || 0;
        const salidas = hoy.find((h) => h.nombre_movimiento === 'Salida')?.total || 0;
        setStats({ equipos: eqRes.data.length, entradas, salidas });
        setLastUpdate(new Date());
      } catch (err) {
        console.error(err);
      }
    };
    load();
  }, []);

  const cards = [
    { label: 'Equipos Registrados', value: stats.equipos, icon: Laptop, bg: 'bg-gray-800' },
    { label: 'Entradas Hoy', value: stats.entradas, icon: ArrowDownCircle, bg: 'bg-brand-600' },
    { label: 'Salidas Hoy', value: stats.salidas, icon: ArrowUpCircle, bg: 'bg-brand-400' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Panel Principal</h1>
        <p className="text-sm text-gray-500 mt-1">Bienvenido al sistema CheckIT</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {cards.map(({ label, value, icon: Icon, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl ${bg} text-white flex items-center justify-center`}>
              <Icon size={22} />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 font-bold text-gray-900">
          <Activity size={18} className="text-brand-600" />
          Estado del Sistema
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Sistema Operativo</span>
            <span className="px-2.5 py-1 rounded-full bg-brand-100 text-brand-800 text-xs font-semibold">Activo</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Base de Datos</span>
            <span className="px-2.5 py-1 rounded-full bg-gray-800 text-white text-xs font-semibold">Conectada</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Última Actualización</span>
            <span className="text-xs text-gray-500 font-mono-num">{lastUpdate.toLocaleString('es-CO')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
