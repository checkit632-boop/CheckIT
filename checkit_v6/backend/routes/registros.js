const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole, ROL_ADMIN, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// e.observaciones (v6) es la observación vigente del equipo — se registra una
// sola vez al crear/editar el equipo y se muestra tal cual en cada movimiento
// de su historial, en lugar de pedirse de nuevo en cada entrada/salida.
const SELECT_BASE = `
  SELECT r.*, tm.nombre_movimiento,
         e.serial, e.modelo, e.observaciones AS observaciones_equipo, m.nombre_marca,
         p.nombres AS persona_nombres, p.apellidos AS persona_apellidos, p.numero_documento,
         u.usuario AS registrado_por
  FROM registros r
  JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
  JOIN equipos e ON e.id_equipo = r.id_equipo
  JOIN marcas m ON m.id_marca = e.id_marca
  JOIN personas p ON p.id_persona = e.id_persona
  JOIN usuarios u ON u.id_usuario = r.id_usuario
`;

// GET /api/registros — Orden estricto por ID descendente
// Parámetros opcionales:
//   ?limit=N       -> limita la cantidad de resultados
//   ?hoy=1         -> solo movimientos del día actual (se "vacía" a las 00:00)
//   ?propios=1     -> solo los movimientos registrados por el usuario autenticado
//                     (el Super Administrador siempre ve los de todos, sin importar este flag)
router.get('/', (req, res) => {
  const { limit, hoy, propios } = req.query;
  const condiciones = [];
  const params = [];

  if (hoy) {
    condiciones.push(`date(r.fecha_hora) = date('now','localtime')`);
  }
  if (propios && req.user.rol !== ROL_SUPER) {
    condiciones.push(`r.id_usuario = ?`);
    params.push(req.user.id_usuario);
  }

  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  const sql = `${SELECT_BASE}${where} ORDER BY r.id_registro DESC` + (limit ? ` LIMIT ${Number(limit)}` : '');
  res.json(db.prepare(sql).all(...params));
});

// GET /api/registros/summary (Administrador o Super Administrador)
router.get('/summary', requireRole(ROL_ADMIN, ROL_SUPER), (req, res) => {
  const totales = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    GROUP BY tm.nombre_movimiento
  `).all();
  const total = db.prepare('SELECT COUNT(*) c FROM registros').get().c;
  res.json({ totales, total });
});

// Estadísticas operativas para todos los roles (Control de Acceso).
router.get('/stats/hoy', (req, res) => {
  const movimientosHoy = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE date(r.fecha_hora) = date('now','localtime')
    GROUP BY tm.nombre_movimiento
  `).all();

  const entradasHoy = movimientosHoy.find(m => m.nombre_movimiento?.toLowerCase() === 'entrada')?.total || 0;
  const salidasHoy = movimientosHoy.find(m => m.nombre_movimiento?.toLowerCase() === 'salida')?.total || 0;

  const equipos = db.prepare(`SELECT id_equipo FROM equipos`).all();
  let equiposDentro = 0;

  for (const equipo of equipos) {
    const ultimo = obtenerUltimoMovimiento(equipo.id_equipo);
    if (ultimo && ultimo.nombre_movimiento?.toLowerCase() === 'entrada') {
      equiposDentro++;
    }
  }

  // Movimientos de hoy hechos por el usuario autenticado. El Super
  // Administrador ve el total global (de todos los usuarios); Administrador
  // y Operador de Sistema solo ven los que ellos mismos registraron.
  const misMovimientosHoy = req.user.rol === ROL_SUPER
    ? entradasHoy + salidasHoy
    : db.prepare(`
        SELECT COUNT(*) AS total FROM registros r
        WHERE date(r.fecha_hora) = date('now','localtime') AND r.id_usuario = ?
      `).get(req.user.id_usuario).total;

  res.json({ entradasHoy, salidasHoy, equiposDentro, equiposRegistrados: equipos.length, misMovimientosHoy });
});

// Devuelve el último movimiento real de un equipo según el ID de registro
function obtenerUltimoMovimiento(id_equipo) {
  return db.prepare(`
    SELECT r.*, tm.nombre_movimiento
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ?
    ORDER BY r.id_registro DESC
    LIMIT 1
  `).get(id_equipo);
}

// GET /api/registros/estado/:id_equipo
router.get('/estado/:id_equipo', (req, res) => {
  const { id_equipo } = req.params;
  const equipo = db.prepare('SELECT * FROM equipos WHERE id_equipo = ?').get(id_equipo);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const ultimo = obtenerUltimoMovimiento(id_equipo);

  const ultimaEntrada = db.prepare(`
    SELECT r.fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND LOWER(tm.nombre_movimiento) = 'entrada'
    ORDER BY r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  const ultimaSalida = db.prepare(`
    SELECT r.fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND LOWER(tm.nombre_movimiento) = 'salida'
    ORDER BY r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  // Normalización a minúsculas para prevenir falsos 'Afuera'
  const ultimoTipo = ultimo?.nombre_movimiento?.toLowerCase();
  const estado = ultimoTipo === 'entrada' ? 'Adentro' : 'Afuera';

  res.json({
    estado,
    siguiente_movimiento: estado === 'Afuera' ? 'Entrada' : 'Salida',
    ultima_entrada: ultimaEntrada?.fecha_hora || null,
    ultima_salida: ultimaSalida?.fecha_hora || null,
  });
});

// POST /api/registros — registrar entrada o salida
router.post('/', (req, res) => {
  const { serial, tipo, observaciones } = req.body;
  if (!serial || !tipo) return res.status(400).json({ error: 'Serial y tipo de movimiento son obligatorios' });

  const equipo = db.prepare('SELECT * FROM equipos WHERE serial = ?').get(serial);
  if (!equipo) return res.status(404).json({ error: 'No se encontró un equipo con ese serial' });
  if (!equipo.activo) return res.status(409).json({ error: 'Este equipo está inactivo (dado de baja) y no puede registrar movimientos.' });

  const tipoMov = db.prepare('SELECT * FROM tipos_movimiento WHERE LOWER(nombre_movimiento) = LOWER(?)').get(tipo);
  if (!tipoMov) return res.status(400).json({ error: 'Tipo de movimiento inválido' });

  const ultimo = obtenerUltimoMovimiento(equipo.id_equipo);
  const ultimoTipo = ultimo?.nombre_movimiento?.toLowerCase();
  const estadoActual = ultimoTipo === 'entrada' ? 'Adentro' : 'Afuera';

  if (estadoActual === 'Adentro' && tipo.toLowerCase() === 'entrada') {
    return res.status(409).json({ error: 'Este equipo ya se encuentra adentro. Registra una salida.' });
  }
  if (estadoActual === 'Afuera' && tipo.toLowerCase() === 'salida') {
    return res.status(409).json({ error: 'Este equipo ya se encuentra afuera. Registra una entrada.' });
  }

  // Genera string ISO local estandarizado YYYY-MM-DD HH:MM:SS
  const ahora = new Date();
  const opciones = { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
  const partes = new Intl.DateTimeFormat('en-CA', opciones).formatToParts(ahora);
  const hashFecha = {};
  partes.forEach(p => hashFecha[p.type] = p.value);
  
  const fechaHoraLocal = `${hashFecha.year}-${hashFecha.month}-${hashFecha.day} ${hashFecha.hour}:${hashFecha.minute}:${hashFecha.second}`;

  const info = db.prepare(`
    INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento, observaciones, fecha_hora)
    VALUES (?, ?, ?, ?, ?)
  `).run(equipo.id_equipo, req.user.id_usuario, tipoMov.id_tipo_movimiento, observaciones || null, fechaHoraLocal);

  const registro = db.prepare('SELECT * FROM registros WHERE id_registro = ?').get(info.lastInsertRowid);
  res.status(201).json({ id_registro: info.lastInsertRowid, fecha_hora: registro.fecha_hora });
});

module.exports = router;