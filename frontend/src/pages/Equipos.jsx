import { useEffect, useState, useCallback } from 'react';
import { Search, Plus, Pencil, Trash2, QrCode, Power, PowerOff } from 'lucide-react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import EquipmentQRModal from '../components/EquipmentQRModal';
import useDebounce from '../hooks/useDebounce';
import AvisoPrivacidad from '../components/AvisoPrivacidad';
import { useConfirmacion } from '../context/ConfirmContext';

// Equipos por página del inventario (la paginación y la búsqueda las hace el
// servidor: la pantalla ya no descarga todo el inventario ni todas las
// personas).
const POR_PAGINA = 25;

const inputCls = 'mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300';

const estadoBadge = (nombre) => {
  if (nombre === 'Bueno') return 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300';
  if (nombre === 'Regular') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
  return 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300';
};

export default function Equipos() {
  const { isAdmin, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const confirmar = useConfirmacion();

  const [equipos, setEquipos] = useState([]);
  const [totalEquipos, setTotalEquipos] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [personasEncontradas, setPersonasEncontradas] = useState([]);
  const [marcas, setMarcas] = useState([]);
  const [estados, setEstados] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [qrEquipo, setQrEquipo] = useState(null);

  const emptyForm = { id_persona: '', id_marca: '', modelo: '', serial: '', id_estado: '', observaciones: '' };
  const [form, setForm] = useState(emptyForm);
  const [nuevaPersona, setNuevaPersona] = useState(false);
  const [personaForm, setPersonaForm] = useState({ id_tipo_documento: 1, numero_documento: '', nombres: '', apellidos: '', correo: '', celular: '' });
  const [personaSearch, setPersonaSearch] = useState('');

  const busqueda = useDebounce(search.trim(), 300);
  const busquedaPersona = useDebounce(personaSearch.trim(), 300);

  // Catálogos del formulario: se cargan una sola vez.
  useEffect(() => {
    Promise.all([api.get('/catalogos/marcas'), api.get('/catalogos/estados')])
      .then(([mar, est]) => { setMarcas(mar.data); setEstados(est.data); })
      .catch(() => showToast('Error al cargar los datos', 'error'));
  }, [showToast]);

  // Una página del inventario, filtrada en el servidor.
  const loadAll = useCallback(async () => {
    try {
      const { data } = await api.get('/equipos', {
        params: { pagina, por_pagina: POR_PAGINA, q: busqueda || undefined },
      });
      // Si se eliminó el último equipo de la última página, retrocede una.
      if (data.datos.length === 0 && pagina > 1) { setPagina(pagina - 1); return; }
      setEquipos(data.datos);
      setTotalEquipos(data.total);
    } catch (err) {
      showToast('Error al cargar los datos', 'error');
    }
  }, [pagina, busqueda, showToast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Buscador de propietario del formulario: hasta 8 coincidencias.
  useEffect(() => {
    if (!busquedaPersona) { setPersonasEncontradas([]); return; }
    api.get('/personas', { params: { q: busquedaPersona, limit: 8 } })
      .then((res) => setPersonasEncontradas(res.data))
      .catch(() => setPersonasEncontradas([]));
  }, [busquedaPersona]);

  const filtered = equipos;
  const filteredPersonas = personasEncontradas;
  const totalPaginas = Math.max(1, Math.ceil(totalEquipos / POR_PAGINA));

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
    setForm({ id_persona: eq.id_persona, id_marca: eq.id_marca, modelo: eq.modelo || '', serial: eq.serial, id_estado: eq.id_estado, observaciones: eq.observaciones || '' });
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
        showToast('Marca, serial, condición y responsable son obligatorios', 'error'); return;
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

  const handleDelete = async (eq) => {
    const ok = await confirmar({
      titulo: 'Eliminar equipo',
      mensaje: `¿Eliminar el equipo ${eq.serial}? Esta acción no se puede deshacer. Si el equipo ya tiene movimientos, el sistema no lo eliminará: en ese caso, inactívalo.`,
      textoConfirmar: 'Eliminar',
      peligro: true,
    });
    if (!ok) return;
    const id = eq.id_equipo;
    try {
      await api.delete(`/equipos/${id}`);
      showToast('Equipo eliminado');
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    }
  };

  // Inactivar/activar (solo Super Administrador) — para equipos dados de
  // baja o retirados. No borra el historial de movimientos del equipo.
  const handleToggleActivo = async (eq) => {
    const ok = await confirmar({
      titulo: eq.activo ? 'Inactivar equipo' : 'Activar equipo',
      mensaje: eq.activo
        ? `El equipo ${eq.serial} no podrá registrar entradas ni salidas. Su historial se conserva y puedes activarlo de nuevo cuando quieras.`
        : `El equipo ${eq.serial} podrá volver a registrar entradas y salidas.`,
      textoConfirmar: eq.activo ? 'Inactivar' : 'Activar',
      peligro: Boolean(eq.activo),
    });
    if (!ok) return;
    try {
      await api.patch(`/equipos/${eq.id_equipo}/estado`, { activo: !eq.activo });
      showToast(`Equipo ${eq.activo ? 'inactivado' : 'activado'} correctamente`);
      loadAll();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo actualizar el estado', 'error');
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Registro de Equipos</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestiona el inventario de computadores del sistema</p>
        </div>
        <div className="bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 text-brand-800 dark:text-brand-200 rounded-xl px-4 py-2 text-sm font-bold">
          Total registrados: {equipos.length}
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative max-w-xs w-full">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            placeholder="Buscar por serial o propietario..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagina(1); }}
          />
        </div>
        <button onClick={openNew} className="ml-auto flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={16} /> Nuevo Equipo
        </button>
      </div>

      <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 font-bold text-gray-900 dark:text-gray-100">Inventario de Computadores</div>
        <div className="overflow-y-auto max-h-[520px]">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase sticky top-0">
              <tr>
                <th className="text-left px-5 py-2.5">Serial</th>
                <th className="text-left px-5 py-2.5">Marca / Modelo</th>
                <th className="text-left px-5 py-2.5">Responsable</th>
                <th className="text-left px-5 py-2.5">Condición</th>
                <th className="text-left px-5 py-2.5">Estado</th>
                <th className="text-left px-5 py-2.5">QR</th>
                {isAdmin && <th className="text-left px-5 py-2.5">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="text-center text-gray-500 dark:text-gray-400 py-10">No hay computadores registrados</td></tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id_equipo} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${!e.activo ? 'opacity-60' : ''}`}>
                  <td className="px-5 py-3 font-mono-num font-semibold">{e.serial}</td>
                  <td className="px-5 py-3"><strong>{e.nombre_marca}</strong> {e.modelo}</td>
                  <td className="px-5 py-3">{e.persona_nombres} {e.persona_apellidos}</td>
                  <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${estadoBadge(e.nombre_estado)}`}>{e.nombre_estado}</span></td>
                  <td className="px-5 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${e.activo ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}>
                      {e.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setQrEquipo(e)} className="flex items-center gap-1 text-brand-700 dark:text-brand-300 bg-brand-100 dark:bg-brand-900/40 hover:bg-brand-200 dark:hover:bg-brand-900/60 px-2.5 py-1 rounded-lg text-xs font-semibold">
                      <QrCode size={13} /> Ver QR
                    </button>
                  </td>
                  {isAdmin && (
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(e)} title="Editar equipo" aria-label={`Editar equipo ${e.serial}`} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"><Pencil size={15} /></button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleToggleActivo(e)}
                            title={e.activo ? 'Inactivar equipo' : 'Activar equipo'}
                            aria-label={`${e.activo ? 'Inactivar' : 'Activar'} equipo ${e.serial}`}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 ${e.activo ? 'text-amber-600' : 'text-brand-600'}`}
                          >
                            {e.activo ? <PowerOff size={15} /> : <Power size={15} />}
                          </button>
                        )}
                        <button onClick={() => handleDelete(e)} title="Eliminar equipo" aria-label={`Eliminar equipo ${e.serial}`} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <span>
            {totalEquipos === 0
              ? 'Sin resultados'
              : `${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, totalEquipos)} de ${totalEquipos} equipos`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPagina((n) => Math.max(1, n - 1))}
              disabled={pagina <= 1}
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Anterior
            </button>
            <span>Página {pagina} de {totalPaginas}</span>
            <button
              onClick={() => setPagina((n) => Math.min(totalPaginas, n + 1))}
              disabled={pagina >= totalPaginas}
              className="px-3 py-1 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-40 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Siguiente
            </button>
          </div>
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
                  <div className="mt-1 border border-gray-200 dark:border-gray-600 rounded-xl max-h-40 overflow-y-auto">
                    {filteredPersonas.map((p) => (
                      <div
                        key={p.id_persona}
                        className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-brand-50 dark:hover:bg-brand-900/30 cursor-pointer"
                        onClick={() => { setForm((f) => ({ ...f, id_persona: p.id_persona })); setPersonaSearch(`${p.nombres} ${p.apellidos} — ${p.numero_documento}`); }}
                      >
                        {p.nombres} {p.apellidos} <span className="text-gray-500 dark:text-gray-400">— {p.numero_documento}</span>
                      </div>
                    ))}
                    {filteredPersonas.length === 0 && <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">Sin resultados</div>}
                  </div>
                )}
                <button type="button" onClick={() => setNuevaPersona(true)} className="text-xs text-brand-700 font-semibold mt-1.5 hover:underline">
                  + Registrar nueva persona
                </button>
              </>
            ) : (
              <div className="border border-gray-200 dark:border-gray-600 rounded-xl p-3 mt-1 space-y-3 bg-gray-50 dark:bg-gray-900">
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls + ' mt-0'} placeholder="Nombres" value={personaForm.nombres} onChange={(e) => setPersonaForm((f) => ({ ...f, nombres: e.target.value }))} />
                  <input className={inputCls + ' mt-0'} placeholder="Apellidos" value={personaForm.apellidos} onChange={(e) => setPersonaForm((f) => ({ ...f, apellidos: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input className={inputCls + ' mt-0'} placeholder="N.° Documento" value={personaForm.numero_documento} onChange={(e) => setPersonaForm((f) => ({ ...f, numero_documento: e.target.value }))} />
                  <input className={inputCls + ' mt-0'} placeholder="Celular (opcional)" value={personaForm.celular} onChange={(e) => setPersonaForm((f) => ({ ...f, celular: e.target.value }))} />
                </div>
                <input className={inputCls + ' mt-0'} placeholder="Correo (opcional)" value={personaForm.correo} onChange={(e) => setPersonaForm((f) => ({ ...f, correo: e.target.value }))} />
                <AvisoPrivacidad />
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
            <label className={labelCls}>Condición</label>
            <select className={inputCls} value={form.id_estado} onChange={(e) => setForm((f) => ({ ...f, id_estado: e.target.value }))}>
              <option value="">Seleccione...</option>
              {estados.map((e) => <option key={e.id_estado} value={e.id_estado}>{e.nombre_estado}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Observaciones</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={3}
              placeholder="Se mostrará en cada entrada/salida del equipo, sin tener que volver a escribirla"
              value={form.observaciones}
              onChange={(e) => setForm((f) => ({ ...f, observaciones: e.target.value }))}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl">Cancelar</button>
            <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">Guardar Equipo</button>
          </div>
        </form>
      </Modal>

      <EquipmentQRModal equipo={qrEquipo} onClose={() => setQrEquipo(null)} />
    </div>
  );
}
