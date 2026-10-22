const express = require('express');
const db = require('../db/database');
const asyncHandler = require('../utils/asyncHandler');
const { aHoraLocal, rangoUtc, rangoEntreFechasLocales } = require('../utils/periodos');
const { authRequired, requireRole, ROL_ADMIN, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// e.observaciones (v6) es la observación vigente del equipo — se registra una
// sola vez al crear/editar el equipo y se muestra tal cual en cada movimiento
// de su historial, en lugar de pedirse de nuevo en cada entrada/salida.
// fecha_hora se guarda en UTC y aquí se entrega en hora de Colombia.
const SELECT_BASE = `
  SELECT r.id_registro, r.id_equipo, r.id_usuario, r.id_tipo_movimiento, r.observaciones,
         ${aHoraLocal('r.fecha_hora')} AS fecha_hora,
         tm.nombre_movimiento,
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

// Movimientos entre desde y hasta (fechas locales, ambas incluidas), más la
// entrada previa de cada equipo cuyo ciclo empezó antes del período: así la
// vista Resumen puede armar el ciclo entrada -> salida completo en vez de
// mostrar una "salida aislada" solo porque su entrada quedó fuera del rango.
// La "entrada previa" es el movimiento inmediatamente anterior (por
// id_registro, el mismo orden con que Resumen arma los ciclos) al primer
// movimiento del equipo dentro del período; se resuelve con
// idx_registros_equipo.
const CONDICION_PERIODO = `(
  (${rangoEntreFechasLocales('r.fecha_hora')})
  OR r.id_registro IN (
    SELECT r3.id_registro
    FROM (
      SELECT (SELECT MAX(r2.id_registro) FROM registros r2
               WHERE r2.id_equipo = pr.id_equipo AND r2.id_registro < pr.primero) AS id_registro
      FROM (
        SELECT id_equipo, MIN(id_registro) AS primero
        FROM registros
        WHERE ${rangoEntreFechasLocales('fecha_hora')}
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
    condiciones.push(rangoUtc('r.fecha_hora'));
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

// Contadores de Control de Acceso para el usuario dado. Los usan
// GET /stats/hoy y POST /escanear (que los devuelve ya actualizados).
function estadisticasHoy(usuario) {
  const movimientosHoy = db.prepare(`
    SELECT tm.nombre_movimiento, COUNT(*) AS total
    FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE ${rangoUtc('r.fecha_hora')}
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
  const misMovimientosHoy = usuario.rol === ROL_SUPER
    ? entradasHoy + salidasHoy
    : db.prepare(`
        SELECT COUNT(*) AS total FROM registros r
        WHERE ${rangoUtc('r.fecha_hora')} AND r.id_usuario = ?
      `).get(usuario.id_usuario).total;

  return { entradasHoy, salidasHoy, equiposDentro, equiposRegistrados, misMovimientosHoy };
}

// GET /api/registros/dentro — equipos que están adentro ahora, con los
// datos de su propietario y de la entrada que los dejó adentro. Lo usa la
// tarjeta "Equipos Dentro" de Control de Acceso (todos los roles). Usa la
// MISMA condición que el contador de estadisticasHoy (último movimiento por
// id_registro = entrada), para que la lista y el número siempre coincidan.
// Solo se entregan los datos necesarios para identificar al propietario.
router.get('/dentro', asyncHandler((req, res) => {
  res.json(db.prepare(`
    SELECT e.id_equipo, e.serial, e.modelo, m.nombre_marca, e.activo,
           p.nombres AS persona_nombres, p.apellidos AS persona_apellidos,
           td.nombre_documento AS tipo_documento, p.numero_documento, p.celular,
           ${aHoraLocal('r.fecha_hora')} AS fecha_entrada,
           u.usuario AS registrado_por
    FROM equipos e
    JOIN registros r ON r.id_registro = (SELECT MAX(id_registro) FROM registros WHERE id_equipo = e.id_equipo)
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    JOIN marcas m ON m.id_marca = e.id_marca
    JOIN personas p ON p.id_persona = e.id_persona
    JOIN tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
    JOIN usuarios u ON u.id_usuario = r.id_usuario
    WHERE LOWER(tm.nombre_movimiento) = 'entrada'
    ORDER BY r.id_registro DESC
  `).all());
}));

// Estadísticas operativas para todos los roles (Control de Acceso).
router.get('/stats/hoy', asyncHandler((req, res) => {
  res.json(estadisticasHoy(req.user));
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

// Estado actual de un equipo (Adentro/Afuera), el siguiente movimiento que
// le corresponde y las fechas de su última entrada y salida.
function estadoDeEquipo(id_equipo) {
  const ultimo = obtenerUltimoMovimiento(id_equipo);

  const ultimaEntrada = db.prepare(`
    SELECT ${aHoraLocal('r.fecha_hora')} AS fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND LOWER(tm.nombre_movimiento) = 'entrada'
    ORDER BY r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  const ultimaSalida = db.prepare(`
    SELECT ${aHoraLocal('r.fecha_hora')} AS fecha_hora FROM registros r
    JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
    WHERE r.id_equipo = ? AND LOWER(tm.nombre_movimiento) = 'salida'
    ORDER BY r.id_registro DESC LIMIT 1
  `).get(id_equipo);

  // Normalización a minúsculas para prevenir falsos 'Afuera'
  const ultimoTipo = ultimo?.nombre_movimiento?.toLowerCase();
  const estado = ultimoTipo === 'entrada' ? 'Adentro' : 'Afuera';

  return {
    estado,
    siguiente_movimiento: estado === 'Afuera' ? 'Entrada' : 'Salida',
    ultima_entrada: ultimaEntrada?.fecha_hora || null,
    ultima_salida: ultimaSalida?.fecha_hora || null,
  };
}

// GET /api/registros/estado/:id_equipo
router.get('/estado/:id_equipo', asyncHandler((req, res) => {
  const { id_equipo } = req.params;
  const equipo = db.prepare('SELECT * FROM equipos WHERE id_equipo = ?').get(id_equipo);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });
  res.json(estadoDeEquipo(id_equipo));
}));

// fecha_hora (UTC) de un registro recién creado, ya en hora local.
function fechaLocalDeRegistro(id_registro) {
  return db.prepare(`SELECT ${aHoraLocal('fecha_hora')} AS f FROM registros WHERE id_registro = ?`).get(id_registro).f;
}

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

  // fecha_hora no se envía: la pone la base (CURRENT_TIMESTAMP, en UTC).
  const info = db.prepare(`
    INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento, observaciones)
    VALUES (?, ?, ?, ?)
  `).run(equipo.id_equipo, req.user.id_usuario, tipoMov.id_tipo_movimiento, observaciones || null);

  res.status(201).json({ id_registro: info.lastInsertRowid, fecha_hora: fechaLocalDeRegistro(info.lastInsertRowid) });
}));

// ── Escaneo rápido en portería ─────────────────────────────────
// Un solo viaje al servidor por escaneo (antes eran 6 peticiones en
// cascada): busca el equipo, decide si le toca entrada o salida, la
// registra y devuelve todo lo que la pantalla necesita para actualizarse.

// Una lectura repetida del mismo código dentro de esta ventana se ignora:
// las pistolas lectoras y la cámara a veces leen dos veces el mismo código, y
// sin esto se registraría la entrada y de inmediato su salida.
const VENTANA_DUPLICADO_MS = 8000;
const ultimosEscaneos = new Map(); // serial -> momento del último registro

// Acepta el serial suelto (código de barras del fabricante) o el contenido
// del QR de CheckIT ({"sistema":"CheckIT","serial":"..."}). Si una pistola
// lectora configurada con otra distribución de teclado cambia las comillas o
// las llaves, el serial se rescata igual con la expresión regular.
function extraerSerial(codigo) {
  const texto = String(codigo || '').trim();
  if (!texto) return '';
  try {
    const json = JSON.parse(texto);
    if (json && typeof json.serial === 'string') return json.serial.trim();
  } catch {
    // no es JSON válido; se intenta abajo
  }
  const enQr = texto.match(/serial\W+([A-Za-z0-9._\-/]+)/i);
  return enQr ? enQr[1] : texto;
}

// Los mismos movimientos que muestra el panel "Movimientos recientes"
// (equivale a GET /registros?limit=20&hoy=1&propios=1).
function recientesDeHoy(usuario) {
  const soloPropios = usuario.rol !== ROL_SUPER;
  return db.prepare(`
    ${SELECT_BASE}
    WHERE ${rangoUtc('r.fecha_hora')} ${soloPropios ? 'AND r.id_usuario = ?' : ''}
    ORDER BY r.id_registro DESC LIMIT 20
  `).all(...(soloPropios ? [usuario.id_usuario] : []));
}

// POST /api/registros/escanear  { codigo }
router.post('/escanear', asyncHandler((req, res) => {
  const serial = extraerSerial(req.body?.codigo);
  if (!serial) return res.status(400).json({ error: 'El código escaneado está vacío.' });

  const equipo = db.prepare(`
    SELECT e.*, m.nombre_marca, p.nombres AS persona_nombres, p.apellidos AS persona_apellidos, p.numero_documento
    FROM equipos e
    JOIN marcas m ON m.id_marca = e.id_marca
    JOIN personas p ON p.id_persona = e.id_persona
    WHERE e.serial = ?
  `).get(serial);
  if (!equipo) return res.status(404).json({ error: `No se encontró un equipo con el serial ${serial}` });
  if (!equipo.activo) {
    return res.status(409).json({ error: 'Este equipo está inactivo (dado de baja) y no puede registrar movimientos.', equipo });
  }

  const ultimoEscaneo = ultimosEscaneos.get(equipo.serial);
  if (ultimoEscaneo && Date.now() - ultimoEscaneo < VENTANA_DUPLICADO_MS) {
    return res.status(409).json({
      error: 'Este equipo se acaba de registrar; se ignoró la lectura repetida.',
      duplicado: true,
      equipo,
      estado: estadoDeEquipo(equipo.id_equipo),
    });
  }

  // Decidir y registrar en una sola transacción, para que dos lecturas casi
  // simultáneas no registren el mismo tipo de movimiento dos veces.
  const registrar = db.transaction(() => {
    const ultimo = obtenerUltimoMovimiento(equipo.id_equipo);
    const movimiento = ultimo?.nombre_movimiento?.toLowerCase() === 'entrada' ? 'Salida' : 'Entrada';
    const tipoMov = db.prepare('SELECT id_tipo_movimiento FROM tipos_movimiento WHERE nombre_movimiento = ?').get(movimiento);
    const info = db.prepare(`
      INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento) VALUES (?, ?, ?)
    `).run(equipo.id_equipo, req.user.id_usuario, tipoMov.id_tipo_movimiento);
    return { movimiento, id_registro: info.lastInsertRowid, fecha_hora: fechaLocalDeRegistro(info.lastInsertRowid) };
  });

  const registro = registrar();
  ultimosEscaneos.set(equipo.serial, Date.now());
  // Limpieza para que el mapa no crezca sin límite durante el día.
  if (ultimosEscaneos.size > 5000) ultimosEscaneos.clear();

  res.status(201).json({
    ...registro,
    equipo,
    estado: estadoDeEquipo(equipo.id_equipo),
    stats: estadisticasHoy(req.user),
    recientes: recientesDeHoy(req.user),
  });
}));

module.exports = router;