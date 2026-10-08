const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { authRequired, requireRole, ROL_SUPER, ROL_ADMIN, ROL_OPERADOR } = require('../middleware/auth');

const router = express.Router();
// Super Administrador y Administrador pueden entrar al módulo; la jerarquía
// de qué rol puede crear a quién se valida más abajo en cada operación.
router.use(authRequired, requireRole(ROL_SUPER, ROL_ADMIN));

const CORREO_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function userView(u) {
  return {
    id_usuario: u.id_usuario,
    usuario: u.usuario,
    nombre: u.nombre,
    apellidos: u.apellidos,
    correo: u.correo,
    celular: u.celular,
    id_tipo_documento: u.id_tipo_documento,
    tipo_documento: u.nombre_documento || null,
    numero_documento: u.numero_documento,
    id_rol: u.id_rol,
    rol: u.nombre_rol,
    estado: u.estado,
    fecha_creacion: u.fecha_creacion,
  };
}

// Roles que el usuario autenticado tiene permitido asignar/gestionar:
// - Super Administrador -> puede crear/editar Administradores y Operadores.
// - Administrador -> solo puede crear/editar Operadores de Sistema.
function rolesGestionables(rolActual) {
  if (rolActual === ROL_SUPER) return [ROL_ADMIN, ROL_OPERADOR];
  if (rolActual === ROL_ADMIN) return [ROL_OPERADOR];
  return [];
}

function nombreRolPorId(id_rol) {
  return db.prepare('SELECT nombre_rol FROM roles WHERE id_rol = ?').get(id_rol)?.nombre_rol;
}

// GET /api/usuarios
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT u.*, r.nombre_rol, td.nombre_documento FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    LEFT JOIN tipos_documento td ON td.id_tipo_documento = u.id_tipo_documento
    WHERE u.usuario <> 'sistema'
    ORDER BY u.id_usuario DESC
  `).all();
  res.json(rows.map(userView));
});

// GET /api/usuarios/roles/all — solo devuelve los roles que el usuario
// autenticado tiene permiso de asignar, para poblar el formulario.
router.get('/roles/all', (req, res) => {
  const permitidos = rolesGestionables(req.user.rol);
  const todos = db.prepare('SELECT * FROM roles').all();
  res.json(todos.filter((r) => permitidos.includes(r.nombre_rol)));
});

// POST /api/usuarios
router.post('/', (req, res) => {
  const { usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password, id_rol } = req.body;

  if (!usuario || !nombre || !apellidos || !password || !id_rol || !id_tipo_documento || !numero_documento) {
    return res.status(400).json({ error: 'Todos los campos obligatorios deben completarse (incluyendo tipo y número de documento)' });
  }

  // El correo es obligatorio: es el canal del tercer factor de seguridad
  // (PIN de acceso) y de recuperación de contraseña, así que debe ser real.
  if (!correo || !CORREO_REGEX.test(correo)) {
    return res.status(400).json({ error: 'El correo es obligatorio y debe ser una dirección real: a esa cuenta llegará el PIN de inicio de sesión.' });
  }

  const rolSolicitado = nombreRolPorId(id_rol);
  if (!rolSolicitado || !rolesGestionables(req.user.rol).includes(rolSolicitado)) {
    return res.status(403).json({ error: `Tu rol (${req.user.rol}) no tiene permiso para crear usuarios con ese rol.` });
  }

  // Validar usuario
  const existeUsuario = db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(usuario);
  if (existeUsuario) {
    return res.status(409).json({ error: 'El usuario ya existe.' });
  }

  // Validar correo
  const existeCorreo = db.prepare('SELECT 1 FROM usuarios WHERE correo = ?').get(correo);
  if (existeCorreo) {
    return res.status(409).json({ error: 'El correo ya está registrado.' });
  }

  // Validar número de documento
  const existeDocumento = db.prepare('SELECT 1 FROM usuarios WHERE numero_documento = ?').get(numero_documento);
  if (existeDocumento) {
    return res.status(409).json({ error: 'Ese número de documento ya está registrado.' });
  }

  const hash = bcrypt.hashSync(password, 10);

  // NC-7: la creación del usuario y su registro de auditoría ahora se
  // confirman como una sola operación atómica. Si algo falla a mitad de
  // camino (ej. un error de disco), SQLite revierte todo — nunca queda un
  // usuario creado sin su rastro de auditoría, ni viceversa.
  const crearUsuario = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password_hash, id_rol, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(usuario, nombre, apellidos, correo, celular || null, id_tipo_documento, numero_documento, hash, id_rol);

    db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'INSERT', 'usuarios', ?)`)
      .run(req.user.id_usuario, `Creación de usuario ${usuario} (rol ${rolSolicitado}) por ${req.user.usuario}`);

    return info.lastInsertRowid;
  });

  const id_usuario = crearUsuario();
  res.status(201).json({ id_usuario });
});

// PUT /api/usuarios/:id
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password, id_rol } = req.body;
  const current = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(id);
  if (!current) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (current.usuario === 'sistema') return res.status(403).json({ error: 'Esta es una cuenta interna del sistema y no se puede editar.' });

  if (!id_tipo_documento || !numero_documento) {
    return res.status(400).json({ error: 'El tipo y número de documento son obligatorios' });
  }

  if (!correo || !CORREO_REGEX.test(correo)) {
    return res.status(400).json({ error: 'El correo es obligatorio y debe ser una dirección real: a esa cuenta llegará el PIN de inicio de sesión.' });
  }

  const rolActualDelEditado = nombreRolPorId(current.id_rol);
  const rolNuevoSolicitado = nombreRolPorId(id_rol);
  const gestionables = rolesGestionables(req.user.rol);

  // Un Administrador no puede tocar cuentas de rol superior al suyo,
  // ni reasignar a un rol que no le esté permitido gestionar.
  if (req.user.rol !== ROL_SUPER) {
    if (!gestionables.includes(rolActualDelEditado)) {
      return res.status(403).json({ error: 'No tienes permiso para editar este usuario.' });
    }
    if (!rolNuevoSolicitado || !gestionables.includes(rolNuevoSolicitado)) {
      return res.status(403).json({ error: 'No tienes permiso para asignar ese rol.' });
    }
  }

  const hash = password ? bcrypt.hashSync(password, 10) : current.password_hash;

  // El estado (activo/inactivo) solo lo puede cambiar el Super Administrador,
  // y únicamente a través de PATCH /usuarios/:id/estado. Una edición normal
  // (venga de quien venga) nunca lo toca, para que "inactivar" sea siempre
  // una acción explícita y no un efecto secundario de editar otros campos.
  const estadoFinal = current.estado;

  // Verificar usuario repetido
  const usuarioExiste = db.prepare(`
    SELECT id_usuario FROM usuarios WHERE usuario = ? AND id_usuario <> ?
  `).get(usuario, id);
  if (usuarioExiste) {
    return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
  }

  // Verificar correo repetido
  const correoExiste = db.prepare(`
    SELECT id_usuario FROM usuarios WHERE correo = ? AND id_usuario <> ?
  `).get(correo, id);
  if (correoExiste) {
    return res.status(409).json({ error: 'Ese correo ya está registrado.' });
  }

  // Verificar documento repetido
  const documentoExiste = db.prepare(`
    SELECT id_usuario FROM usuarios WHERE numero_documento = ? AND id_usuario <> ?
  `).get(numero_documento, id);
  if (documentoExiste) {
    return res.status(409).json({ error: 'Ese número de documento ya está registrado.' });
  }

  // NC-7: mismo principio — actualizar el usuario y dejar la auditoría
  // quedan atados a una sola transacción.
  const actualizarUsuario = db.transaction(() => {
    db.prepare(`
      UPDATE usuarios SET usuario=?, nombre=?, apellidos=?, correo=?, celular=?, id_tipo_documento=?, numero_documento=?, password_hash=?, id_rol=?, estado=?
      WHERE id_usuario=?
    `).run(usuario, nombre, apellidos, correo, celular || null, id_tipo_documento, numero_documento, hash, id_rol, estadoFinal, id);

    db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'usuarios', ?)`)
      .run(req.user.id_usuario, `Actualización de usuario id ${id}`);
  });

  actualizarUsuario();
  res.json({ message: 'Usuario actualizado' });
});

// DELETE /api/usuarios/:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const objetivo = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(id);
  if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (objetivo.usuario === 'sistema') return res.status(403).json({ error: 'Esta es una cuenta interna del sistema y no se puede eliminar.' });

  if (req.user.rol !== ROL_SUPER) {
    const rolDelObjetivo = nombreRolPorId(objetivo.id_rol);
    if (!rolesGestionables(req.user.rol).includes(rolDelObjetivo)) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar este usuario.' });
    }
  }

  const auditorias = db.prepare(`SELECT COUNT(*) total FROM auditoria WHERE id_usuario = ?`).get(id);
  if (auditorias.total > 0) {
    return res.status(409).json({ error: 'No se puede eliminar porque este usuario posee registros de auditoría.' });
  }

  if (Number(id) === req.user.id_usuario) {
    return res.status(400).json({ error: 'No puedes eliminar tu propio usuario.' });
  }

  // Verificar si tiene registros
  const movimientos = db.prepare(`SELECT COUNT(*) total FROM registros WHERE id_usuario = ?`).get(id);
  if (movimientos.total > 0) {
    return res.status(409).json({ error: 'No se puede eliminar este usuario porque tiene movimientos registrados.' });
  }

  // NC-7: eliminar y auditar, atado a una sola transacción.
  const eliminarUsuario = db.transaction(() => {
    db.prepare(`DELETE FROM usuarios WHERE id_usuario = ?`).run(id);
    db.prepare(`
      INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion)
      VALUES (?, 'DELETE', 'usuarios', ?)
    `).run(req.user.id_usuario, `Eliminación de usuario id ${id}`);
  });

  eliminarUsuario();
  res.json({ message: 'Usuario eliminado correctamente.' });
});

// PATCH /api/usuarios/:id/estado — activar/inactivar (solo Super Administrador).
// Pensado para cuando la persona se retiró/dejó de trabajar: no borra nada
// de su historial (auditoría, movimientos que registró), solo bloquea que
// pueda volver a iniciar sesión.
router.patch('/:id/estado', requireRole(ROL_SUPER), (req, res) => {
  const { id } = req.params;
  const { estado } = req.body;

  const objetivo = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(id);
  if (!objetivo) return res.status(404).json({ error: 'Usuario no encontrado' });
  if (objetivo.usuario === 'sistema') return res.status(403).json({ error: 'Esta es una cuenta interna del sistema y no se puede modificar.' });
  if (Number(id) === req.user.id_usuario) return res.status(400).json({ error: 'No puedes inactivar tu propia cuenta.' });

  // NC-7: cambiar el estado y auditar, atado a una sola transacción.
  const cambiarEstado = db.transaction(() => {
    db.prepare('UPDATE usuarios SET estado = ? WHERE id_usuario = ?').run(estado ? 1 : 0, id);
    db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'usuarios', ?)`)
      .run(req.user.id_usuario, `Usuario ${objetivo.usuario} marcado como ${estado ? 'activo' : 'inactivo'} por ${req.user.usuario}`);
  });

  cambiarEstado();
  res.json({ message: `Usuario ${estado ? 'activado' : 'inactivado'} correctamente` });
});

module.exports = router;
