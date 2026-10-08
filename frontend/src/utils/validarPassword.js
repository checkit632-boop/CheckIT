// H-08: copia de la política de backend/utils/validarPassword.js, para avisar
// antes de enviar el formulario. La validación que realmente protege es la
// del servidor; si se cambia la regla, se cambia en ambos archivos.
const REGLA_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const MENSAJE_PASSWORD = 'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula y número.';

export function validarPassword(clave) {
  return typeof clave === 'string' && REGLA_PASSWORD.test(clave);
}
