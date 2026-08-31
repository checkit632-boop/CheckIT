import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';

const inputCls = 'mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700';

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const emptyForm = { usuario: '', nombre: '', apellidos: '', correo: '', celular: '', password: '', id_rol: '', estado: true };
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [u, r] = await Promise.all([api.get('/usuarios'), api.get('/usuarios/roles/all')]);
      setUsuarios(u.data);
      setRoles(r.data);
    } catch (err) {
      showToast('Error al cargar usuarios', 'error');
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return usuarios;
    const s = search.toLowerCase();
    return usuarios.filter((u) => [u.nombre, u.apellidos, u.usuario, u.correo, u.rol].join(' ').toLowerCase().includes(s));
  }, [usuarios, search]);

  const openNew = () => {
    setEditingId(null);
    setForm({ ...emptyForm, id_rol: roles[0]?.id_rol || '' });
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditingId(u.id_usuario);
    setForm({ usuario: u.usuario, nombre: u.nombre, apellidos: u.apellidos, correo: u.correo || '', celular: u.celular || '', password: '', id_rol: u.id_rol, estado: !!u.estado });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">Administra los usuarios del sistema (Administradores y Operadores)</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500" placeholder="Buscar usuario..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-5 py-2.5">Usuario</th>
              <th className="text-left px-5 py-2.5">Nombre</th>
              <th className="text-left px-5 py-2.5">Correo</th>
              <th className="text-left px-5 py-2.5">Rol</th>
              <th className="text-left px-5 py-2.5">Estado</th>
              <th className="text-left px-5 py-2.5">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u) => (
              <tr key={u.id_usuario} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-mono-num font-semibold">@{u.usuario}</td>
                <td className="px-5 py-3">{u.nombre} {u.apellidos}</td>
                <td className="px-5 py-3 text-gray-600">{u.correo}</td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.rol === 'Administrador' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-800'}`}>{u.rol}</span>
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.estado ? 'bg-brand-100 text-brand-800' : 'bg-red-100 text-red-700'}`}>{u.estado ? 'Activo' : 'Inactivo'}</span>
                </td>
                <td className="px-5 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={15} /></button>
                    {u.id_usuario !== currentUser.id_usuario && (
                      <button onClick={() => handleDelete(u.id_usuario)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
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
            <div><label className={labelCls}>Nombre</label><input className={inputCls} value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
            <div><label className={labelCls}>Apellidos</label><input className={inputCls} value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Correo</label><input className={inputCls} value={form.correo} onChange={(e) => setForm((f) => ({ ...f, correo: e.target.value }))} /></div>
            <div><label className={labelCls}>Celular</label><input className={inputCls} value={form.celular} onChange={(e) => setForm((f) => ({ ...f, celular: e.target.value }))} /></div>
          </div>
          <div><label className={labelCls}>Usuario</label><input className={inputCls} value={form.usuario} onChange={(e) => setForm((f) => ({ ...f, usuario: e.target.value }))} /></div>
          <div>
            <label className={labelCls}>Contraseña {editingId && <span className="text-gray-400 font-normal">(dejar en blanco para no cambiar)</span>}</label>
            <input type="password" className={inputCls} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Rol</label>
              <select className={inputCls} value={form.id_rol} onChange={(e) => setForm((f) => ({ ...f, id_rol: Number(e.target.value) }))}>
                {roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Estado</label>
              <select className={inputCls} value={form.estado ? '1' : '0'} onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value === '1' }))}>
                <option value="1">Activo</option>
                <option value="0">Inactivo</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl">Guardar Usuario</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
