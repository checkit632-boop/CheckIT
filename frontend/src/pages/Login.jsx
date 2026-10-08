import { AlertCircle } from 'lucide-react';
import AuthBackground from '../components/AuthBackground';
import CredencialesForm from '../components/login/CredencialesForm';
import CodigoVerificacionForm from '../components/login/CodigoVerificacionForm';
import useLogin from '../hooks/useLogin';

// Pantalla de inicio de sesión. Solo maqueta: el flujo de los dos pasos
// (credenciales y código de verificación) vive en hooks/useLogin.js.
export default function Login() {
  const {
    paso, error, cargando, reenviando, infoCodigo, ultimoUsuario,
    enviarCredenciales, verificarCodigo, reenviarCodigo, volverACredenciales,
  } = useLogin();

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
          <CredencialesForm usuarioInicial={ultimoUsuario} cargando={cargando} onEnviar={enviarCredenciales} />
        ) : (
          <CodigoVerificacionForm
            info={infoCodigo}
            cargando={cargando}
            reenviando={reenviando}
            onVerificar={verificarCodigo}
            onReenviar={reenviarCodigo}
            onVolver={volverACredenciales}
          />
        )}
      </div>
    </div>
  );
}
