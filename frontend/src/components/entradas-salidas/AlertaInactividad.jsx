// v7.0 (pedido de portería): equipos y usuarios con más de un año sin uso.
//
// El sistema los detecta, pero solo un Administrador o el Super
// Administrador puede autorizar que se eliminen. Al iniciar sesión se abre
// esta ventana (una vez por sesión) y queda un aviso para volver a abrirla.
// Antes de eliminar, el servidor genera un respaldo; los usuarios con
// historial se anonimizan en vez de borrarse. Todo queda en la auditoría.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import api from '../../api/client';
import Modal from '../Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { fmtHora } from '../../utils/fechas';

function claveSesion() {
  try {
    return `checkit_alerta_inactividad|${(localStorage.getItem('checkit_token') || '').slice(-24)}`;
  } catch {
    return null;
  }
}
const yaVista = () => {
  try {
    const c = claveSesion();
    return c ? sessionStorage.getItem(c) === '1' : false;
  } catch {
    return false;
  }
};
const marcarVista = () => {
  try {
    const c = claveSesion();
    if (c) sessionStorage.setItem(c, '1');
  } catch {
    /* se mostrará de nuevo */
  }
};

const thCls = 'text-left px-3 py-2.5';
const fecha = (f) => fmtHora(f).split(',')[0];

export default function AlertaInactividad({ onAbiertaCambio }) {
  const { isAdmin } = useAuth();
  const { showToast } = useToast();
  const [datos, setDatos] = useState({ dias: 365, equipos: [], usuarios: [] });
  const [abierta, setAbierta] = useState(false);
  const [selEquipos, setSelEquipos] = useState(new Set());
  const [selUsuarios, setSelUsuarios] = useState(new Set());
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(
    (abrir) => {
      if (!isAdmin) return;
      api
        .get('/inactividad')
        .then(({ data }) => {
          setDatos(data);
          setSelEquipos(new Set(data.equipos.map((e) => e.id_equipo)));
          setSelUsuarios(new Set(data.usuarios.map((u) => u.id_usuario)));
          if (abrir && data.equipos.length + data.usuarios.length > 0 && !yaVista())
            setAbierta(true);
        })
        .catch(() => {});
    },
    [isAdmin]
  );

  useEffect(() => {
    cargar(true);
  }, [cargar]);
  // Mientras la ventana está abierta, la pistola lectora no registra movimientos.
  useEffect(() => {
    onAbiertaCambio?.(abierta);
  }, [abierta, onAbiertaCambio]);

  const total = datos.equipos.length + datos.usuarios.length;
  const elegidos = selEquipos.size + selUsuarios.size;
  const anonimizar = useMemo(
    () =>
      datos.usuarios.filter((u) => selUsuarios.has(u.id_usuario) && u.accion === 'anonimizar')
        .length,
    [datos.usuarios, selUsuarios]
  );

  if (!isAdmin || total === 0) return null;

  const cerrar = () => {
    marcarVista();
    setConfirmando(false);
    setAbierta(false);
  };
  const alternar = (set, setter, id) => {
    const n = new Set(set);
    n.has(id) ? n.delete(id) : n.add(id);
    setter(n);
  };

  const eliminar = async () => {
    setEnviando(true);
    try {
      const { data } = await api.post('/inactividad/eliminar', {
        equipos: [...selEquipos],
        usuarios: [...selUsuarios],
      });
      const partes = [];
      if (data.equipos) partes.push(`${data.equipos} equipo(s)`);
      if (data.usuarios_eliminados)
        partes.push(`${data.usuarios_eliminados} usuario(s) eliminado(s)`);
      if (data.usuarios_anonimizados)
        partes.push(`${data.usuarios_anonimizados} usuario(s) anonimizado(s)`);
      showToast(
        `Listo: ${partes.join(', ')}.${data.respaldo ? ' Se guardó un respaldo antes.' : ''}`
      );
      setConfirmando(false);
      marcarVista();
      setAbierta(false);
      cargar(false);
    } catch (err) {
      showToast(err.response?.data?.error || 'No se pudo eliminar', 'error');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="shrink-0 mb-3 flex items-center gap-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-2 text-sm text-red-900 dark:text-red-200">
        <Trash2 size={16} className="shrink-0" />
        <span className="flex-1">
          <strong>
            {datos.equipos.length} equipo(s) y {datos.usuarios.length} usuario(s)
          </strong>{' '}
          llevan más de un año sin uso y esperan tu autorización para eliminarse.
        </span>
        <button
          type="button"
          onClick={() => setAbierta(true)}
          className="shrink-0 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold px-3 py-1.5"
        >
          Revisar
        </button>
      </div>

      <Modal
        open={abierta}
        onClose={cerrar}
        title="Datos con más de un año sin uso"
        maxWidth="max-w-5xl"
      >
        <div className="flex gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
          <AlertTriangle size={20} className="shrink-0 text-amber-700 dark:text-amber-300" />
          <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed">
            Estos equipos no registran entradas ni salidas, y estos usuarios no inician sesión,
            desde hace más de <strong>{datos.dias} días</strong>. ¿Deseas eliminarlos junto con sus
            datos? Desmarca los que quieras conservar. Antes de eliminar, el sistema guarda un
            respaldo de la base.
          </p>
        </div>

        {datos.equipos.length > 0 && (
          <>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              Equipos ({datos.equipos.length})
            </h4>
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-auto max-h-[28vh] mb-4">
              <table className="w-full min-w-[760px] text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-[11px] uppercase sticky top-0">
                  <tr>
                    <th className={thCls}></th>
                    <th className={thCls}>Equipo</th>
                    <th className={thCls}>Propietario</th>
                    <th className={thCls}>Último uso</th>
                    <th className={thCls}>Al eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                  {datos.equipos.map((e) => (
                    <tr key={e.id_equipo}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Eliminar equipo ${e.serial}`}
                          checked={selEquipos.has(e.id_equipo)}
                          onChange={() => alternar(selEquipos, setSelEquipos, e.id_equipo)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-mono-num font-bold text-brand-700 dark:text-brand-300">
                          {e.serial}
                        </span>{' '}
                        · {e.nombre_marca} {e.modelo}
                      </td>
                      <td className="px-3 py-2">{e.propietario}</td>
                      <td className="px-3 py-2">
                        {e.nunca_usado
                          ? `Sin movimientos (registrado el ${fecha(e.ultimo_uso)})`
                          : fecha(e.ultimo_uso)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        Equipo y {e.movimientos} movimiento(s)
                        {e.se_borra_propietario && (
                          <span className="ml-1 rounded-full bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 px-2 py-0.5 font-semibold">
                            y los datos del propietario
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {datos.usuarios.length > 0 && (
          <>
            <h4 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2">
              Usuarios ({datos.usuarios.length})
            </h4>
            <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-auto max-h-[24vh] mb-4">
              <table className="w-full min-w-[760px] text-sm whitespace-nowrap">
                <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-300 text-[11px] uppercase sticky top-0">
                  <tr>
                    <th className={thCls}></th>
                    <th className={thCls}>Usuario</th>
                    <th className={thCls}>Rol</th>
                    <th className={thCls}>Último acceso</th>
                    <th className={thCls}>Al eliminar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
                  {datos.usuarios.map((u) => (
                    <tr key={u.id_usuario}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Eliminar usuario ${u.usuario}`}
                          checked={selUsuarios.has(u.id_usuario)}
                          onChange={() => alternar(selUsuarios, setSelUsuarios, u.id_usuario)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <strong>{u.usuario}</strong> · {u.nombre}
                      </td>
                      <td className="px-3 py-2">{u.rol}</td>
                      <td className="px-3 py-2">
                        {u.nunca_entro
                          ? `Nunca entró (creado el ${fecha(u.ultimo_acceso)})`
                          : fecha(u.ultimo_acceso)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {u.accion === 'eliminar' ? (
                          'Se elimina la cuenta'
                        ) : (
                          <span title="Tiene movimientos o auditoría: se borran sus datos personales y queda como 'eliminado' en el historial">
                            Se borran sus datos personales (tiene historial)
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {confirmando ? (
          <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4">
            <p className="text-sm text-red-900 dark:text-red-100 mb-3">
              Vas a eliminar <strong>{selEquipos.size} equipo(s)</strong> con todos sus movimientos
              y <strong>{selUsuarios.size} usuario(s)</strong>
              {anonimizar > 0
                ? ` (${anonimizar} con historial: se borran sus datos personales y quedan como “eliminado”)`
                : ''}
              .<strong> Esta acción no se puede deshacer</strong> desde CheckIT; solo restaurando el
              respaldo.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmando(false)}
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
                {enviando ? 'Eliminando…' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cerrar}
              className="rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-semibold px-4 py-2.5"
            >
              Ahora no
            </button>
            <button
              type="button"
              disabled={elegidos === 0}
              onClick={() => setConfirmando(true)}
              className="rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5"
            >
              Eliminar seleccionados ({elegidos})
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
