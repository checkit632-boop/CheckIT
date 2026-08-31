import { useEffect, useState } from 'react';
import { Laptop, ArrowDownCircle, ArrowUpCircle, Activity } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';

// Función para obtener el icono del clima según el código WMO
const obtenerIconoClima = (code, hour) => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([95, 96, 99].includes(code)) return '🌩️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([71, 73, 75, 85, 86].includes(code)) return '❄️';
  return (hour >= 18 || hour < 6) ? '🌙' : '☀️';
};

export default function Dashboard() {
  const [stats, setStats] = useState({ equipos: 0, equiposDentro: 0, entradas: 0, salidas: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [iconoClima, setIconoClima] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/dashboard');
        setStats({
          equipos: data?.equipos || 0,
          equiposDentro: data?.equiposDentro || 0,
          entradas: data?.entradasHoy || 0,
          salidas: data?.salidasHoy || 0
        });
        setLastUpdate(new Date());
      } catch (err) {
        console.error("Error al cargar datos del dashboard:", err);
      }
    };
    load();

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Consultar Clima en Tiempo Real con protección contra fallos de permisos
  useEffect(() => {
    const consultarClima = async (lat, lon) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`
        );
        if (!res.ok) return;
        const data = await res.json();
        const currentHour = new Date().getHours();
        if (data?.current_weather?.weathercode !== undefined) {
          setIconoClima(obtenerIconoClima(data.current_weather.weathercode, currentHour));
        }
      } catch (err) {
        console.error("Error al obtener clima:", err);
      }
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => consultarClima(pos.coords.latitude, pos.coords.longitude),
        () => consultarClima(4.6097, -74.0817), // Coordenadas por defecto si el usuario deniega
        { timeout: 4000 }
      );
    } else {
      consultarClima(4.6097, -74.0817);
    }
  }, []);

  const cards = [
    {
      label: 'Equipos Registrados',
      value: stats.equipos,
      icon: Laptop,
      color: 'from-gray-900 to-gray-700',
      iconBg: 'bg-white/20',
      text: 'text-white',
      border: 'border-gray-700'
    },
    {
      label: 'Equipos Dentro',
      value: stats.equiposDentro,
      icon: Activity,
      color: 'from-brand-700 to-brand-500',
      iconBg: 'bg-white/20',
      text: 'text-white',
      border: 'border-brand-400'
    },
    {
      label: 'Entradas Hoy',
      value: stats.entradas,
      icon: ArrowDownCircle,
      color: 'from-green-600 to-green-500',
      iconBg: 'bg-white/20',
      text: 'text-white',
      border: 'border-green-400'
    },
    {
      label: 'Salidas Hoy',
      value: stats.salidas,
      icon: ArrowUpCircle,
      color: 'from-blue-600 to-cyan-500',
      iconBg: 'bg-white/20',
      text: 'text-white',
      border: 'border-blue-400'
    },
  ];

  const hour = currentTime.getHours();

  let saludo = "Buenos días";
  let iconoPorDefecto = "☀️";

  if (hour >= 12 && hour < 18) {
    saludo = "Buenas tardes";
    iconoPorDefecto = "🌤️";
  }

  if (hour >= 18 || hour < 6) {
    saludo = "Buenas noches";
    iconoPorDefecto = "🌙";
  }

  const icono = iconoClima || iconoPorDefecto;

  return (
    <div>
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {icono} {saludo},
              <span className="text-brand-600">
                {" "}
                {user?.nombre}
              </span>
            </h1>

            <p className="text-gray-500 mt-2">
              Sistema Inteligente de Control de Equipos
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-6 py-4 text-center min-w-[220px]">
            <div className="text-3xl font-bold text-brand-700">
              {currentTime.toLocaleTimeString('es-CO')}
            </div>

            <div className="text-sm text-gray-500 mt-1">
              {currentTime.toLocaleDateString('es-CO', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {cards.map(
          ({ label, value, icon: Icon, color, iconBg, text, border }) => (
            <div
              key={label}
              className={`
              relative overflow-hidden rounded-2xl bg-gradient-to-br ${color} ${text} border ${border}
              shadow-lg hover:shadow-2xl hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300 p-4
              `}
            >
              <Icon size={60} className="absolute -right-5 -bottom-5 opacity-10" />

              <div className={`w-11 h-11 rounded-2xl ${iconBg} flex items-center justify-center mb-5 backdrop-blur-sm`}>
                <Icon size={22} />
              </div>

              <div className="text-3xl font-bold">{value}</div>
              <div className="text-sm opacity-90 mt-1">{label}</div>
            </div>
          )
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* ACTIVIDAD DEL DÍA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={20} className="text-brand-600" />
            <h2 className="font-bold text-lg">Actividad del día</h2>
          </div>

          <div className="mb-6">
            <div className="flex justify-between mb-2 text-sm">
              <span>Entradas</span>
              <span className="font-bold">{stats.entradas}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand-600 h-3 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(stats.entradas * 10, 100)}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2 text-sm">
              <span>Salidas</span>
              <span className="font-bold">{stats.salidas}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-brand-400 h-3 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(stats.salidas * 10, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ESTADO */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
          <div className="flex items-center gap-2 mb-6">
            <Activity size={20} className="text-brand-600" />
            <h2 className="font-bold text-lg">Estado del sistema</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span>Sistema</span>
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Activo
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Base de datos</span>
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Conectada
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>API</span>
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Disponible
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Escáner QR</span>
              <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                Listo
              </span>
            </div>

            <hr />

            <div className="flex justify-between items-center text-sm">
              <span>Última actualización</span>
              <span className="font-semibold">
                {lastUpdate.toLocaleTimeString('es-CO')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}