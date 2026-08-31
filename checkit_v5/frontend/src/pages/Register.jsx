import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, CheckCircle2 } from 'lucide-react';
import api from '../api/client';

const TIPOS_DOCUMENTO = [
  { id: 1, label: 'Cédula de ciudadanía' },
  { id: 2, label: 'Tarjeta de identidad' },
  { id: 3, label: 'Cédula extranjera' },
  { id: 4, label: 'Pasaporte' },
];

const inputCls = 'mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700';

export default function Register() {
  const [form, setForm] = useState({
    nombre: '', apellidos: '', id_tipo_documento: 1, numero_documento: '',
    celular: '', correo: '', usuario: '', password: '', password2: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const { nombre, apellidos, numero_documento, correo, usuario, password, password2 } = form;

    if (!nombre || !apellidos || !numero_documento || !correo || !usuario || !password) {
      setError('Por favor completa todos los campos'); return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden'); return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres'); return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', { ...form, id_tipo_documento: Number(form.id_tipo_documento) });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo completar el registro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-950 via-gray-900 to-brand-900 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">Registro de Usuario</h1>
          <p className="text-sm text-gray-500 mt-1">Complete el formulario para crear una cuenta</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2.5 mb-4">{error}</div>}
        {success && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-300 text-brand-800 text-sm rounded-xl px-3 py-2.5 mb-4">
            <CheckCircle2 size={16} />
            Usuario registrado exitosamente. Redirigiendo...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Nombre</label><input className={inputCls} value={form.nombre} onChange={set('nombre')} placeholder="Juan" /></div>
            <div><label className={labelCls}>Apellidos</label><input className={inputCls} value={form.apellidos} onChange={set('apellidos')} placeholder="Pérez García" /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Tipo de Documento</label>
              <select className={inputCls} value={form.id_tipo_documento} onChange={set('id_tipo_documento')}>
                {TIPOS_DOCUMENTO.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Documento</label><input className={inputCls} value={form.numero_documento} onChange={set('numero_documento')} placeholder="1234567890" /></div>
            <div><label className={labelCls}>Celular</label><input className={inputCls} value={form.celular} onChange={set('celular')} placeholder="+57 300 0000000" /></div>
          </div>
          <div><label className={labelCls}>Correo Electrónico</label><input type="email" className={inputCls} value={form.correo} onChange={set('correo')} placeholder="correo@ejemplo.com" /></div>
          <div><label className={labelCls}>Usuario</label><input className={inputCls} value={form.usuario} onChange={set('usuario')} placeholder="mi_usuario" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Contraseña</label><input type="password" className={inputCls} value={form.password} onChange={set('password')} /></div>
            <div><label className={labelCls}>Confirmar Contraseña</label><input type="password" className={inputCls} value={form.password2} onChange={set('password2')} /></div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 hover:to-brand-600 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              <UserPlus size={16} />
              Registrar
            </button>
            <Link to="/login" className="flex-1 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl transition-colors">
              Cancelar
            </Link>
          </div>
        </form>
        <p className="text-center text-xs text-gray-400 mt-4">
          Nota: las cuentas creadas aquí obtienen el rol de <strong>Operador de Sistema</strong>.
        </p>
      </div>
    </div>
  );
}
