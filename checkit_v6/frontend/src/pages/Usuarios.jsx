import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const inputCls = 'mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300';

export default function Usuarios() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tiposDocumento, setTiposDocumento] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = {
    usuario: '', nombre: '', apellidos: '', correo: '', celular: '',
    id_tipo_documento: '', numero_documento: '',
    password: '', id_rol: '',
  };
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    try {
      const [u, r, td] = await Promise.all([
        api.get('/usuarios'),
        api.get('/usuarios/roles/all'),
        api.get('/catalogos/tipos-documento'),
      ]);
      setUsuarios(u.data);
      setRoles(r.data);
      setTiposDocumento(td.data);
    } catch (err) {
      showToast('Error al cargar usuarios', 'error');
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return usuarios;
    const s = search.toLowerCase();
    return usuarios.filter((u) => [u.nombre, u.apellidos, u.usuario, u.correo, u.rol, u.numero_documento].join(' ').toLowerCase().includes(s));
  }, [usuarios, search]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, id_rol: roles[0]?.id_rol || '', id_tipo_documento: tiposDocumento[0]?.id_tipo_documento || '' });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id_usuario);
    setForm({
      usuario: u.usuario, nombre: u.nombre, apellidos: u.apellidos, correo: u.correo || '', celular: u.celular || '',
      id_tipo_documento: u.id_tipo_documento || tiposDocumento[0]?.id_tipo_documento || '',
      numero_documento: u.numero_documento || '',
      password: '', id_rol: u.id_rol,
    });
    setModalOpen(true);
  };

  const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.id_tipo_documento || !form.numero_documento) {
      showToast('El tipo y número de documento son obligatorios', 'error');
      return;
    }
    if (!form.correo || !CORREO_REGEX.test(form.correo)) {
      showToast('El correo es obligatorio y debe ser real: ahí llegará el PIN de inicio de sesión', 'error');
      return;
    }
    try {
      if (editingId) {
        await api.put(`/usuarios/${editingId}`, form);
        showToast('Usuario actualizado exitosamente');
      } else {
        if (!form.password) { showToast('La contraseña es obligatoria para usuarios nuevos', 'error'); return; }
        await api.post('/usuarios', form);
        showToast('Usuario registrado exitosamente');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo guardar el usuario', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await api.delete(`/usuarios/${id}`);
      showToast('Usuario eliminado');
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    }
  };

  // Inactivar/activar (solo Super Administrador) — para cuando la persona
  // se retiró. No borra su historial de auditoría ni sus movimientos.
  const handleToggleEstado = async (u) => {
    const accion = u.estado ? 'inactivar' : 'activar';
    if (!confirm(`¿Seguro que quieres ${accion} a ${u.nombre} ${u.apellidos}?`)) return;
    try {
      await api.patch(`/usuarios/${u.id_usuario}/estado`, { estado: !u.estado });
      showToast(`Usuario ${u.estado ? 'inactivado' : 'activado'} correctamente`);
      load();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo actualizar el estado', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Administra los usuarios del sistema (según tu rol: Administradores y/o Operadores)</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500" placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={openNew} disabled={roles.length === 0} className="ml-auto flex items-center gap-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-2.5">Usuario</th>
              <th className="text-left px-5 py-2.5">Nombre</th>
              <th className="text-left px-5 py-2.5">Documento</th>
              <th className="text-left px-5 py-2.5">Correo</th>
              <th className="text-left px-5 py-2.5">Rol</th>
              <th className="text-left px-5 py-2.5">Estado</th>
              <th className="text-left px-5 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
            {filtered.map((u) => (
              <tr key={u.id_usuario} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-5 py-3 font-mono-num font-semibold">@{u.usuario}</td>
                <td className="px-5 py-3">{u.nombre} {u.apellidos}</td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-400">
                  {u.numero_documento ? (
                    <>
                      <div className="font-mono-num">{u.numero_documento}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500">{u.tipo_documento}</div>
                    </>
                  ) : (
                    <span className="text-gray-300 dark:text-gray-600 text-xs italic">Sin registrar</span>
                  )}
                </td>
                <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.correo}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.rol === 'Super Administrador' ? 'bg-brand-800 text-white' : u.rol === 'Administrador' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'}`}>{u.rol}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.estado ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}>{u.estado ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"><Pencil size={15} /></button>
                    {isSuperAdmin && u.id_usuario !== currentUser.id_usuario && (
                      <button
                        onClick={() => handleToggleEstado(u)}
                        title={u.estado ? 'Inactivar usuario' : 'Activar usuario'}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${u.estado ? 'text-amber-600' : 'text-brand-600'}`}
                      >
                        {u.estado ? <PowerOff size={15} /> : <Power size={15} />}
                      </button>
                    )}
                    {u.id_usuario !== currentUser.id_usuario && (
                      <button onClick={() => handleDelete(u.id_usuario)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500"><Trash2 size={15} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Usuario' : 'Nuevo Usuario'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Nombre</label><input className={inputCls} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required /></div>
            <div><label className={labelCls}>Apellidos</label><input className={inputCls} value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} required /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Tipo de documento</label>
              <select className={inputCls} value={form.id_tipo_documento} onChange={(e) => setForm((f) => ({ ...f, id_tipo_documento: Number(e.target.value) }))} required>
                <option value="">Seleccione...</option>
                {tiposDocumento.map((td) => <option key={td.id_tipo_documento} value={td.id_tipo_documento}>{td.nombre_documento}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Número de documento</label>
              <input className={inputCls} value={form.numero_documento} onChange={(e) => setForm((f) => ({ ...f, numero_documento: e.target.value }))} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Correo <span className="text-red-500">*</span></label>
              <input
                type="email"
                className={inputCls}
                value={form.correo}
                onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))}
                placeholder="correo@real.com"
                required
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Debe ser un correo real y al que la persona tenga acceso: ahí le llegará el PIN de 6 dígitos para iniciar sesión.</p>
            </div>
            <div><label className={labelCls}>Celular</label><input className={inputCls} value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>Usuario</label><input className={inputCls} value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} required /></div>
          <div>
            <label className={labelCls}>Contraseña {editingId && <span className="text-gray-400 dark:text-gray-500 font-normal">(dejar en blanco para no cambiar)</span>}</label>
            <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div>
            <label className={labelCls}>Rol</label>
            <select className={inputCls} value={form.id_rol} onChange={(e) => setForm((f) => ({ ...f, id_rol: Number(e.target.value) }))}>
              {roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">Guardar Usuario</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
