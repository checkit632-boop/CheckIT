// Autenticación y autorización de la API.
// - authRequired: exige un JWT válido (emitido por routes/auth.js, vigencia
//   de 8 horas) y que la cuenta siga activa; deja sus datos en req.user.
// - requireRole: restringe una ruta a ciertos roles.
// En cada petición se consulta la cuenta en la base (por llave primaria,
// microsegundos): si a alguien lo inactivan o lo eliminan, pierde el acceso
// en su siguiente petición, y si le cambian el rol, se aplica de inmediato.
// Antes se confiaba en el rol guardado dentro del token hasta que venciera.
const jwt = require('jsonwebtoken');
const db = require('../db/database');

// H-01 / NC-6: no existe un secreto de respaldo escrito en el código. Si falta
// JWT_SECRET en el .env, el servidor debe fallar de forma ruidosa al arrancar
// (en vez de firmar tokens silenciosamente con un valor conocido y adivinable
// por cualquiera que lea el repositorio).
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('Falta JWT_SECRET en el archivo .env (revisa backend/.env.example y el README).');
}

const ROL_SUPER = 'Super Administrador';
const ROL_ADMIN = 'Administrador';
const ROL_OPERADOR = 'Operador de Sistema';

const consultarCuenta = db.prepare(`
  SELECT u.id_usuario, u.usuario, u.nombre, u.apellidos, u.estado, r.nombre_rol
  FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
  WHERE u.id_usuario = ?
`);

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });

  let payload;
  try {
    // verify comprueba firma y vencimiento: un token alterado o vencido no pasa.
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Fuera del try: un fallo de la base no debe disfrazarse de "token
  // inválido"; llega al manejador central de errores.
  const cuenta = consultarCuenta.get(payload.id_usuario);
  if (!cuenta || !cuenta.estado) {
    return res.status(401).json({ error: 'Tu cuenta fue desactivada o ya no existe. Contacta al administrador.' });
  }
  // Datos actuales de la base, no los que se firmaron al iniciar sesión.
  req.user = {
    id_usuario: cuenta.id_usuario,
    usuario: cuenta.usuario,
    nombre: cuenta.nombre,
    apellidos: cuenta.apellidos,
    rol: cuenta.nombre_rol,
  };
  next();
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
