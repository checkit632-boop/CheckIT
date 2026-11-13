// Visor de la base de datos (v7.0), desde Auditoría y solo para el Super
// Administrador. Pide la contraseña y un código de 6 dígitos que llega al
// correo; luego muestra las tablas en SOLO LECTURA durante 15 minutos.
// Las contraseñas y los códigos aparecen ocultos. El permiso temporal se
// guarda solo en la memoria de esta ventana: al cerrarla, hay que pedirlo de nuevo.
import { useCallback, useEffect, useState } from 'react';
import { Database, KeyRound, ShieldCheck, RefreshCw, Lock } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const POR_PAGINA = 50;

export default function VisorBaseDatos({ open, onClose }) {
  const [paso, setPaso] = useState('password');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [token, setToken] = useState(null);
  const [vence, setVence] = useState(null);
  const [tablas, setTablas] = useState([]);
  const [tabla, setTabla] = useState(null);
  const [datos, setDatos] = useState(null);
  const [pagina, setPagina] = useState(1);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const reiniciar = useCallback((aviso = '') => {
    setPaso('password');
    setPassword('');
    setCodigo('');
    setToken(null);
    setVence(null);
    setTablas([]);
    setTabla(null);
    setDatos(null);
    setPagina(1);
    setMensaje('');
    setError(aviso);
  }, []);

  const cerrar = () => {
    reiniciar();
    onClose();
  };

  const manejarError = useCallback(
    (err) => {
      if (err.response?.data?.visorVencido) reiniciar(err.response.data.error);
      else setError(err.response?.data?.error || 'No se pudo completar la acción.');
    },
    [reiniciar]
  );

  const solicitar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const { data } = await api.post('/visor/solicitar', { password });
      setPassword('');
      setMensaje(data.mensaje);
      setPaso('codigo');
    } catch (err) {
      manejarError(err);
    } finally {
      setCargando(false);
    }
  };

  const verificar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);
    try {
      const { data } = await api.post('/visor/verificar', { codigo });
      setToken(data.token);
      setVence(new Date(Date.now() + data.minutos * 60000));
      setCodigo('');
      setPaso('visor');
    } catch (err) {
      manejarError(err);
    } finally {
      setCargando(false);
    }
  };

  const cabecera = useCallback(() => ({ headers: { 'X-Visor-Token': token } }), [token]);

  useEffect(() => {
    if (paso !== 'visor' || !token) return;
    api
      .get('/visor/tablas', cabecera())
      .then(({ data }) => {
        setTablas(data);
        setTabla((t) => t || data[0]?.nombre || null);
      })
      .catch(manejarError);
  }, [paso, token, cabecera, manejarError]);

  const cargarTabla = useCallback(() => {
    if (!tabla || !token) return;
    setCargando(true);
    api
      .get(`/visor/tablas/${encodeURIComponent(tabla)}`, {
        ...cabecera(),
        params: { pagina, por_pagina: POR_PAGINA },
      })
      .then(({ data }) => {
        setDatos(data);
        setError('');
      })
      .catch(manejarError)
      .finally(() => setCargando(false));
  }, [tabla, pagina, token, cabecera, manejarError]);

  useEffect(() => {
    cargarTabla();
  }, [cargarTabla]);

  const totalPaginas = datos ? Math.max(1, Math.ceil(datos.total / datos.por_pagina)) : 1;
  const celda = (v) =>
    v === null || v === undefined ? (
      <span className="text-gray-400">NULL</span>
    ) : (
      <span title={String(v)} className="block max-w-[280px] truncate">
        {String(v)}
      </span>
    );

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Base de datos (solo lectura)"
      maxWidth={paso === 'visor' ? 'max-w-6xl' : 'max-w-md'}
    >
      {paso !== 'visor' && (
        <div className="flex gap-3 rounded-xl bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 p-3 mb-4 text-sm text-brand-900 dark:text-brand-100">
          <Lock size={18} className="shrink-0 mt-0.5" />
          <p>
            Acceso protegido: confirma tu contraseña y el código que llegará a tu correo. El acceso
            dura 15 minutos y queda registrado en la auditoría.
          </p>
        </div>
      )}
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-sm px-3 py-2">
          {error}
        </p>
      )}

      {paso === 'password' && (
        <form onSubmit={solicitar} className="space-y-3">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <KeyRound size={15} /> Tu contraseña
          </label>
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            className={inputCls}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="submit"
            disabled={!password || cargando}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl"
          >
            {cargando ? 'Verificando…' : 'Enviar código al correo'}
          </button>
        </form>
      )}

      {paso === 'codigo' && (
        <form onSubmit={verificar} className="space-y-3">
          {mensaje && <p className="text-sm text-gray-600 dark:text-gray-300">{mensaje}</p>}
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
            <ShieldCheck size={15} /> Código de 6 dígitos
          </label>
          <input
            autoFocus
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            className={`${inputCls} text-center tracking-[0.5em] font-mono-num text-lg`}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
          />
          <button
            type="submit"
            disabled={codigo.length !== 6 || cargando}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold text-sm py-2.5 rounded-xl"
          >
            {cargando ? 'Verificando…' : 'Abrir la base de datos'}
          </button>
          <button
            type="button"
            onClick={() => reiniciar()}
            className="w-full text-xs text-gray-500 hover:underline"
          >
            Volver a pedir el código
          </button>
        </form>
      )}

      {paso === 'visor' && (
        <div className="flex flex-col md:flex-row gap-4">
          <aside className="md:w-56 shrink-0">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
              <Database size={13} /> Tablas ({tablas.length})
            </div>
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible md:max-h-[60vh] md:overflow-y-auto pb-1">
              {tablas.map((t) => (
                <button
                  key={t.nombre}
                  type="button"
                  onClick={() => {
                    setTabla(t.nombre);
                    setPagina(1);
                  }}
                  className={`shrink-0 text-left rounded-lg px-3 py-1.5 text-xs font-semibold flex justify-between gap-2 ${tabla === t.nombre ? 'bg-brand-600 text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'}`}
                >
                  <span className="font-mono-num">{t.nombre}</span>
                  <span className="opacity-75">{t.filas}</span>
                </button>
              ))}
            </div>
          </aside>
          <section className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs text-gray-600 dark:text-gray-300">
              <span>
                <strong className="font-mono-num">{datos?.tabla}</strong> · {datos?.total ?? 0}{' '}
                fila(s) · fechas en UTC (Colombia = UTC − 5)
                {vence
                  ? ` · el acceso vence a las ${vence.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </span>
              <button
                type="button"
                onClick={cargarTabla}
                className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <RefreshCw size={13} /> Actualizar
              </button>
            </div>
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-auto max-h-[55vh]">
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 sticky top-0">
                  <tr>
                    {datos?.columnas.map((c) => (
                      <th key={c.nombre} className="text-left px-3 py-2 font-bold">
                        {c.nombre}
                        {c.llave ? ' 🔑' : ''}
                        <div className="font-normal text-[10px] text-gray-400">{c.tipo}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200 font-mono-num">
                  {datos?.filas.length === 0 && (
                    <tr>
                      <td
                        colSpan={datos.columnas.length || 1}
                        className="text-center py-8 text-gray-500"
                      >
                        La tabla está vacía.
                      </td>
                    </tr>
                  )}
                  {datos?.filas.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      {datos.columnas.map((c) => (
                        <td key={c.nombre} className="px-3 py-1.5">
                          {celda(f[c.nombre])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2 text-xs text-gray-600 dark:text-gray-300">
              <button
                type="button"
                disabled={pagina <= 1 || cargando}
                onClick={() => setPagina((n) => n - 1)}
                className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                disabled={pagina >= totalPaginas || cargando}
                onClick={() => setPagina((n) => n + 1)}
                className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          </section>
        </div>
      )}
    </Modal>
  );
}
