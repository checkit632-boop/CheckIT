// NC-8: este archivo antes concentraba formulario de registro, lectura de
// QR, validación de estado del equipo, histórico y estilos del slider de
// estado — todo junto, en más de 600 líneas. Ahora solo se encarga de:
// manejar el estado del módulo y la comunicación con la API; la UI de cada
// bloque vive en sus propios componentes (components/entradas-salidas/*) y
// las utilidades genéricas (fecha, clima) en utils/.
import { useEffect, useState } from 'react';
import { ScanLine, LoaderCircle, Laptop, Activity } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import QRScannerModal from '../components/QRScannerModal';
import { playEntrada, playSalida, playError } from '../utils/sounds';
import { useClima } from '../utils/clima';
import ValidarAccesoCard from '../components/entradas-salidas/ValidarAccesoCard';
import MovimientosRecientesPanel from '../components/entradas-salidas/MovimientosRecientesPanel';
import EstadoSistemaFooter from '../components/entradas-salidas/EstadoSistemaFooter';

// Agrupación que ordena el equipo recién escaneado al inicio de la tabla
function agruparMovimientos(logs) {
  if (!logs || logs.length === 0) return [];

  const mapa = new Map();
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

  return Array.from(mapa.values()).sort((a, b) => b.ultimoIdRegistro - a.ultimoIdRegistro);
}

export default function ControlAccesos() {
  const { showToast } = useToast();
  const { user, isSuperAdmin } = useAuth();
  const { iconoClima, temperatura } = useClima();

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

  const determinarSiguienteMovimiento = (idEquipo, serial, estadoBackend) => {
    const registroReciente = recientes.find(
      (m) => m.serial?.toLowerCase() === serial?.toLowerCase() || m.id_equipo === idEquipo
    );

    if (registroReciente) {
      const ultimoTipo = (registroReciente.nombre_movimiento || '').toLowerCase();
      return {
        ...estadoBackend,
        siguiente_movimiento: ultimoTipo === 'entrada' ? 'Salida' : 'Entrada'
      };
    }

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
          <div>
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight leading-none">Control de Accesos</h2>
            <p className="text-[12px] text-gray-600 dark:text-gray-400 font-medium mt-1">Registre la entrada o salida de computadores</p>
          </div>

          <div className="h-8 w-[1px] bg-gray-200 dark:bg-gray-700"></div>

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
        <ValidarAccesoCard
          serialQuery={serialQuery}
          setSerialQuery={setSerialQuery}
          buscarEquipo={buscarEquipo}
          searching={searching}
          equipo={equipo}
          estadoInfo={estadoInfo}
          registrar={registrar}
          registrando={registrando}
          esEntrada={esEntrada}
        />

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

      {/* 3. TABLA DE MOVIMIENTOS RECIENTES */}
      <MovimientosRecientesPanel movimientos={movimientosConsolidados} isSuperAdmin={isSuperAdmin} />

      {/* 4. FOOTER ESTADO DEL SISTEMA */}
      <EstadoSistemaFooter lastUpdate={lastUpdate} />

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
