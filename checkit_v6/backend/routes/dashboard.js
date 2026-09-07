const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();

// El Dashboard es exclusivo del Super Administrador: es la vista de
// auditoría (quién hizo qué y cuándo), distinta de los contadores en vivo
// de Control de Acceso que ya ven todos los roles.
router.use(authRequired, requireRole(ROL_SUPER));

// Traduce ?periodo=dia|semana|mes a una condición SQL sobre fecha_hora/fecha.
// "dia" = hoy calendario, "semana" = semana calendaria actual, "mes" = mes
// calendario actual. Todo en hora local del servidor.
function condicionPeriodo(columna, periodo) {
  switch (periodo) {
    case 'semana':
      return `strftime('%Y-%W', ${columna}, 'localtime') = strftime('%Y-%W','now','localtime')`;
    case 'mes':
      return `strftime('%Y-%m', ${columna}, 'localtime') = strftime('%Y-%m','now','localtime')`;
    case 'dia':
    default:
      return `date(${columna}, 'localtime') = date('now','localtime')`;
  }
}

// GET /api/dashboard/resumen?periodo=dia|semana|mes
router.get('/resumen', (req, res) => {
  const periodo = req.query.periodo || 'dia';
  const condMov = condicionPeriodo('r.fecha_hora', periodo);
  const condLogin = condicionPeriodo('a.fecha', periodo);

  const movimientos = db.prepare(`
    SELECT tm.nombre_movimiento, u.usuario, COUNT(*) AS total
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    JOIN usuarios u ON u.id_usuario = r.id_usuario
    WHERE ${condMov}
    GROUP BY tm.nombre_movimiento, u.usuario
  `).all();

  let entradas = 0, salidas = 0, automaticos = 0;
  movimientos.forEach((m) => {
    if (m.nombre_movimiento === 'Entrada') entradas += m.total;
    if (m.nombre_movimiento === 'Salida') salidas += m.total;
    if (m.usuario === 'sistema') automaticos += m.total;
  });

  const totalLogins = db.prepare(`
    SELECT COUNT(*) AS total FROM auditoria a
    WHERE a.accion = 'LOGIN' AND ${condLogin}
  `).get().total;

  const usuariosActivos = db.prepare(`
    SELECT u.usuario, u.nombre, u.apellidos, COUNT(*) AS total
    FROM registros r
    JOIN usuarios u ON u.id_usuario = r.id_usuario
    WHERE ${condMov} AND u.usuario <> 'sistema'
    GROUP BY u.id_usuario
    ORDER BY total DESC
    LIMIT 5
  `).all();

  res.json({
    periodo,
    totalMovimientos: entradas + salidas,
    entradas,
    salidas,
    automaticos,
    totalLogins,
    usuariosActivos,
  });
});

// GET /api/dashboard/movimientos?periodo=dia|semana|mes
router.get('/movimientos', (req, res) => {
  const periodo = req.query.periodo || 'dia';
  const cond = condicionPeriodo('r.fecha_hora', periodo);

  const rows = db.prepare(`
    SELECT r.id_registro, r.fecha_hora, tm.nombre_movimiento,
           e.serial, e.modelo, m.nombre_marca,
           p.nombres AS persona_nombres, p.apellidos AS persona_apellidos,
           u.usuario AS registrado_por
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    JOIN equipos e ON e.id_equipo = r.id_equipo
    JOIN marcas m ON m.id_marca = e.id_marca
    JOIN personas p ON p.id_persona = e.id_persona
    JOIN usuarios u ON u.id_usuario = r.id_usuario
    WHERE ${cond}
    ORDER BY r.fecha_hora DESC, r.id_registro DESC
    LIMIT 200
  `).all();

  res.json(rows.map((r) => ({ ...r, es_automatico: r.registrado_por === 'sistema' })));
});

// GET /api/dashboard/logins?periodo=dia|semana|mes
router.get('/logins', (req, res) => {
  const periodo = req.query.periodo || 'dia';
  const cond = condicionPeriodo('a.fecha', periodo);

  const rows = db.prepare(`
    SELECT a.id_auditoria, a.fecha, a.descripcion, u.usuario, u.nombre, u.apellidos, r.nombre_rol
    FROM auditoria a
    JOIN usuarios u ON u.id_usuario = a.id_usuario
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE a.accion = 'LOGIN' AND ${cond}
    ORDER BY a.fecha DESC
    LIMIT 200
  `).all();

  res.json(rows);
});

module.exports = router;
