// Estado y llamadas a la API del módulo de usuarios. La página solo decide
// qué mostrar; aquí vive todo lo que habla con el backend.
import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

const mensajeError = (err, porDefecto) => err.response?.data?.error || porDefecto;

export default function useUsuarios() {
  const { showToast } = useToast();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tiposDocumento, setTiposDocumento] = useState([]);

  // /usuarios/roles/all solo devuelve los roles que el usuario autenticado
  // puede asignar, así el formulario nunca ofrece uno que el backend rechace.
  const cargar = useCallback(async () => {
    try {
      const [u, r, td] = await Promise.all([
        api.get('/usuarios'),
        api.get('/usuarios/roles/all'),
        api.get('/catalogos/tipos-documento'),
      ]);
      setUsuarios(u.data);
      setRoles(r.data);
      setTiposDocumento(td.data);
    } catch {
      showToast('Error al cargar usuarios', 'error');
    }
  }, [showToast]);

  useEffect(() => { cargar(); }, [cargar]);

  // Devuelve true si se guardó, para que la página sepa si cerrar el modal.
  const guardar = async (idUsuario, form) => {
    try {
      if (idUsuario) {
        await api.put(`/usuarios/${idUsuario}`, form);
        showToast('Usuario actualizado exitosamente');
      } else {
        await api.post('/usuarios', form);
        showToast('Usuario registrado exitosamente');
      }
      cargar();
      return true;
    } catch (err) {
      showToast(mensajeError(err, 'No se pudo guardar el usuario'), 'error');
      return false;
    }
  };

  const eliminar = async (idUsuario) => {
    try {
      await api.delete(`/usuarios/${idUsuario}`);
      showToast('Usuario eliminado');
      cargar();
    } catch (err) {
      showToast(mensajeError(err, 'No se pudo eliminar'), 'error');
    }
  };

  // Inactivar/activar (solo Super Administrador): pensado para cuando la
  // persona se retiró. No borra su historial de auditoría ni sus movimientos.
  const cambiarEstado = async (u) => {
    try {
      await api.patch(`/usuarios/${u.id_usuario}/estado`, { estado: !u.estado });
      showToast(`Usuario ${u.estado ? 'inactivado' : 'activado'} correctamente`);
      cargar();
    } catch (err) {
      showToast(mensajeError(err, 'No se pudo actualizar el estado'), 'error');
    }
  };

  return { usuarios, roles, tiposDocumento, guardar, eliminar, cambiarEstado };
}
