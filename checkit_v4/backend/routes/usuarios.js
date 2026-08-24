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
  
  // Validar usuario
const existeUsuario = db.prepare(
  'SELECT 1 FROM usuarios WHERE usuario = ?'
).get(usuario);

if (existeUsuario) {
  return res.status(409).json({
    error: 'Ya existe un usuario con ese nombre de usuario.'
  });
}

// Validar correo
if (correo) {
  const existeCorreo = db.prepare(
    'SELECT 1 FROM usuarios WHERE correo = ?'
  ).get(correo);

  if (existeCorreo) {
    return res.status(409).json({
      error: 'Ya existe un usuario con ese correo.'
    });
  }
}

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

  // Verificar usuario repetido
const usuarioExiste = db.prepare(`
SELECT id_usuario
FROM usuarios
WHERE usuario = ?
AND id_usuario <> ?
`).get(usuario, id);

if (usuarioExiste) {
    return res.status(409).json({
        error: 'Ese nombre de usuario ya existe.'
    });
}

// Verificar correo repetido
if (correo) {

    const correoExiste = db.prepare(`
    SELECT id_usuario
    FROM usuarios
    WHERE correo = ?
    AND id_usuario <> ?
    `).get(correo, id);

    if (correoExiste) {
        return res.status(409).json({
            error: 'Ese correo ya está registrado.'
        });
    }

}

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

    const auditorias = db.prepare(`
SELECT COUNT(*) total
FROM auditoria
WHERE id_usuario = ?
`).get(id);

if (auditorias.total > 0) {

    return res.status(409).json({
        error: 'No se puede eliminar porque este usuario posee registros de auditoría.'
    });

}

    if (Number(id) === req.user.id_usuario) {
        return res.status(400).json({
            error: 'No puedes eliminar tu propio usuario.'
        });
    }

    // Verificar si tiene registros
    const movimientos = db.prepare(`
        SELECT COUNT(*) total
        FROM registros
        WHERE id_usuario = ?
    `).get(id);
    if (movimientos.total > 0) {
        return res.status(409).json({
            error: 'No se puede eliminar este usuario porque tiene movimientos registrados.'
        });
    }

    db.prepare(`
        DELETE FROM usuarios
        WHERE id_usuario = ?
    `).run(id);

    db.prepare(`
        INSERT INTO auditoria
        (id_usuario,accion,tabla_afectada,descripcion)
        VALUES (?, 'DELETE','usuarios',?)
    `).run(
        req.user.id_usuario,
        `Eliminación de usuario id ${id}`
    );

    res.json({
        message:'Usuario eliminado correctamente.'
    });

});

module.exports = router;
