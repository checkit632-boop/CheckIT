const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const SELECT_BASE = `
  SELECT r.*, tm.nombre_movimiento,
         e.serial, e.modelo, m.nombre_marca,
         p.nombres AS persona_nombres, p.apellidos AS persona_apellidos, p.numero_documento,
         u.usuario AS registrado_por
  FROM registros r
  JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
  JOIN equipos e ON e.id_equipo = r.id_equipo
  JOIN marcas m ON m.id_marca = e.id_marca
  JOIN personas p ON p.id_persona = e.id_persona
  JOIN usuarios u ON u.id_usuario = r.id_usuario
`;

// GET /api/registros  (ambos roles — el operador ve el historial de accesos)
router.get('/', (req, res) => {
  const { limit } = req.query;
  const sql = `${SELECT_BASE} ORDER BY r.fecha_hora DESC` + (limit ? ` LIMIT ${Number(limit)}` : '');
  res.json(db.prepare(sql).all());
});

// GET /api/registros/summary (solo admin) — estadísticas para la página Resumen
router.get('/summary', requireRole('Administrador'), (req, res) => {
  const totales = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    GROUP BY tm.nombre_movimiento
  `).all();
  const total = db.prepare('SELECT COUNT(*) c FROM registros').get().c;
  res.json({ totales, total });
});

// GET /api/registros/hoy — para el dashboard
router.get('/stats/hoy', (req, res) => {
  const row = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE date(r.fecha_hora) = date('now', 'localtime')
    GROUP BY tm.nombre_movimiento
  `).all();
  res.json(row);
});

// Devuelve el último movimiento de un equipo (o null si nunca ha tenido uno)
function obtenerUltimoMovimiento(id_equipo) {
  return db.prepare(`
    SELECT r.*, tm.nombre_movimiento
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ?
    ORDER BY r.fecha_hora DESC, r.id_registro DESC
    LIMIT 1
  `).get(id_equipo);
}

// GET /api/registros/estado/:id_equipo — estado actual del equipo (Adentro/Afuera)
// y fecha/hora del último ingreso y última salida, para pintar el botón dinámico
// de Entradas/Salidas en el frontend.
router.get('/estado/:id_equipo', (req, res) => {
  const { id_equipo } = req.params;
  const equipo = db.prepare('SELECT * FROM equipos WHERE id_equipo = ?').get(id_equipo);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  const ultimo = obtenerUltimoMovimiento(id_equipo);

  const ultimaEntrada = db.prepare(`
    SELECT r.fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND tm.nombre_movimiento = 'Entrada'
    ORDER BY r.fecha_hora DESC, r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  const ultimaSalida = db.prepare(`
    SELECT r.fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND tm.nombre_movimiento = 'Salida'
    ORDER BY r.fecha_hora DESC, r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  // Si nunca ha tenido movimientos, o el último fue una Salida -> el equipo está Afuera.
  // Si el último movimiento fue una Entrada -> el equipo está Adentro.
  const estado = !ultimo || ultimo.nombre_movimiento === 'Salida' ? 'Afuera' : 'Adentro';

  res.json({
    estado,
    siguiente_movimiento: estado === 'Afuera' ? 'Entrada' : 'Salida',
    ultima_entrada: ultimaEntrada?.fecha_hora || null,
    ultima_salida: ultimaSalida?.fecha_hora || null,
  });
});

// POST /api/registros — registrar entrada o salida (ambos roles)
router.post('/', (req, res) => {
  const { serial, tipo, observaciones } = req.body; // tipo: 'Entrada' | 'Salida'
  if (!serial || !tipo) return res.status(400).json({ error: 'Serial y tipo de movimiento son obligatorios' });

  const equipo = db.prepare('SELECT * FROM equipos WHERE serial = ?').get(serial);
  if (!equipo) return res.status(404).json({ error: 'No se encontró un equipo con ese serial' });

  const tipoMov = db.prepare('SELECT * FROM tipos_movimiento WHERE nombre_movimiento = ?').get(tipo);
  if (!tipoMov) return res.status(400).json({ error: 'Tipo de movimiento inválido' });

  // Evita registrar dos entradas o dos salidas seguidas para el mismo equipo,
  // incluso si alguien llama a la API directamente sin pasar por el botón dinámico.
  const ultimo = obtenerUltimoMovimiento(equipo.id_equipo);
  const estadoActual = !ultimo || ultimo.nombre_movimiento === 'Salida' ? 'Afuera' : 'Adentro';
  if (estadoActual === 'Adentro' && tipo === 'Entrada') {
    return res.status(409).json({ error: 'Este equipo ya se encuentra adentro. Registra una salida.' });
  }
  if (estadoActual === 'Afuera' && tipo === 'Salida') {
    return res.status(409).json({ error: 'Este equipo ya se encuentra afuera. Registra una entrada.' });
  }

  const info = db.prepare(`
    INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento, observaciones)
    VALUES (?, ?, ?, ?)
  `).run(equipo.id_equipo, req.user.id_usuario, tipoMov.id_tipo_movimiento, observaciones || null);

  const registro = db.prepare('SELECT * FROM registros WHERE id_registro = ?').get(info.lastInsertRowid);
  res.status(201).json({ id_registro: info.lastInsertRowid, fecha_hora: registro.fecha_hora });
});

module.exports = router;
