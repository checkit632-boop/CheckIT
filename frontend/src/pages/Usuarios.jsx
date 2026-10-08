import { useMemo, useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import useUsuarios from '../hooks/useUsuarios';
import FiltroUsuarios from '../components/usuarios/FiltroUsuarios';
import TablaUsuarios from '../components/usuarios/TablaUsuarios';
import FormularioUsuario from '../components/usuarios/FormularioUsuario';
import {
  FORMULARIO_VACIO, formularioNuevo, formularioDesdeUsuario, filtrarUsuarios, validarFormularioUsuario,
} from '../utils/usuarios';

// Página de Gestión de Usuarios. Solo coordina: los datos y las llamadas a
// la API están en useUsuarios, las reglas puras en utils/usuarios y la
// interfaz en components/usuarios/. Qué roles puede crear o editar cada
// quien lo decide el backend (el formulario solo recibe los permitidos).
export default function Usuarios() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const { usuarios, roles, tiposDocumento, guardar, eliminar, cambiarEstado } = useUsuarios();

  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [idEditando, setIdEditando] = useState(null);
  const [form, setForm] = useState(FORMULARIO_VACIO);

  const filtrados = useMemo(() => filtrarUsuarios(usuarios, busqueda), [usuarios, busqueda]);

  const abrirNuevo = () => {
    setIdEditando(null);
    setForm(formularioNuevo(roles, tiposDocumento));
    setModalAbierto(true);
  };

  const abrirEdicion = (u) => {
    setIdEditando(u.id_usuario);
    setForm(formularioDesdeUsuario(u, tiposDocumento));
    setModalAbierto(true);
  };

  const handleGuardar = async (e) => {
    e.preventDefault();
    const error = validarFormularioUsuario(form, Boolean(idEditando));
    if (error) {
      showToast(error, 'error');
      return;
    }
    if (await guardar(idEditando, form)) setModalAbierto(false);
  };

  const handleEliminar = (id) => {
    if (confirm('¿Eliminar este usuario?')) eliminar(id);
  };

  const handleCambiarEstado = (u) => {
    const accion = u.estado ? 'inactivar' : 'activar';
    if (confirm(`¿Seguro que quieres ${accion} a ${u.nombre} ${u.apellidos}?`)) cambiarEstado(u);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">Gestión de Usuarios</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Administra los usuarios del sistema (según tu rol: Administradores y/o Operadores)</p>
      </div>

      <FiltroUsuarios busqueda={busqueda} onBuscar={setBusqueda} onNuevo={abrirNuevo} puedeCrear={roles.length > 0} />

      <TablaUsuarios
        usuarios={filtrados}
        idUsuarioActual={currentUser.id_usuario}
        isSuperAdmin={isSuperAdmin}
        onEditar={abrirEdicion}
        onCambiarEstado={handleCambiarEstado}
        onEliminar={handleEliminar}
      />

      <FormularioUsuario
        abierto={modalAbierto}
        esEdicion={Boolean(idEditando)}
        form={form}
        setForm={setForm}
        roles={roles}
        tiposDocumento={tiposDocumento}
        onCerrar={() => setModalAbierto(false)}
        onGuardar={handleGuardar}
      />
    </div>
  );
}
