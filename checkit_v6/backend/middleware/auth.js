const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'checkit_dev_secret_change_me';

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
