const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authRequired, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole('Administrador'));

function userView(u) {
  return {
    id_usuario: u.id_usuario,
    usuario: u.usuario,
    nombre: u.nombre,
    apellidos: u.apellidos,
    correo: u.correo,
    celular: u.celular,
    id_rol: u.id_rol,
    rol: u.nombre_rol,
    estado: u.estado,
    fecha_creacion: u.fecha_creacion,
  };
}

// GET /api/usuarios
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, r.nombre_rol FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    ORDER BY u.id_usuario DESC
  `).all();
  res.json(rows.map(userView));
});

// GET /api/usuarios/roles
router.get('/roles/all', (req, res) => {
  res.json(db.prepare('SELECT * FROM roles').all());
});

// POST /api/usuarios
router.post('/', (req, res) => {
  const { usuario, nombre, apellidos, correo, celular, password, id_rol, estado } = req.body;
  if (!usuario || !nombre || !apellidos || !password || !id_rol) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben completarse' });
  }
  const exists = db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario);
  if (exists) return res.status(409).json({ error: 'El usuario ya existe' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare(`
    INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, password_hash, id_rol, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(usuario, nombre, apellidos, correo || null, celular || null, hash, id_rol, estado ? 1 : 0);

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'INSERT', 'usuarios', ?)`)
    .run(req.user.id_usuario, `Creación de usuario ${usuario}`);

  res.status(201).json({ id_usuario: info.lastInsertRowid });
});

// PUT /api/usuarios/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { usuario, nombre, apellidos, correo, celular, password, id_rol, estado } = req.body;
  const current = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });

  const hash = password ? bcrypt.hashSync(password, 10) : current.password_hash;

  db.prepare(`
    UPDATE usuarios SET usuario=?, nombre=?, apellidos=?, correo=?, celular=?, password_hash=?, id_rol=?, estado=?
    WHERE id_usuario=?
  `).run(usuario, nombre, apellidos, correo || null, celular || null, hash, id_rol, estado ? 1 : 0, id);

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'usuarios', ?)`)
    .run(req.user.id_usuario, `Actualización de usuario id ${id}`);

  res.json({ message: 'Usuario actualizado' });
});

// DELETE /api/usuarios/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id_usuario) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
  }
  db.prepare('DELETE FROM usuarios WHERE id_usuario = ?').run(id);
  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'DELETE', 'usuarios', ?)`)
    .run(req.user.id_usuario, `Eliminación de usuario id ${id}`);
  res.json({ message: 'Usuario eliminado' });
});

module.exports = router;
