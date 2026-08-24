import { useEffect, useState, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, QrCode } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import EquipmentQRModal from '../components/EquipmentQRModal';

const inputCls = 'mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700';

const estadoBadge = (nombre) => {
  if (nombre === 'Bueno') return 'bg-brand-100 text-brand-800';
  if (nombre === 'Regular') return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-700';
};

export default function Equipos() {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();

  const [equipos, setEquipos] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [estados, setEstados] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qrEquipo, setQrEquipo] = useState(null);

  const emptyForm = { id_persona: '', id_marca: '', modelo: '', serial: '', id_estado: '' };
  const [form, setForm] = useState(emptyForm);
  const [nuevaPersona, setNuevaPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState({ id_tipo_documento: 1, numero_documento: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [personaSearch, setPersonaSearch] = useState('');

  const loadAll = async () => {
    try {
      const [eq, per, mar, est] = await Promise.all([
        api.get('/equipos'), api.get('/personas'), api.get('/catalogos/marcas'), api.get('/catalogos/estados'),
      ]);
      setEquipos(eq.data);
      setPersonas(per.data);
      setMarcas(mar.data);
      setEstados(est.data);
    } catch (err) {
      showToast('Error al cargar los datos', 'error');
    }
  };

  useEffect(() => { loadAll(); }, []);

  const filtered = useMemo(() => {
    if (!search) return equipos;
    const s = search.toLowerCase();
    return equipos.filter((e) =>
      [e.serial, e.nombre_marca, e.modelo, e.persona_nombres, e.persona_apellidos].join(' ').toLowerCase().includes(s)
    );
  }, [equipos, search]);

  const filteredPersonas = useMemo(() => {
    if (!personaSearch) return personas.slice(0, 8);
    const s = personaSearch.toLowerCase();
    return personas.filter((p) => [p.nombres, p.apellidos, p.numero_documento].join(' ').toLowerCase().includes(s)).slice(0, 8);
  }, [personas, personaSearch]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setNuevaPersona(false);
    setPersonaForm({ id_tipo_documento: 1, numero_documento: '', nombres: '', apellidos: '', correo: '', celular: '' });
    setPersonaSearch('');
    setModalOpen(true);
  };

  const openEdit = (eq) => {
    setEditingId(eq.id_equipo);
    setForm({ id_persona: eq.id_persona, id_marca: eq.id_marca, modelo: eq.modelo || '', serial: eq.serial, id_estado: eq.id_estado });
    setNuevaPersona(false);
    setPersonaSearch(`${eq.persona_nombres} ${eq.persona_apellidos}`);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      let idPersona = form.id_persona;

      if (nuevaPersona) {
        if (!personaForm.numero_documento || !personaForm.nombres || !personaForm.apellidos) {
          showToast('Completa los datos de la persona', 'error'); return;
        }
        const { data } = await api.post('/personas', personaForm);
        idPersona = data.id_persona;
      }

      if (!idPersona || !form.id_marca || !form.serial || !form.id_estado) {
        showToast('Marca, serial, estado y responsable son obligatorios', 'error'); return;
      }

      if (editingId) {
        await api.put(`/equipos/${editingId}`, { ...form, id_persona: idPersona });
        showToast('Equipo actualizado');
      } else {
        await api.post('/equipos', { ...form, id_persona: idPersona });
        showToast('Equipo registrado — QR generado ✓');
      }
      setModalOpen(false);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo guardar el equipo', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este equipo?')) return;
    try {
      await api.delete(`/equipos/${id}`);
      showToast('Equipo eliminado');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Registro de Equipos</h1>
        <p className="text-sm text-gray-500 mt-1">Gestiona el inventario de computadores del sistema</p>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            placeholder="Buscar por serial o propietario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl">
          <Plus size={16} /> Nuevo Equipo
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-bold text-gray-900">Inventario de Computadores</div>
        <div className="overflow-y-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase sticky top-0">
              <tr>
                <th className="text-left px-5 py-2.5">Serial</th>
                <th className="text-left px-5 py-2.5">Marca / Modelo</th>
                <th className="text-left px-5 py-2.5">Responsable</th>
                <th className="text-left px-5 py-2.5">Estado</th>
                <th className="text-left px-5 py-2.5">QR</th>
                {isAdmin && <th className="text-left px-5 py-2.5">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-gray-400 py-10">No hay computadores registrados</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id_equipo} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono-num font-semibold">{e.serial}</td>
                  <td className="px-5 py-3"><strong>{e.nombre_marca}</strong> {e.modelo}</td>
                  <td className="px-5 py-3">{e.persona_nombres} {e.persona_apellidos}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${estadoBadge(e.nombre_estado)}`}>{e.nombre_estado}</span></td>
                  <td className="px-5 py-3">
                    <button onClick={() => setQrEquipo(e)} className="flex items-center gap-1 text-brand-700 bg-brand-100 hover:bg-brand-200 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      <QrCode size={13} /> Ver QR
                    </button>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(e.id_equipo)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Equipo' : 'Nuevo Equipo'}>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className={labelCls}>Responsable</label>
            {!nuevaPersona ? (
              <>
                <input
                  className={inputCls}
                  placeholder="Buscar por nombre o documento..."
                  value={personaSearch}
                  onChange={(e) => { setPersonaSearch(e.target.value); setForm((f) => ({ ...f, id_persona: '' })); }}
                />
                {personaSearch && !form.id_persona && (
                  <div className="mt-1 border border-gray-200 rounded-xl max-h-40 overflow-y-auto">
                    {filteredPersonas.map((p) => (
                      <div
                        key={p.id_persona}
                        className="px-3 py-2 text-sm hover:bg-brand-50 cursor-pointer"
                        onClick={() => { setForm((f) => ({ ...f, id_persona: p.id_persona })); setPersonaSearch(`${p.nombres} ${p.apellidos} — ${p.numero_documento}`); }}
                      >
                        {p.nombres} {p.apellidos} <span className="text-gray-400">— {p.numero_documento}</span>
                      </div>
                    ))}
                    {filteredPersonas.length === 0 && <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>}
                  </div>
                )}
                <button type="button" onClick={() => setNuevaPersona(true)} className="text-xs text-brand-700 font-semibold mt-1.5 hover:underline">
                  + Registrar nueva persona
                </button>
              </>
            ) : (
              <div className="border border-gray-200 rounded-xl p-3 mt-1 space-y-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls + ' mt-0'} placeholder="Nombres" value={personaForm.nombres} onChange={(e) => setPersonaForm((f) => ({ ...f, nombres: e.target.value }))} />
                  <input className={inputCls + ' mt-0'} placeholder="Apellidos" value={personaForm.apellidos} onChange={(e) => setPersonaForm((f) => ({ ...f, apellidos: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls + ' mt-0'} placeholder="N.° Documento" value={personaForm.numero_documento} onChange={(e) => setPersonaForm((f) => ({ ...f, numero_documento: e.target.value }))} />
                  <input className={inputCls + ' mt-0'} placeholder="Celular" value={personaForm.celular} onChange={(e) => setPersonaForm((f) => ({ ...f, celular: e.target.value }))} />
                </div>
                <input className={inputCls + ' mt-0'} placeholder="Correo" value={personaForm.correo} onChange={(e) => setPersonaForm((f) => ({ ...f, correo: e.target.value }))} />
                <button type="button" onClick={() => setNuevaPersona(false)} className="text-xs text-gray-500 hover:underline">Cancelar y buscar existente</button>
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Marca</label>
            <select className={inputCls} value={form.id_marca} onChange={(e) => setForm((f) => ({ ...f, id_marca: e.target.value }))}>
              <option value="">Seleccione una marca...</option>
              {marcas.map((m) => <option key={m.id_marca} value={m.id_marca}>{m.nombre_marca}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className={labelCls}>Modelo</label><input className={inputCls} placeholder="XPS 15" value={form.modelo} onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))} /></div>
            <div><label className={labelCls}>Serial</label><input className={inputCls} placeholder="SN-000000" value={form.serial} onChange={(e) => setForm((f) => ({ ...f, serial: e.target.value }))} /></div>
          </div>
          <div>
            <label className={labelCls}>Estado</label>
            <select className={inputCls} value={form.id_estado} onChange={(e) => setForm((f) => ({ ...f, id_estado: e.target.value }))}>
              <option value="">Seleccione...</option>
              {estados.map((e) => <option key={e.id_estado} value={e.id_estado}>{e.nombre_estado}</option>)}
            </select>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" className="flex-1 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl">Guardar Equipo</button>
          </div>
        </form>
      </Modal>

      <EquipmentQRModal equipo={qrEquipo} onClose={() => setQrEquipo(null)} />
    </div>
  );
}
