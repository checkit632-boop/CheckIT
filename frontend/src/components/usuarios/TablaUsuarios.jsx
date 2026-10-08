import { Pencil, Trash2, Power, PowerOff } from 'lucide-react';
import { claseInsigniaRol } from '../../utils/usuarios';

const COLUMNAS = ['Usuario', 'Nombre', 'Documento', 'Correo', 'Rol', 'Estado', 'Acciones'];

function CeldaDocumento({ u }) {
  if (!u.numero_documento) {
    return <span className="text-gray-300 dark:text-gray-600 text-xs italic">Sin registrar</span>;
  }
  return (
    <>
      <div className="font-mono-num">{u.numero_documento}</div>
      <div className="text-[10px] text-gray-400 dark:text-gray-500">{u.tipo_documento}</div>
    </>
  );
}

// Nadie puede inactivar ni eliminar su propia cuenta (el backend también lo
// impide); por eso esos botones no se muestran en la fila del usuario actual.
function AccionesUsuario({ u, esPropio, isSuperAdmin, onEditar, onCambiarEstado, onEliminar }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => onEditar(u)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-300"><Pencil size={15} /></button>
      {isSuperAdmin && !esPropio && (
        <button
          onClick={() => onCambiarEstado(u)}
          title={u.estado ? 'Inactivar usuario' : 'Activar usuario'}
          className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${u.estado ? 'text-amber-600' : 'text-brand-600'}`}
        >
          {u.estado ? <PowerOff size={15} /> : <Power size={15} />}
        </button>
      )}
      {!esPropio && (
        <button onClick={() => onEliminar(u.id_usuario)} className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-red-500"><Trash2 size={15} /></button>
      )}
    </div>
  );
}

export default function TablaUsuarios({ usuarios, idUsuarioActual, isSuperAdmin, onEditar, onCambiarEstado, onEliminar }) {
  return (
    <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs uppercase">
          <tr>{COLUMNAS.map((c) => <th key={c} className="text-left px-5 py-2.5">{c}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-gray-800 dark:text-gray-200">
          {usuarios.map((u) => (
            <tr key={u.id_usuario} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
              <td className="px-5 py-3 font-mono-num font-semibold">@{u.usuario}</td>
              <td className="px-5 py-3">{u.nombre} {u.apellidos}</td>
              <td className="px-5 py-3 text-gray-600 dark:text-gray-400"><CeldaDocumento u={u} /></td>
              <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{u.correo}</td>
              <td className="px-5 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${claseInsigniaRol(u.rol)}`}>{u.rol}</span>
              </td>
              <td className="px-5 py-3">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${u.estado ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300' : 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300'}`}>{u.estado ? 'Activo' : 'Inactivo'}</span>
              </td>
              <td className="px-5 py-3">
                <AccionesUsuario
                  u={u}
                  esPropio={u.id_usuario === idUsuarioActual}
                  isSuperAdmin={isSuperAdmin}
                  onEditar={onEditar}
                  onCambiarEstado={onCambiarEstado}
                  onEliminar={onEliminar}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
