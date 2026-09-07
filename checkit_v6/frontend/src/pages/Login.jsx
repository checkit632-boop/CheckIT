import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, ShieldCheck, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AuthBackground from '../components/AuthBackground';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, verifyLoginCode, resendLoginCode } = useAuth();
  const navigate = useNavigate();

  // Tercer factor de seguridad: paso de verificación por código.
  const [paso, setPaso] = useState('credenciales'); // 'credenciales' | 'codigo'
  const [idUsuarioPendiente, setIdUsuarioPendiente] = useState(null);
  const [codigo, setCodigo] = useState('');
  const [infoCodigo, setInfoCodigo] = useState('');
  const [reenviando, setReenviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const resultado = await login(usuario, password);
      if (resultado.requiereCodigo) {
        setIdUsuarioPendiente(resultado.id_usuario);
        setInfoCodigo(resultado.mensaje || 'Ingresa el código enviado a tu correo.');
        setPaso('codigo');
      } else {
        navigate('/entradas-salidas');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Usuario o contraseña incorrectos');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyLoginCode(idUsuarioPendiente, codigo);
      navigate('/entradas-salidas');
    } catch (err) {
      setError(err.response?.data?.error || 'Código incorrecto');
    } finally {
      setLoading(false);
    }
  };

  const handleReenviar = async () => {
    setReenviando(true);
    setError('');
    try {
      const data = await resendLoginCode(idUsuarioPendiente);
      setInfoCodigo(data.mensaje || 'Se envió un nuevo código.');
    } catch (err) {
      setError('No se pudo reenviar el código');
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-950 p-4">
      <AuthBackground />

      {/* Tarjeta del formulario, por encima del fondo */}
      <div className="relative z-10 bg-surface dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <img src="/logo.png" alt="Logo del sistema CheckIT" className="w-32 mx-auto" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">CheckIT</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sistema de Control de Equipos de Cómputo</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-3 py-2.5 mb-4">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {paso === 'credenciales' ? (
          <>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Usuario</label>
                <input
                  className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  type="text"
                  placeholder="Ingrese su usuario"
                  value={usuario}
                  onChange={(e) => setUsuario(e.target.value)}
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Contraseña</label>
                  <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <input
                  className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                  type="password"
                  placeholder="Ingrese su contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
              >
                <LogIn size={17} />
                {loading ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleVerificarCodigo} className="space-y-4">
            <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 text-sm rounded-xl px-3 py-2.5">
              <ShieldCheck size={16} />
              <span>{infoCodigo}</span>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Código de verificación</label>
              <input
                className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-center text-lg tracking-[.5em] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || codigo.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              <ShieldCheck size={17} />
              {loading ? 'Verificando...' : 'Verificar y entrar'}
            </button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setPaso('credenciales'); setCodigo(''); }}
                className="text-gray-500 dark:text-gray-400 hover:underline"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleReenviar}
                disabled={reenviando}
                className="flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-300 hover:underline disabled:opacity-60"
              >
                <RotateCcw size={12} /> Reenviar código
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}