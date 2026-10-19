const express = require('express');
const db = require('../db/database');
const asyncHandler = require('../utils/asyncHandler');
const { rangoLocal } = require('../utils/periodos');
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

const LIMIT_POR_DEFECTO = 100;
const LIMIT_MAXIMO = 500;
const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Acepta solo fechas reales en formato AAAA-MM-DD (rechaza 2026-02-30).
function esFechaValida(valor) {
  if (typeof valor !== 'string' || !FECHA_REGEX.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

// Movimientos entre desde y hasta (ambos incluidos, en hora local), más la
// entrada previa de cada equipo cuyo ciclo empezó antes del período: así la
// vista Resumen puede armar el ciclo entrada -> salida completo en vez de
// mostrar una "salida aislada" solo porque su entrada quedó fuera del rango.
// La "entrada previa" es el movimiento inmediatamente anterior (por
// id_registro, el mismo orden con que Resumen arma los ciclos) al primer
// movimiento del equipo dentro del período; se resuelve con
// idx_registros_equipo.
const CONDICION_PERIODO = `(
  (r.fecha_hora >= ? AND r.fecha_hora < date(?, '+1 day'))
  OR r.id_registro IN (
    SELECT r3.id_registro
    FROM (
      SELECT (SELECT MAX(r2.id_registro) FROM registros r2
               WHERE r2.id_equipo = pr.id_equipo AND r2.id_registro < pr.primero) AS id_registro
      FROM (
        SELECT id_equipo, MIN(id_registro) AS primero
        FROM registros
        WHERE fecha_hora >= ? AND fecha_hora < date(?, '+1 day')
        GROUP BY id_equipo
      ) pr
    ) previo
    JOIN registros r3 ON r3.id_registro = previo.id_registro
    JOIN tipos_movimiento tm3 ON tm3.id_tipo_movimiento = r3.id_tipo_movimiento
    WHERE LOWER(tm3.nombre_movimiento) = 'entrada'
  )
)`;

// GET /api/registros — Orden estricto por ID descendente
// Parámetros opcionales:
//   ?limit=N       -> limita la cantidad de resultados (1 a 500; inválido = 100)
//   ?hoy=1         -> solo movimientos del día actual (se "vacía" a las 00:00)
//   ?propios=1     -> solo los movimientos registrados por el usuario autenticado
//                     (el Super Administrador siempre ve los de todos, sin importar este flag)
//   ?desde=AAAA-MM-DD&hasta=AAAA-MM-DD -> solo ese período (lo usa Resumen,
//                     para no descargar todo el historial en cada visita)
router.get('/', asyncHandler((req, res) => {
  const { limit, hoy, propios, desde, hasta } = req.query;
  const condiciones = [];
  const params = [];

  if (desde !== undefined || hasta !== undefined) {
    if (!esFechaValida(desde) || !esFechaValida(hasta) || desde > hasta) {
      return res.status(400).json({ error: 'El período debe tener desde y hasta en formato AAAA-MM-DD, con desde <= hasta.' });
    }
    condiciones.push(CONDICION_PERIODO);
    params.push(desde, hasta, desde, hasta);
  }

  if (hoy) {
    condiciones.push(rangoLocal('r.fecha_hora'));
  }
  if (propios && req.user.rol !== ROL_SUPER) {
    condiciones.push(`r.id_usuario = ?`);
    params.push(req.user.id_usuario);
  }

  const where = condiciones.length ? ` WHERE ${condiciones.join(' AND ')}` : '';
  let sql = `${SELECT_BASE}${where} ORDER BY r.id_registro DESC`;

  // H-07 / O-01: el límite nunca se interpola en la cadena SQL; va como
  // parámetro preparado (?) igual que el resto de valores. Un valor no
  // numérico o no positivo (?limit=abc, ?limit=-5) usa el tope por defecto
  // en vez de producir "LIMIT NaN" (500), y uno desmedido se acota al máximo.
  // Sin ?limit (ni período) se devuelve el historial completo.
  if (limit !== undefined) {
    const pedido = Number.parseInt(limit, 10);
    const tope = Number.isInteger(pedido) && pedido > 0 ? Math.min(pedido, LIMIT_MAXIMO) : LIMIT_POR_DEFECTO;
    sql += ' LIMIT ?';
    params.push(tope);
  }

  res.json(db.prepare(sql).all(...params));
}));

// GET /api/registros/summary (Administrador o Super Administrador)
router.get('/summary', requireRole(ROL_ADMIN, ROL_SUPER), asyncHandler((req, res) => {
  const totales = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    GROUP BY tm.nombre_movimiento
  `).all();
  const total = db.prepare('SELECT COUNT(*) c FROM registros').get().c;
  res.json({ totales, total });
}));

// Estadísticas operativas para todos los roles (Control de Acceso).
router.get('/stats/hoy', asyncHandler((req, res) => {
  const movimientosHoy = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE ${rangoLocal('r.fecha_hora')}
    GROUP BY tm.nombre_movimiento
  `).all();

  const entradasHoy = movimientosHoy.find(m => m.nombre_movimiento?.toLowerCase() === 'entrada')?.total || 0;
  const salidasHoy = movimientosHoy.find(m => m.nombre_movimiento?.toLowerCase() === 'salida')?.total || 0;

  // Un equipo está "adentro" si su último movimiento (el de mayor
  // id_registro, igual que obtenerUltimoMovimiento) es una entrada. Se
  // resuelve en una sola consulta con idx_registros_equipo, en vez de una
  // consulta por cada equipo.
  const { equiposRegistrados, equiposDentro } = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM equipos) AS equiposRegistrados,
      (SELECT COUNT(*)
         FROM equipos e
         JOIN registros r ON r.id_registro = (SELECT MAX(id_registro) FROM registros WHERE id_equipo = e.id_equipo)
         JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
        WHERE LOWER(tm.nombre_movimiento) = 'entrada') AS equiposDentro
  `).get();

  // Movimientos de hoy hechos por el usuario autenticado. El Super
  // Administrador ve el total global (de todos los usuarios); Administrador
  // y Operador de Sistema solo ven los que ellos mismos registraron.
  const misMovimientosHoy = req.user.rol === ROL_SUPER
    ? entradasHoy + salidasHoy
    : db.prepare(`
        SELECT COUNT(*) AS total FROM registros r
        WHERE ${rangoLocal('r.fecha_hora')} AND r.id_usuario = ?
      `).get(req.user.id_usuario).total;

  res.json({ entradasHoy, salidasHoy, equiposDentro, equiposRegistrados, misMovimientosHoy });
}));

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
router.get('/estado/:id_equipo', asyncHandler((req, res) => {
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
}));

// POST /api/registros — registrar entrada o salida
router.post('/', asyncHandler((req, res) => {
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
}));

module.exports = router;