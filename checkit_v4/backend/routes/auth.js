const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, authRequired } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      id_usuario: user.id_usuario,
      usuario: user.usuario,
      nombre: user.nombre,
      apellidos: user.apellidos,
      rol: user.nombre_rol,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function userView(user) {
  return {
    id_usuario: user.id_usuario,
    usuario: user.usuario,
    nombre: user.nombre,
    apellidos: user.apellidos,
    correo: user.correo,
    celular: user.celular,
    rol: user.nombre_rol,
    estado: user.estado,
  };
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

  const user = db.prepare(`
    SELECT u.*, r.nombre_rol FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.usuario = ?
  `).get(usuario);

  if (!user || !user.estado) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'LOGIN', 'usuarios', ?)`)
    .run(user.id_usuario, `Inicio de sesión de ${user.usuario}`);

  const token = signToken(user);
  res.json({ token, user: userView(user) });
});

// POST /api/auth/register — autoregistro (siempre como Operador de Sistema)
router.post('/register', (req, res) => {
  const { nombre, apellidos, id_tipo_documento, numero_documento, celular, correo, usuario, password } = req.body;
  if (!nombre || !apellidos || !numero_documento || !correo || !usuario || !password) {
    return res.status(400).json({ error: 'Por favor completa todos los campos' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
  }

  const existingUser = db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario);
  if (existingUser) return res.status(409).json({ error: 'El usuario ya existe' });

  const existingCorreo = db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo);
  if (existingCorreo) return res.status(409).json({ error: 'El correo ya está registrado' });

  const operadorRol = db.prepare("SELECT id_rol FROM roles WHERE nombre_rol = 'Operador de Sistema'").get();
  const hash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, password_hash, id_rol, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(usuario, nombre, apellidos, correo, celular || null, hash, operadorRol.id_rol);

  // Registrar también como persona si se envió tipo/numero de documento
  if (id_tipo_documento && numero_documento) {
    const yaPersona = db.prepare('SELECT 1 FROM personas WHERE numero_documento = ?').get(numero_documento);
    if (!yaPersona) {
      db.prepare(`
        INSERT INTO personas (id_tipo_documento, numero_documento, nombres, apellidos, correo, celular)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(id_tipo_documento, numero_documento, nombre, apellidos, correo, celular || null);
    }
  }

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'INSERT', 'usuarios', ?)`)
    .run(info.lastInsertRowid, `Registro de nuevo usuario ${usuario}`);

  res.status(201).json({ message: 'Usuario registrado exitosamente' });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
