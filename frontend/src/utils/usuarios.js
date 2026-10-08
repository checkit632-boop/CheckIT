// Funciones puras del módulo de usuarios (sin React ni llamadas a la API),
// para poder leerlas y probarlas por separado de la interfaz.
import { validarPassword, MENSAJE_PASSWORD } from './validarPassword';

export const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const FORMULARIO_VACIO = {
  usuario: '', nombre: '', apellidos: '', correo: '', celular: '',
  id_tipo_documento: '', numero_documento: '',
  password: '', id_rol: '',
};

// Formulario de un usuario nuevo, con el primer rol y tipo de documento
// disponibles ya seleccionados.
export function formularioNuevo(roles, tiposDocumento) {
  return {
    ...FORMULARIO_VACIO,
    id_rol: roles[0]?.id_rol || '',
    id_tipo_documento: tiposDocumento[0]?.id_tipo_documento || '',
  };
}

// Formulario precargado para editar. La contraseña siempre arranca vacía:
// vacía significa "no cambiarla" (el backend conserva el hash actual).
export function formularioDesdeUsuario(u, tiposDocumento) {
  return {
    usuario: u.usuario, nombre: u.nombre, apellidos: u.apellidos,
    correo: u.correo || '', celular: u.celular || '',
    id_tipo_documento: u.id_tipo_documento || tiposDocumento[0]?.id_tipo_documento || '',
    numero_documento: u.numero_documento || '',
    password: '', id_rol: u.id_rol,
  };
}

export function filtrarUsuarios(usuarios, busqueda) {
  if (!busqueda) return usuarios;
  const s = busqueda.toLowerCase();
  return usuarios.filter((u) =>
    [u.nombre, u.apellidos, u.usuario, u.correo, u.rol, u.numero_documento].join(' ').toLowerCase().includes(s)
  );
}

// Devuelve el mensaje del primer error del formulario, o null si es válido.
// Replica las reglas del backend solo como comodidad: el servidor vuelve a
// validar todo y es el que realmente protege.
export function validarFormularioUsuario(form, esEdicion) {
  if (!form.id_tipo_documento || !form.numero_documento) return 'El tipo y número de documento son obligatorios';
  if (!form.correo || !CORREO_REGEX.test(form.correo)) {
    return 'El correo es obligatorio y debe ser real: ahí llegará el PIN de inicio de sesión';
  }
  if (!esEdicion && !form.password) return 'La contraseña es obligatoria para usuarios nuevos';
  if (form.password && !validarPassword(form.password)) return MENSAJE_PASSWORD;
  return null;
}

export function claseInsigniaRol(rol) {
  if (rol === 'Super Administrador') return 'bg-brand-800 text-white';
  if (rol === 'Administrador') return 'bg-gray-800 text-white';
  return 'bg-blue-100 text-blue-800';
}
