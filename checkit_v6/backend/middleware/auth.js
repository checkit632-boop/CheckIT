const jwt = require('jsonwebtoken');

// NC-6: ya no existe un secreto de respaldo escrito en el código. Si falta
// JWT_SECRET en el .env, el servidor debe fallar de forma ruidosa al
// arrancar (en vez de firmar tokens silenciosamente con un valor conocido
// y adivinable por cualquiera que lea el repositorio).
if (!process.env.JWT_SECRET) {
  throw new Error(
    'Falta JWT_SECRET en backend/.env. Genera uno propio (una cadena larga y aleatoria) ' +
    'antes de arrancar el servidor — revisa backend/.env.example.'
  );
}
const JWT_SECRET = process.env.JWT_SECRET;

const ROL_SUPER = 'Super Administrador';
const ROL_ADMIN = 'Administrador';
const ROL_OPERADOR = 'Operador de Sistema';

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id_usuario, usuario, nombre, apellidos, rol }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

// Permite el paso solo si el rol del usuario está en la lista permitida.
// El Super Administrador tiene permiso total sobre todos los módulos,
// así que siempre pasa esta verificación sin importar la lista recibida.
function requireRole(...rolesPermitidos) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (req.user.rol === ROL_SUPER) return next();
    if (!rolesPermitidos.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

module.exports = { authRequired, requireRole, JWT_SECRET, ROL_SUPER, ROL_ADMIN, ROL_OPERADOR };
