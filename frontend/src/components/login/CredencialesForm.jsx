import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LogIn } from 'lucide-react';

const inputCls = 'mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300';

// Primer paso del login: usuario y contraseña.
// usuarioInicial conserva lo escrito si se vuelve desde el paso del código.
export default function CredencialesForm({ usuarioInicial = '', cargando, onEnviar }) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onEnviar(usuario, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelCls}>Usuario</label>
        <input className={inputCls} type="text" placeholder="Ingrese su usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
      </div>
      <div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>Contraseña</label>
          <Link to="/forgot-password" className="text-xs font-semibold text-brand-600 dark:text-brand-300 hover:underline">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>
        <input className={inputCls} type="password" placeholder="Ingrese su contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <button
        type="submit"
        disabled={cargando}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
      >
        <LogIn size={17} />
        {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
      </button>
    </form>
  );
}
