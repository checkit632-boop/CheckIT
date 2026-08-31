const express = require('express');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

// GET /api/personas  (ambos roles — se usa para búsquedas en Entradas/Salidas y Equipos)
router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT p.*, td.nombre_documento FROM personas p
      JOIN tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
      WHERE p.numero_documento LIKE ? OR p.nombres LIKE ? OR p.apellidos LIKE ?
      ORDER BY p.id_persona DESC
    `).all(like, like, like);
  } else {
    rows = db.prepare(`
      SELECT p.*, td.nombre_documento FROM personas p
      JOIN tipos_documento td ON td.id_tipo_documento = p.id_tipo_documento
      ORDER BY p.id_persona DESC
    `).all();
  }
  res.json(rows);
});

// GET /api/personas/documento/:numero
router.get('/documento/:numero', (req, res) => {
  const row = db.prepare('SELECT * FROM personas WHERE numero_documento = ?').get(req.params.numero);
  if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
  res.json(row);
});

// POST /api/personas (ambos roles pueden registrar personas)
router.post('/', (req, res) => {
  const { id_tipo_documento, numero_documento, nombres, apellidos, correo, celular } = req.body;
  if (!id_tipo_documento || !numero_documento || !nombres || !apellidos) {
    return res.status(400).json({ error: 'Tipo de documento, número, nombres y apellidos son obligatorios' });
  }
  const exists = db.prepare('SELECT * FROM personas WHERE numero_documento = ?').get(numero_documento);
  if (exists) return res.status(409).json({ error: 'Ya existe una persona con ese documento', persona: exists });

  const info = db.prepare(`
    INSERT INTO personas (id_tipo_documento, numero_documento, nombres, apellidos, correo, celular)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id_tipo_documento, numero_documento, nombres, apellidos, correo || null, celular || null);

  res.status(201).json({ id_persona: info.lastInsertRowid });
});

// PUT /api/personas/:id (solo admin)
router.put('/:id', requireRole('Administrador'), (req, res) => {
  const { id } = req.params;
  const { id_tipo_documento, numero_documento, nombres, apellidos, correo, celular } = req.body;
  db.prepare(`
    UPDATE personas SET id_tipo_documento=?, numero_documento=?, nombres=?, apellidos=?, correo=?, celular=?, fecha_actualizacion=CURRENT_TIMESTAMP
    WHERE id_persona=?
  `).run(id_tipo_documento, numero_documento, nombres, apellidos, correo || null, celular || null, id);
  res.json({ message: 'Persona actualizada' });
});

// DELETE /api/personas/:id (solo admin)
router.delete('/:id', requireRole('Administrador'), (req, res) => {
  db.prepare('DELETE FROM personas WHERE id_persona = ?').run(req.params.id);
  res.json({ message: 'Persona eliminada' });
});

module.exports = router;
