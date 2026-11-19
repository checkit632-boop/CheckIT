// Editar o eliminar una persona encontrada con el buscador de Registro de
// Equipos (v7.0). Sirve, por ejemplo, para una persona que quedó registrada
// sin su equipo: se corrigen sus datos o se elimina para registrarla de nuevo.
// Solo para Administrador y Super Administrador (igual que en el servidor).
// Una persona con equipos no se puede eliminar.
import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../../api/client';
import Modal from '../Modal';
import { useToast } from '../../context/ToastContext';
import { formatoNombre } from '../../utils/nombres';

const inputCls =
  'w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300';

export default function PersonaModal({ idPersona, tiposDocumento, onClose, onCambio }) {
  const { showToast } = useToast();
  const [datos, setDatos] = useState(null);
  const [equipos, setEquipos] = useState(0);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setConfirmarBorrado(false);
    if (!idPersona) {
      setDatos(null);
      return;
    }
    api
      .get(`/personas/${idPersona}`)
      .then(({ data }) => {
        setDatos({
          id_tipo_documento: data.id_tipo_documento,
          numero_documento: data.numero_documento || '',
          nombres: data.nombres || '',
          apellidos: data.apellidos || '',
          correo: data.correo || '',
          celular: data.celular || '',
        });
        // Cantidad de equipos: con alguno, no se puede eliminar.
        setEquipos(data.equipos || 0);
      })
      .catch(() => {
        showToast('No se pudieron cargar los datos de la persona', 'error');
        onClose();
      });
  }, [idPersona, showToast, onClose]);

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));
  const formatear = (campo) => () => setDatos((d) => ({ ...d, [campo]: formatoNombre(d[campo]) }));

  const guardar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await api.put(`/personas/${idPersona}`, datos);
      showToast('Datos de la persona actualizados');
      onCambio();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo guardar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async () => {
    setEnviando(true);
    try {
      await api.delete(`/personas/${idPersona}`);
      showToast('Persona eliminada');
      onCambio();
      onClose();
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      open={Boolean(idPersona && datos)}
      onClose={onClose}
      title="Datos de la persona"
      maxWidth="max-w-lg"
    >
      {datos && (
        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nombres</label>
              <input
                className={inputCls}
                value={datos.nombres}
                onChange={cambiar('nombres')}
                onBlur={formatear('nombres')}
              />
            </div>
            <div>
              <label className={labelCls}>Apellidos</label>
              <input
                className={inputCls}
                value={datos.apellidos}
                onChange={cambiar('apellidos')}
                onBlur={formatear('apellidos')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tipo de documento</label>
              <select
                className={inputCls}
                value={datos.id_tipo_documento}
                onChange={cambiar('id_tipo_documento')}
              >
                {tiposDocumento.map((t) => (
                  <option key={t.id_tipo_documento} value={t.id_tipo_documento}>
                    {t.nombre_documento}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>N.° Documento</label>
              <input
                className={inputCls}
                value={datos.numero_documento}
                onChange={cambiar('numero_documento')}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Correo (opcional)</label>
              <input className={inputCls} value={datos.correo} onChange={cambiar('correo')} />
            </div>
            <div>
              <label className={labelCls}>Celular (opcional)</label>
              <input className={inputCls} value={datos.celular} onChange={cambiar('celular')} />
            </div>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {equipos > 0
              ? `Tiene ${equipos} equipo(s) registrado(s).`
              : 'No tiene equipos registrados.'}
          </p>

          {confirmarBorrado ? (
            <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-3">
              <p className="text-sm text-red-900 dark:text-red-100 mb-3">
                ¿Eliminar a {datos.nombres} {datos.apellidos} y sus datos? Esta acción no se puede
                deshacer.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmarBorrado(false)}
                  disabled={enviando}
                  className="rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-semibold px-4 py-2"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={eliminar}
                  disabled={enviando}
                  className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2"
                >
                  Sí, eliminar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                disabled={equipos > 0 || enviando}
                onClick={() => setConfirmarBorrado(true)}
                title={
                  equipos > 0
                    ? 'Solo se puede eliminar una persona sin equipos'
                    : 'Eliminar esta persona'
                }
                className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 text-sm font-semibold px-4 py-2.5"
              >
                <Trash2 size={15} /> Eliminar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl"
              >
                Guardar
              </button>
            </div>
          )}
        </form>
      )}
    </Modal>
  );
}
