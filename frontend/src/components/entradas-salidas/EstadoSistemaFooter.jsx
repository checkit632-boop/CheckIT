// Barra "Estado del sistema" de Control de Acceso. Muestra el estado REAL:
// cada 30 segundos consulta /api/health, que confirma que el servidor
// responde y que la base de datos atiende consultas. Antes eran etiquetas
// fijas ("Conectada", "Disponible") que se desplazaban en bucle y aparecían
// repetidas, aunque el servidor estuviera caído.
import { useEffect, useState } from 'react';
import { Activity } from 'lucide-react';
import api from '../../api/client';

const INTERVALO_MS = 30000;

const ESTILOS = {
  ok: 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300',
  error: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  verificando: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
};

function Indicador({ nombre, estado, textoOk, textoError }) {
  const texto = estado === 'ok' ? textoOk : estado === 'error' ? textoError : 'Verificando…';
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-gray-600 dark:text-gray-400">{nombre}</span>
      <span className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${ESTILOS[estado]}`}>{texto}</span>
    </span>
  );
}

export default function EstadoSistemaFooter({ lastUpdate }) {
  const [servidor, setServidor] = useState('verificando');
  const [baseDeDatos, setBaseDeDatos] = useState('verificando');

  useEffect(() => {
    let activo = true;
    const verificar = async () => {
      try {
        const { data } = await api.get('/health');
        if (!activo) return;
        setServidor('ok');
        setBaseDeDatos(data.baseDeDatos === 'ok' ? 'ok' : 'error');
      } catch (err) {
        if (!activo) return;
        // 503: el servidor responde pero la base de datos falla.
        if (err.response?.status === 503) {
          setServidor('ok');
          setBaseDeDatos('error');
        } else {
          setServidor('error');
          setBaseDeDatos('error');
        }
      }
    };
    verificar();
    const id = setInterval(verificar, INTERVALO_MS);
    return () => { activo = false; clearInterval(id); };
  }, []);

  return (
    <div className="flex items-center justify-between text-xs pt-1 shrink-0 gap-3">
      <div className="flex items-center gap-5 min-w-0 flex-wrap text-[11px]">
        <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100 shrink-0">
          <Activity size={14} className="text-brand-600 dark:text-brand-400" />
          <span>Estado del sistema</span>
        </div>
        <Indicador nombre="Servidor" estado={servidor} textoOk="Conectado" textoError="Sin conexión" />
        <Indicador nombre="Base de datos" estado={baseDeDatos} textoOk="Operativa" textoError="Con fallas" />
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
