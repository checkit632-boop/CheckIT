import { useEffect, useState } from 'react';
import { 
  ScanLine, 
  Search, 
  ArrowDownCircle, 
  ArrowUpCircle, 
  LoaderCircle, 
  Laptop, 
  Activity,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import QRScannerModal from '../components/QRScannerModal';
import { playEntrada, playSalida, playError } from '../utils/sounds';

const obtenerIconoClima = (code, hour) => {
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️';
  if ([95, 96, 99].includes(code)) return '🌩️';
  if ([45, 48].includes(code)) return '🌫️';
  if ([1, 2, 3].includes(code)) return '⛅';
  if ([71, 73, 75, 85, 86].includes(code)) return '❄️';
  return (hour >= 18 || hour < 6) ? '🌙' : '☀️';
};

// 1. Soporte mejorado para fechas con formato ISO ("YYYY-MM-DDTHH:mm:ss") o SQLite ("YYYY-MM-DD HH:mm:ss")
const fmtHora = (fechaStr) => {
  if (!fechaStr) return '—';

  // Si la fecha incluye 'T' (ej: 2026-08-24T08:57:28.621-05:00), limpiamos la zona para extraer la hora pura
  let limpia = fechaStr.replace('T', ' ');
  if (limpia.includes('.')) limpia = limpia.split('.')[0];
  if (limpia.includes('-') && limpia.split('-').length > 3) {
    limpia = limpia.substring(0, 19);
  }

  const partes = limpia.split(' ');
  if (partes.length < 2) return fechaStr;

  const [fecha, hora] = partes;
  const [year, month, day] = fecha.split('-');
  let [hours, minutes] = hora.split(':');

  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;

  return `${day}/${month}/${year.slice(2)}, ${h}:${minutes} ${ampm}`;
};

export default function ControlAccesos() {
  const { showToast } = useToast();
  const { user, isSuperAdmin } = useAuth();

  const [serialQuery, setSerialQuery] = useState('');
  const [equipo, setEquipo] = useState(null);
  const [estadoInfo, setEstadoInfo] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [recientes, setRecientes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [registrando, setRegistrando] = useState(false);

  const [stats, setStats] = useState({ equipos: 0, equiposDentro: 0 });
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [iconoClima, setIconoClima] = useState(null);
  const [temperatura, setTemperatura] = useState(null);

  const loadRecientes = async () => {
    try {
      // hoy=1 -> se "vacía" a las 00:00. propios=1 -> Administrador/Operador
      // solo ven lo que ellos mismos registraron; el Super Administrador
      // siempre ve los de todos (el backend lo decide, no el frontend).
      const { data } = await api.get('/registros?limit=20&hoy=1&propios=1');
      setRecientes(data);
    } catch (err) { /* silent */ }
  };

  const loadDashboardStats = async () => {
    try {
      const { data } = await api.get('/registros/stats/hoy');
      setStats({
        equipos: data?.misMovimientosHoy || 0,
        equiposDentro: data?.equiposDentro || 0,
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Error al cargar datos del dashboard:", err);
    }
  };

  useEffect(() => {
    loadRecientes();
    loadDashboardStats();

    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
        if (data?.current_weather?.temperature !== undefined) {
          setTemperatura(Math.round(data.current_weather.temperature));
        }
      } catch (err) {
        console.error("Error al obtener clima:", err);
      }
    };

    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => consultarClima(pos.coords.latitude, pos.coords.longitude),
        () => consultarClima(4.6097, -74.0817),
        { timeout: 4000 }
      );
    } else {
      consultarClima(4.6097, -74.0817);
    }
  }, []);

  // 2. Agrupación que ordena el equipo recién escaneado al inicio de la tabla
  const agruparMovimientos = (logs) => {
    if (!logs || logs.length === 0) return [];

    const mapa = new Map();

    // 1. Ordenamos cronológicamente ascendente para procesar la historia
    const logsOrdenados = [...logs].sort((a, b) => (a.id_registro || 0) - (b.id_registro || 0));

    logsOrdenados.forEach((m) => {
      const propietarioActual = `${m.persona_nombres || ''} ${m.persona_apellidos || ''}`.trim() || 'Sin asignar';
      const equipoInfo = `${m.nombre_marca || ''} ${m.modelo || ''}`.trim() || 'Equipo';
      const tipo = (m.nombre_movimiento || '').toLowerCase();

      if (!mapa.has(m.serial)) {
        mapa.set(m.serial, {
          id: m.id_registro || 0,
          serial: m.serial,
          equipo: equipoInfo,
          propietario: propietarioActual,
          entrada: null,
          salida: null,
          ultimoIdRegistro: m.id_registro || 0,
        });
      }

      const item = mapa.get(m.serial);
      item.propietario = propietarioActual;
      item.equipo = equipoInfo;
      item.ultimoIdRegistro = m.id_registro || item.ultimoIdRegistro;

      if (tipo === 'entrada') {
        item.entrada = m.fecha_hora;
        item.salida = null;
      } else if (tipo === 'salida') {
        item.salida = m.fecha_hora;
      }
    });

    // 2. Ordenamos descendentemente por el ID autoincremental del último registro
    // El equipo escaneado hace un segundo SIEMPRE tendrá el ID más alto de la BD.
    return Array.from(mapa.values()).sort((a, b) => b.ultimoIdRegistro - a.ultimoIdRegistro);
  };

  const determinarSiguienteMovimiento = (idEquipo, serial, estadoBackend) => {
    // 1. Buscamos el registro más reciente de este serial en la lista local de recientes
    const registroReciente = recientes.find(
      (m) => m.serial?.toLowerCase() === serial?.toLowerCase() || m.id_equipo === idEquipo
    );

    // 2. Si existe un registro en recientes, evaluamos la última acción real
    if (registroReciente) {
      const ultimoTipo = (registroReciente.nombre_movimiento || '').toLowerCase();
      
      // Si la última acción fue entrada -> toca Salida. Si fue salida -> toca Entrada.
      return {
        ...estadoBackend,
        siguiente_movimiento: ultimoTipo === 'entrada' ? 'Salida' : 'Entrada'
      };
    }

    // 3. Si no hay historial reciente, confiamos en lo que devuelva el backend
    return estadoBackend;
  };

  const cargarEstado = async (idEquipo, serial) => {
    try {
      const { data } = await api.get(`/registros/estado/${idEquipo}`);
      const estadoCorregido = determinarSiguienteMovimiento(idEquipo, serial, data);
      setEstadoInfo(estadoCorregido);
      return estadoCorregido;
    } catch (err) {
      setEstadoInfo(null);
      return null;
    }
  };

  const buscarEquipo = async (serial) => {
    if (!serial.trim()) return;
    setSearching(true);
    try {
      const { data } = await api.get(`/equipos/serial/${encodeURIComponent(serial.trim())}`);
      setEquipo(data);
      
      const estadoFinal = await cargarEstado(data.id_equipo, data.serial);
      showToast(`Equipo encontrado — Siguiente: ${estadoFinal?.siguiente_movimiento || 'Entrada'}`);
      return data;
    } catch (err) {
      setEquipo(null);
      setEstadoInfo(null);
      showToast('No se encontró un equipo con ese serial', 'error');
      return null;
    } finally {
      setSearching(false);
    }
  };

  const handleScanResult = async (serial) => {
    setScannerOpen(false);
    setSerialQuery(serial);

    if (!serial.trim()) return;

    setSearching(true);
    setRegistrando(true);
    const inicio = Date.now();

    try {
      const { data: equipoData } = await api.get(`/equipos/serial/${encodeURIComponent(serial.trim())}`);
      const { data: estadoData } = await api.get(`/registros/estado/${equipoData.id_equipo}`);

      setEquipo(equipoData);
      setEstadoInfo(estadoData);

      await api.post('/registros', {
        serial: equipoData.serial,
        tipo: estadoData.siguiente_movimiento,
      });

      if (estadoData.siguiente_movimiento === 'Entrada') {
        playEntrada();
      } else {
        playSalida();
      }

      showToast(`Movimiento de ${estadoData.siguiente_movimiento.toLowerCase()} registrado con éxito — ${new Date().toLocaleTimeString('es-CO')}`);
      await loadRecientes();
      await loadDashboardStats();

      const { data: nuevoEstado } = await api.get(`/registros/estado/${equipoData.id_equipo}`);
      setEstadoInfo(nuevoEstado);

      setTimeout(() => {
        setEquipo(null);
        setEstadoInfo(null);
        setSerialQuery('');
        setScannerOpen(true);
      }, 2000);

    } catch (err) {
      playError();
      showToast(err.response?.data?.error || 'No se pudo registrar el movimiento', 'error');
    } finally {
      const tiempo = Date.now() - inicio;
      if (tiempo < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - tiempo));
      }
      setSearching(false);
      setRegistrando(false);
    }
  };

  const registrar = async () => {
    if (!equipo || !estadoInfo) { showToast('Realiza una búsqueda primero', 'error'); return; }
    if (!equipo.activo) { showToast('Este equipo está inactivo y no puede registrar movimientos', 'error'); return; }
    const tipo = estadoInfo.siguiente_movimiento;
    setRegistrando(true);
    const inicio = Date.now();
    try {
      await api.post('/registros', { serial: equipo.serial, tipo });

      if (tipo === 'Entrada') {
        playEntrada();
      } else {
        playSalida();
      }

      showToast(`Movimiento de ${tipo.toLowerCase()} registrado con éxito — ${new Date().toLocaleTimeString('es-CO')}`);
      setEquipo(null);
      setEstadoInfo(null);
      setSerialQuery('');
      loadRecientes();
      loadDashboardStats();
    } catch (err) {
      playError();
      showToast(err.response?.data?.error || 'No se pudo registrar el movimiento', 'error');
    } finally {
      const tiempo = Date.now() - inicio;
      if (tiempo < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - tiempo));
      }
      setRegistrando(false);
    }
  };

  const esEntrada = estadoInfo?.siguiente_movimiento === 'Entrada';
  const movimientosConsolidados = agruparMovimientos(recientes);

  const hour = currentTime.getHours();
  let saludo = "Buenos días";
  let iconoPorDefecto = "☀️";

  if (hour >= 12 && hour < 18) {
    saludo = "Buenas tardes";
    iconoPorDefecto = "⛅";
  } else if (hour >= 18 || hour < 6) {
    saludo = "Buenas noches";
    iconoPorDefecto = "🌙";
  }

  const icono = iconoClima || iconoPorDefecto;

  return (
    <div className="h-full flex flex-col justify-between overflow-hidden">
      
      {/* 1. ENCABEZADO PRINCIPAL EN UNA SOLA FILA */}
      <div className="flex items-center justify-between shrink-0 mb-3">
        <div className="flex items-center gap-6">
          {/* Título de la Sección */}
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight leading-none">Control de Accesos</h2>
            <p className="text-[12px] text-gray-600 dark:text-gray-400 font-medium mt-1">Registre la entrada o salida de computadores</p>
          </div>

          {/* Línea divisora vertical */}
          <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700"></div>

          {/* Saludo y Nombre del Usuario */}
          <div className="flex items-center gap-2">
            <span className="text-xl">{icono}</span>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-gray-100 leading-none text-xl">
                {saludo}, <span className="text-brand-600 dark:text-brand-400 text-xl">{user?.nombre || 'Admin'}</span>
                {temperatura !== null && (
                  <span className="ml-2 align-middle text-sm font-semibold text-gray-500 dark:text-gray-400">{temperatura}°C</span>
                )}
              </h1>
              <p className="text-[12px] text-gray-600 dark:text-gray-400 font-medium mt-0.5">Sistema Inteligente de Control de Equipos</p>
            </div>
          </div>
        </div>

        {/* RELOJ */}
        <div className="bg-surface dark:bg-gray-800 border border-gray-100/80 dark:border-gray-700 rounded-2xl px-4 py-2 shadow-sm text-right min-w-[160px]">
          <div className="text-lg font-black text-brand-600 dark:text-brand-400 font-mono tracking-tight leading-none">
            {currentTime.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
          </div>
          <div className="text-[10px] text-gray-600 dark:text-gray-400 capitalize mt-1 font-medium">
            {currentTime.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
      </div>

      {/* 2. FORMULARIO VALIDAR ACCESO Y TARJETAS DERECHA */}
      <div className="flex gap-4 items-stretch shrink-0 mb-3">
        
        {/* IZQUIERDA: FORMULARIO (MÁS AMPLIO Y CON MAYOR PADDING) */}
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

        {/* DERECHA: BOTÓN QR Y MÉTRICAS COMPACTAS */}
        <div className="w-[170px] shrink-0 flex flex-col gap-2 justify-between p-0.5 overflow-visible">
          <button
            onClick={() => setScannerOpen(true)}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white py-2.5 rounded-2xl font-bold text-xs transition-all shrink-0 animate-inner-glow hover:animate-none shadow-sm"
          >
            <ScanLine size={16} className="text-white" />
            <span>Escanear QR</span>
          </button>

          <div className="bg-[#1e2532] text-white p-3.5 rounded-2xl flex flex-col justify-between flex-1 shadow-sm">
            <Laptop size={15} className="text-gray-400 dark:text-gray-500" />
            <div>
              <div className="text-lg font-black font-mono leading-none">{stats.equipos}</div>
              <div className="text-[11px] text-gray-300 dark:text-gray-600 font-medium mt-1">
                {isSuperAdmin ? 'Movimientos Hoy (todos)' : 'Mis Movimientos Hoy'}
              </div>
            </div>
          </div>

          <div className="bg-brand-500 text-white p-3.5 rounded-2xl flex flex-col justify-between flex-1 shadow-sm">
            <Activity size={15} className="text-brand-200" />
            <div>
              <div className="text-lg font-black font-mono leading-none">{stats.equiposDentro}</div>
              <div className="text-[11px] text-brand-50 font-medium mt-1">Equipos Dentro</div>
            </div>
          </div>
        </div>

      </div>

      {/* 3. TABLA DE MOVIMIENTOS RECIENTES CON SCROLL DEDICADO */}
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
              {movimientosConsolidados.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center text-gray-600 dark:text-gray-400 py-6 text-xs">
                    Sin movimientos registrados hoy
                  </td>
                </tr>
              ) : (
                movimientosConsolidados.map((item) => (
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

      {/* 4. FOOTER ESTADO DEL SISTEMA COMPACTO Y HORIZONTAL (slider) */}
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

      <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleScanResult} />

      {registrando && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <div className="bg-surface dark:bg-gray-800 rounded-3xl shadow-2xl px-8 py-6 flex flex-col items-center">
            <div className="relative mb-4">
              <LoaderCircle className="animate-spin text-brand-600 dark:text-brand-400" size={60} strokeWidth={2.5} />
              <Laptop size={24} className="absolute inset-0 m-auto text-brand-700" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Registrando Movimiento...</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
              Espere un momento mientras se procesa la solicitud.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}