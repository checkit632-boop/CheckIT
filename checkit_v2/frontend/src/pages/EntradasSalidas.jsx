  import { useEffect, useState } from 'react';
  import { ScanLine, Search, ArrowDownCircle, ArrowUpCircle, Clock } from 'lucide-react';
  import api from '../api/client';
  import { useToast } from '../context/ToastContext';
  import QRScannerModal from '../components/QRScannerModal';

  const fmtHora = (iso) => (iso ? new Date(iso.replace(' ', 'T') + 'Z').toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  export default function EntradasSalidas() {
    const { showToast } = useToast();
    const [serialQuery, setSerialQuery] = useState('');
    const [equipo, setEquipo] = useState(null);
    const [estadoInfo, setEstadoInfo] = useState(null); // { estado, siguiente_movimiento, ultima_entrada, ultima_salida }
    const [observaciones, setObservaciones] = useState('');
    const [scannerOpen, setScannerOpen] = useState(false);
    const [recientes, setRecientes] = useState([]);
    const [searching, setSearching] = useState(false);
    const [registrando, setRegistrando] = useState(false);

    const loadRecientes = async () => {
      try {
        const { data } = await api.get('/registros?limit=10');
        setRecientes(data);
      } catch (err) { /* silent */ }
    };

    useEffect(() => { loadRecientes(); }, []);

    const cargarEstado = async (idEquipo) => {
      try {
        const { data } = await api.get(`/registros/estado/${idEquipo}`);
        setEstadoInfo(data);
      } catch (err) {
        setEstadoInfo(null);
      }
    };

    const buscarEquipo = async (serial) => {
      if (!serial.trim()) return;
      setSearching(true);
      try {

    const { data } = await api.get(`/equipos/serial/${encodeURIComponent(serial.trim())}`);
    setEquipo(data);
    await cargarEstado(data.id_equipo);
    showToast('Equipo encontrado ✓');
    return data;
  } catch (err) {
    setEquipo(null);
    setEstadoInfo(null);
    showToast('No se encontró un equipo con ese serial', 'error');
    return null;
  }
    };

    const handleScanResult = async (serial) => {
  setScannerOpen(false);
  setSerialQuery(serial);

  if (!serial.trim()) return;

  setSearching(true);
  setRegistrando(true);

  try {
    // Buscar el equipo
    const { data: equipoData } = await api.get(
      `/equipos/serial/${encodeURIComponent(serial.trim())}`
    );

    // Consultar el estado actual
    const { data: estadoData } = await api.get(
      `/registros/estado/${equipoData.id_equipo}`
    );

    // Mostrar la información del equipo
    setEquipo(equipoData);
    setEstadoInfo(estadoData);

    // Registrar automáticamente
    await api.post('/registros', {
      serial: equipoData.serial,
      tipo: estadoData.siguiente_movimiento,
      observaciones: ''
    });

    showToast(
      `Movimiento de ${estadoData.siguiente_movimiento.toLowerCase()} registrado con éxito — ${new Date().toLocaleTimeString('es-CO')}`
    );

    // Actualizar movimientos recientes
    await loadRecientes();

    // Consultar nuevamente el estado para que quede actualizado
    const { data: nuevoEstado } = await api.get(
      `/registros/estado/${equipoData.id_equipo}`
    );

    setEstadoInfo(nuevoEstado);

    // Limpiar formulario después de 2 segundos
    setTimeout(() => {
      setEquipo(null);
      setEstadoInfo(null);
      setSerialQuery('');
      setObservaciones('');

      // Volver a abrir el escáner automáticamente
      setScannerOpen(true);
    }, 2000);

  } catch (err) {
    showToast(
      err.response?.data?.error || 'No se pudo registrar el movimiento',
      'error'
    );
  } finally {
    setSearching(false);
    setRegistrando(false);
  }
};

    const registrar = async () => {
      if (!equipo || !estadoInfo) { showToast('Realiza una búsqueda primero', 'error'); return; }
      const tipo = estadoInfo.siguiente_movimiento; // 'Entrada' o 'Salida', según el estado actual del equipo
      setRegistrando(true);
      try {
        await api.post('/registros', { serial: equipo.serial, tipo, observaciones });
        showToast(`Movimiento de ${tipo.toLowerCase()} registrado con éxito — ${new Date().toLocaleTimeString('es-CO')}`);
        setEquipo(null);
        setEstadoInfo(null);
        setSerialQuery('');
        setObservaciones('');
        loadRecientes();
      } catch (err) {
        showToast(err.response?.data?.error || 'No se pudo registrar el movimiento', 'error');
      } finally {
        setRegistrando(false);
      }
    };

    const esEntrada = estadoInfo?.siguiente_movimiento === 'Entrada';

    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Control de Accesos</h1>
          <p className="text-sm text-gray-500 mt-1">Registre la entrada o salida de computadores</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Formulario de validación */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <span className="font-bold text-gray-900">Validar Acceso</span>
              <button onClick={() => setScannerOpen(true)} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-200 text-brand-800 text-xs font-semibold px-3 py-1.5 rounded-lg">
                <ScanLine size={14} /> Escanear QR
              </button>
            </div>
            <div className="p-5">
              <label className="text-sm font-semibold text-gray-700">Serial del equipo</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  placeholder="Escribe o escanea el serial..."
                  value={serialQuery}
                  onChange={(e) => setSerialQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && buscarEquipo(serialQuery)}
                />
                <button onClick={() => buscarEquipo(serialQuery)} disabled={searching} className="bg-gray-800 hover:bg-gray-900 text-white px-4 rounded-xl">
                  <Search size={16} />
                </button>
              </div>

              {equipo && (
                <div className="mt-4 border border-brand-200 bg-brand-50 rounded-xl p-4 text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold text-brand-800 uppercase tracking-wide">✓ Equipo encontrado</p>
                    {estadoInfo && (
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${esEntrada ? 'bg-gray-800 text-white' : 'bg-brand-600 text-white'}`}>
                        {estadoInfo.estado === 'Afuera' ? 'Actualmente: Afuera' : 'Actualmente: Adentro'}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="text-gray-500 text-xs">Marca / Modelo</span><br /><strong>{equipo.nombre_marca} {equipo.modelo}</strong></div>
                    <div><span className="text-gray-500 text-xs">Serial</span><br /><strong className="font-mono-num">{equipo.serial}</strong></div>
                    <div className="col-span-2"><span className="text-gray-500 text-xs">Responsable</span><br /><strong>{equipo.persona_nombres} {equipo.persona_apellidos}</strong> <span className="text-gray-400 text-xs">({equipo.numero_documento})</span></div>
                    <div className="col-span-2"><span className="text-gray-500 text-xs">Estado físico</span><br /><span className="px-2 py-0.5 rounded-full bg-white text-xs font-semibold border border-brand-200">{equipo.nombre_estado}</span></div>
                  </div>

                  {estadoInfo && (
                    <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-brand-200">
                      <div className="flex items-start gap-1.5">
                        <Clock size={13} className="text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-500 text-xs block">Última entrada</span>
                          <span className="text-xs font-mono-num">{fmtHora(estadoInfo.ultima_entrada)}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <Clock size={13} className="text-gray-400 mt-0.5" />
                        <div>
                          <span className="text-gray-500 text-xs block">Última salida</span>
                          <span className="text-xs font-mono-num">{fmtHora(estadoInfo.ultima_salida)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="text-sm font-semibold text-gray-700">Observaciones (opcional)</label>
                <textarea
                  className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
                  rows={2}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              </div>

              {/* Botón dinámico: cambia según si el equipo está adentro o afuera */}
              <button
                onClick={registrar}
                disabled={!equipo || registrando}
                className={`w-full mt-4 flex items-center justify-center gap-2 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 ${
                  esEntrada
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700'
                    : 'bg-gray-800 hover:bg-gray-900'
                }`}
              >
                {esEntrada ? <ArrowDownCircle size={16} /> : <ArrowUpCircle size={16} />}
                {registrando ? 'Registrando...' : esEntrada ? 'Registrar Entrada' : 'Registrar Salida'}
              </button>
            </div>
          </div>

          {/* Movimientos recientes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Movimientos Recientes</div>
            <div className="divide-y divide-gray-50 max-h-[420px] overflow-y-auto">
              {recientes.length === 0 && <p className="text-center text-gray-400 py-10 text-sm">Sin movimientos</p>}
              {recientes.map((m) => (
                <div key={m.id_registro} className="px-5 py-3 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-semibold">{m.nombre_marca} {m.modelo}</div>
                    <div className="text-xs text-gray-400 font-mono-num">{m.serial}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{m.persona_nombres} {m.persona_apellidos}</div>
                  </div>
                  <div className="text-right">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${m.nombre_movimiento === 'Entrada' ? 'bg-brand-100 text-brand-800' : 'bg-gray-800 text-white'}`}>
                      {m.nombre_movimiento}
                    </span>
                    <div className="text-[11px] text-gray-400 font-mono-num mt-1">{fmtHora(m.fecha_hora)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <QRScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onResult={handleScanResult} />
      </div>
    );
  }
