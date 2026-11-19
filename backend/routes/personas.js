const express = require('express');
const db = require('../db/database');
const { patronContiene } = require('../utils/busqueda');
const { formatoNombre } = require('../utils/nombres');
const { authRequired, requireRole, ROL_ADMIN, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/personas  (ambos roles — se usa para búsquedas en Entradas/Salidas y Equipos)
//   ?q=texto   -> busca en nombres, apellidos y documento (también "nombre apellido")
//   ?limit=N   -> máximo N resultados (1 a 50); lo usa el buscador de
//                 propietarios de Equipos, que solo muestra unos pocos
router.get('/', (req, res) => {
  const { q } = req.query;
  const condiciones = [];
  const params = [];
  if (q) {
    condiciones.push(
      `(p.nombres || ' ' || p.apellidos || ' ' || p.numero_documento) LIKE ? ESCAPE '!'`
    );
    params.push(patronContiene(q));
  }
  let sql = `
    SELECT p.*, td.nombre_documento,
           (SELECT COUNT(*) FROM equipos e WHERE e.id_persona = p.id_persona) AS equipos
    FROM personas p
    JOIN tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
    ${condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''}
    ORDER BY p.id_persona DESC
  `;
  const limite = Number.parseInt(req.query.limit, 10);
  if (Number.isInteger(limite) && limite > 0) {
    sql += ' LIMIT ?';
    params.push(Math.min(limite, 50));
  }
  res.json(db.prepare(sql).all(...params));
});

// GET /api/personas/documento/:numero
router.get('/documento/:numero', (req, res) => {
  const row = db
    .prepare('SELECT * FROM personas WHERE numero_documento = ?')
    .get(req.params.numero);
  if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(row);
});

// POST /api/personas (ambos roles pueden registrar personas)
router.post('/', (req, res) => {
  const { id_tipo_documento, correo, celular } = req.body;
  // v7.0: documento sin espacios de más; nombres y apellidos con mayúscula
  // inicial en cada palabra (utils/nombres.js).
  const numero_documento = limpiar(req.body.numero_documento);
  const nombres = formatoNombre(req.body.nombres);
  const apellidos = formatoNombre(req.body.apellidos);
  if (!id_tipo_documento || !numero_documento || !nombres || !apellidos) {
    return res
      .status(400)
      .json({ error: 'Tipo de documento, número, nombres y apellidos son obligatorios' });
  }
  const exists = db
    .prepare('SELECT * FROM personas WHERE numero_documento = ?')
    .get(numero_documento);
  if (exists)
    return res
      .status(409)
      .json({ error: 'Ya existe una persona con ese documento', persona: exists });

  const info = db
    .prepare(
      `
    INSERT INTO personas (id_tipo_documento, numero_documento, nombres, apellidos, correo, celular)
    VALUES (?, ?, ?, ?, ?, ?)
  `
    )
    .run(id_tipo_documento, numero_documento, nombres, apellidos, correo || null, celular || null);

  res.status(201).json({ id_persona: info.lastInsertRowid });
});

// GET /api/personas/:id — datos completos de una persona (v7.0: los usa la
// edición del responsable desde Registro de Equipos).
router.get('/:id', (req, res) => {
  const row = db
    .prepare(
      `
    SELECT p.*, td.nombre_documento,
           (SELECT COUNT(*) FROM equipos e WHERE e.id_persona = p.id_persona) AS equipos
    FROM personas p
    JOIN tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
    WHERE p.id_persona = ?
  `
    )
    .get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(row);
});

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const limpiar = (v) =>
  String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ');

// PUT /api/personas/:id (Administrador o Super Administrador)
// v7.0: valida igual que el registro (campos obligatorios, documento único,
// correo con formato válido), responde 404 si la persona no existe y deja el
// cambio en la auditoría sin copiar sus datos personales.
router.put('/:id', requireRole(ROL_ADMIN, ROL_SUPER), (req, res) => {
  const { id } = req.params;
  const actual = db.prepare('SELECT id_persona FROM personas WHERE id_persona = ?').get(id);
  if (!actual) return res.status(404).json({ error: 'Persona no encontrada' });

  const id_tipo_documento = Number(req.body.id_tipo_documento);
  const numero_documento = limpiar(req.body.numero_documento);
  const nombres = formatoNombre(req.body.nombres);
  const apellidos = formatoNombre(req.body.apellidos);
  const correo = limpiar(req.body.correo);
  const celular = limpiar(req.body.celular);
  if (!id_tipo_documento || !numero_documento || !nombres || !apellidos) {
    return res
      .status(400)
      .json({ error: 'Tipo de documento, número, nombres y apellidos son obligatorios' });
  }
  if (
    !db.prepare('SELECT 1 FROM tipos_documento WHERE id_tipo_documento = ?').get(id_tipo_documento)
  ) {
    return res.status(400).json({ error: 'El tipo de documento no es válido' });
  }
  if (correo && !CORREO_REGEX.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }
  const otra = db
    .prepare('SELECT 1 FROM personas WHERE numero_documento = ? AND id_persona <> ?')
    .get(numero_documento, id);
  if (otra)
    return res.status(409).json({ error: 'Ya existe otra persona con ese número de documento' });

  db.transaction(() => {
    db.prepare(
      `
      UPDATE personas SET id_tipo_documento=?, numero_documento=?, nombres=?, apellidos=?, correo=?, celular=?, fecha_actualizacion=CURRENT_TIMESTAMP
      WHERE id_persona=?
    `
    ).run(
      id_tipo_documento,
      numero_documento,
      nombres,
      apellidos,
      correo || null,
      celular || null,
      id
    );
    db.prepare(
      `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'personas', ?)`
    ).run(
      req.user.id_usuario,
      `Datos de la persona #${id} actualizados por ${req.user.usuario} desde Registro de Equipos`
    );
  })();
  res.json({ message: 'Persona actualizada' });
});

// DELETE /api/personas/:id (Administrador o Super Administrador)
// v7.0: solo se elimina una persona que no tiene equipos (por ejemplo, una
// que quedó registrada sin su equipo). Responde 404 si no existe y deja el
// hecho en la auditoría sin copiar sus datos personales.
router.delete('/:id', requireRole(ROL_ADMIN, ROL_SUPER), (req, res) => {
  const { id } = req.params;
  if (!db.prepare('SELECT 1 FROM personas WHERE id_persona = ?').get(id)) {
    return res.status(404).json({ error: 'Persona no encontrada' });
  }
  const equipos = db.prepare('SELECT COUNT(*) FROM equipos WHERE id_persona = ?').pluck().get(id);
  if (equipos > 0) {
    return res.status(409).json({
      error: `No se puede eliminar: la persona tiene ${equipos} equipo(s). Elimina o reasigna primero sus equipos.`,
    });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM personas WHERE id_persona = ?').run(id);
    db.prepare(
      `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'DELETE', 'personas', ?)`
    ).run(req.user.id_usuario, `Persona #${id} sin equipos eliminada por ${req.user.usuario}`);
  })();
  res.json({ message: 'Persona eliminada' });
});

module.exports = router;
