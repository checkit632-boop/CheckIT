import { useState } from 'react';
import { ShieldCheck, RotateCcw } from 'lucide-react';

// Segundo paso del login (tercer factor de seguridad): PIN de 6 dígitos
// enviado al correo. Solo se aceptan dígitos y el botón se habilita con 6.
export default function CodigoVerificacionForm({ info, cargando, reenviando, onVerificar, onReenviar, onVolver }) {
  const [codigo, setCodigo] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onVerificar(codigo);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 text-sm rounded-xl px-3 py-2.5">
        <ShieldCheck size={16} />
        <span>{info}</span>
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
        disabled={cargando || codigo.length !== 6}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
      >
        <ShieldCheck size={17} />
        {cargando ? 'Verificando...' : 'Verificar y entrar'}
      </button>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={onVolver} className="text-gray-500 dark:text-gray-400 hover:underline">
          Volver
        </button>
        <button
          type="button"
          onClick={onReenviar}
          disabled={reenviando}
          className="flex items-center gap-1 font-semibold text-brand-600 dark:text-brand-300 hover:underline disabled:opacity-60"
        >
          <RotateCcw size={12} /> Reenviar código
        </button>
      </div>
    </form>
  );
}
