// Jerarquía de roles: qué roles puede gestionar (crear, editar, eliminar o
// anonimizar) cada uno. La usan el módulo de usuarios y la limpieza por
// inactividad (v7.0).
// - Super Administrador -> Administradores y Operadores de Sistema.
// - Administrador -> solo Operadores de Sistema.
const { ROL_SUPER, ROL_ADMIN, ROL_OPERADOR } = require('../middleware/auth');

function rolesGestionables(rolActual) {
  if (rolActual === ROL_SUPER) return [ROL_ADMIN, ROL_OPERADOR];
  if (rolActual === ROL_ADMIN) return [ROL_OPERADOR];
  return [];
}

module.exports = { rolesGestionables };
