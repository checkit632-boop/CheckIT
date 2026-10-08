// H-08: política mínima de contraseñas, la misma para crear usuario, editar
// usuario y restablecer contraseña. Con el bloqueo de solo 5 intentos
// fallidos, una contraseña trivial (p. ej. "1") se adivinaría en segundos.
// El frontend replica esta regla (frontend/src/utils/validarPassword.js)
// solo como comodidad: la que realmente protege es esta, la del servidor.
const REGLA_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const MENSAJE_PASSWORD = 'La contraseña debe tener mínimo 8 caracteres, con mayúscula, minúscula y número.';

function validarPassword(clave) {
  return typeof clave === 'string' && REGLA_PASSWORD.test(clave);
}

module.exports = { validarPassword, MENSAJE_PASSWORD };
