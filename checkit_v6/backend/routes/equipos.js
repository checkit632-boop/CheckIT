const express = require('express');
const QRCode = require('qrcode');
const db = require('../db/database');
const { authRequired, requireRole, ROL_ADMIN, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

const SELECT_BASE = `
  SELECT e.*, m.nombre_marca, es.nombre_estado,
         p.nombres AS persona_nombres, p.apellidos AS persona_apellidos, p.numero_documento
  FROM equipos e
  JOIN marcas m ON m.id_marca = e.id_marca
  JOIN estados es ON es.id_estado = e.id_estado
  JOIN personas p ON p.id_persona = e.id_persona
`;

// GET /api/equipos  (todos los roles)
router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`${SELECT_BASE} WHERE e.serial LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ? ORDER BY e.id_equipo DESC`)
      .all(like, like, like);
  } else {
    rows = db.prepare(`${SELECT_BASE} ORDER BY e.id_equipo DESC`).all();
  }
  res.json(rows);
});

// GET /api/equipos/serial/:serial
router.get('/serial/:serial', (req, res) => {
  const row = db.prepare(`${SELECT_BASE} WHERE e.serial = ?`).get(req.params.serial);
  if (!row) return res.status(404).json({ error: 'Equipo no encontrado' });
  res.json(row);
});

// GET /api/equipos/:id/qr — devuelve el QR como Data URL PNG
router.get('/:id/qr', async (req, res) => {
  const eq = db.prepare('SELECT * FROM equipos WHERE id_equipo = ?').get(req.params.id);
  if (!eq) return res.status(404).json({ error: 'Equipo no encontrado' });
  try {
    const dataUrl = await QRCode.toDataURL(eq.codigo_qr || eq.serial, { width: 260, margin: 1 });
    res.json({ dataUrl, payload: eq.codigo_qr || eq.serial });
  } catch (err) {
    res.status(500).json({ error: 'No se pudo generar el QR' });
  }
});

// POST /api/equipos (ambos roles pueden registrar equipos)
router.post('/', (req, res) => {
  const { id_persona, id_marca, modelo, serial, id_estado, observaciones } = req.body;
  if (!id_persona || !id_marca || !serial || !id_estado) {
    return res.status(400).json({ error: 'Persona, marca, serial y estado son obligatorios' });
  }
  const exists = db.prepare('SELECT 1 FROM equipos WHERE serial = ?').get(serial);
  if (exists) return res.status(409).json({ error: 'Ya existe un equipo con ese serial' });

  const codigoQr = JSON.stringify({ sistema: 'CheckIT', serial });
  const info = db.prepare(`
    INSERT INTO equipos (id_persona, id_marca, modelo, serial, codigo_qr, id_estado, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id_persona, id_marca, modelo || null, serial, codigoQr, id_estado, observaciones || null);

  res.status(201).json({ id_equipo: info.lastInsertRowid, codigo_qr: codigoQr });
});

// PUT /api/equipos/:id (Administrador o Super Administrador)
router.put('/:id', requireRole(ROL_ADMIN, ROL_SUPER), (req, res) => {
  const { id } = req.params;
  const { id_persona, id_marca, modelo, serial, id_estado, observaciones } = req.body;
  const codigoQr = JSON.stringify({ sistema: 'CheckIT', serial });
  db.prepare(`
    UPDATE equipos SET id_persona=?, id_marca=?, modelo=?, serial=?, codigo_qr=?, id_estado=?, observaciones=?
    WHERE id_equipo=?
  `).run(id_persona, id_marca, modelo || null, serial, codigoQr, id_estado, observaciones || null, id);
  res.json({ message: 'Equipo actualizado' });
});

// DELETE /api/equipos/:id (Administrador o Super Administrador)
router.delete('/:id', requireRole(ROL_ADMIN, ROL_SUPER), (req, res) => {
  try {
    db.prepare('DELETE FROM equipos WHERE id_equipo = ?').run(req.params.id);
    res.json({ message: 'Equipo eliminado' });
  } catch (err) {
    // El equipo ya tiene movimientos registrados (llave foránea en registros):
    // no se puede borrar sin perder ese historial. La alternativa es
    // inactivarlo en lugar de eliminarlo.
    res.status(409).json({ error: 'No se puede eliminar: este equipo ya tiene movimientos registrados. Usa "Inactivar" en su lugar.' });
  }
});

// PATCH /api/equipos/:id/estado — activar/inactivar (solo Super Administrador).
// No borra ni modifica ningún registro histórico del equipo, solo cambia
// si puede seguir usándose para nuevas entradas/salidas.
router.patch('/:id/estado', requireRole(ROL_SUPER), (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;
  const equipo = db.prepare('SELECT * FROM equipos WHERE id_equipo = ?').get(id);
  if (!equipo) return res.status(404).json({ error: 'Equipo no encontrado' });

  db.prepare('UPDATE equipos SET activo = ? WHERE id_equipo = ?').run(activo ? 1 : 0, id);

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'equipos', ?)`)
    .run(req.user.id_usuario, `Equipo ${equipo.serial} marcado como ${activo ? 'activo' : 'inactivo'} por ${req.user.usuario}`);

  res.json({ message: `Equipo ${activo ? 'activado' : 'inactivado'} correctamente` });
});

module.exports = router;
