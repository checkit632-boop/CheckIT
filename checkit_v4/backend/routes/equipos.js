const express = require('express');
const QRCode = require('qrcode');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

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

// GET /api/equipos  (ambos roles)
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
  const { id_persona, id_marca, modelo, serial, id_estado } = req.body;
  if (!id_persona || !id_marca || !serial || !id_estado) {
    return res.status(400).json({ error: 'Persona, marca, serial y estado son obligatorios' });
  }
  const exists = db.prepare('SELECT 1 FROM equipos WHERE serial = ?').get(serial);
  if (exists) return res.status(409).json({ error: 'Ya existe un equipo con ese serial' });

  const codigoQr = JSON.stringify({ sistema: 'CheckIT', serial });
  const info = db.prepare(`
    INSERT INTO equipos (id_persona, id_marca, modelo, serial, codigo_qr, id_estado)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id_persona, id_marca, modelo || null, serial, codigoQr, id_estado);

  res.status(201).json({ id_equipo: info.lastInsertRowid, codigo_qr: codigoQr });
});

// PUT /api/equipos/:id (solo admin)
router.put('/:id', requireRole('Administrador'), (req, res) => {
  const { id } = req.params;
  const { id_persona, id_marca, modelo, serial, id_estado } = req.body;
  const codigoQr = JSON.stringify({ sistema: 'CheckIT', serial });
  db.prepare(`
    UPDATE equipos SET id_persona=?, id_marca=?, modelo=?, serial=?, codigo_qr=?, id_estado=?
    WHERE id_equipo=?
  `).run(id_persona, id_marca, modelo || null, serial, codigoQr, id_estado, id);
  res.json({ message: 'Equipo actualizado' });
});

// DELETE /api/equipos/:id (solo admin)
router.delete('/:id', requireRole('Administrador'), (req, res) => {
  db.prepare('DELETE FROM equipos WHERE id_equipo = ?').run(req.params.id);
  res.json({ message: 'Equipo eliminado' });
});

module.exports = router;
