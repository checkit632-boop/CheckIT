import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../api/client';
import AuthBackground from '../components/AuthBackground';

export default function ForgotPassword() {
  const [paso, setPaso] = useState('solicitar'); // 'solicitar' | 'restablecer'
  const [identificador, setIdentificador] = useState('');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSolicitar = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { identificador });
      setMensaje(data.mensaje);
      setPaso('restablecer');
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleRestablecer = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) { setError('Las contraseñas no coinciden'); return; }
    if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { identificador, codigo, password });
      setMensaje('Contraseña actualizada. Ya puedes iniciar sesión.');
      setTimeout(() => navigate('/login'), 1600);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo restablecer la contraseña');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-brand-950 p-4">
      <AuthBackground />

      <div className="relative z-10 bg-surface dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center mb-3">
            <KeyRound className="text-brand-700 dark:text-brand-300" size={26} />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Recuperar contraseña</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {paso === 'solicitar'
              ? 'Ingresa tu usuario o correo y te enviaremos un código de verificación'
              : 'Ingresa el código que recibiste y define tu nueva contraseña'}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-3 py-2.5 mb-4">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}
        {mensaje && paso === 'restablecer' && (
          <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 text-sm rounded-xl px-3 py-2.5 mb-4">
            <CheckCircle2 size={16} />
            <span>{mensaje}</span>
          </div>
        )}

        {paso === 'solicitar' ? (
          <form onSubmit={handleSolicitar} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Usuario o correo electrónico</label>
              <input
                className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="usuario o correo@ejemplo.com"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? 'Enviando...' : 'Enviar código'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRestablecer} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Código de 6 dígitos</label>
              <input
                className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-center text-lg tracking-[.5em] font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                inputMode="numeric"
                maxLength={6}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Nueva contraseña</label>
              <input type="password" className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Confirmar nueva contraseña</label>
              <input type="password" className="mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500" value={password2} onChange={(e) => setPassword2(e.target.value)} required />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {loading ? 'Guardando...' : 'Restablecer contraseña'}
            </button>
            <button type="button" onClick={() => setPaso('solicitar')} className="w-full text-xs text-gray-500 dark:text-gray-400 hover:underline">
              Solicitar un nuevo código
            </button>
          </form>
        )}

        <p className="text-center text-sm mt-5">
          <Link to="/login" className="inline-flex items-center gap-1 text-brand-600 dark:text-brand-300 font-medium hover:underline">
            <ArrowLeft size={14} /> Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}