// Autenticación de CheckIT: inicio de sesión en dos pasos (usuario +
// contraseña, y luego un código de 6 dígitos enviado al correo), bloqueo por
// intentos fallidos y recuperación de contraseña por código. Junto con
// /api/health es lo único público de la API: todo lo demás exige el JWT
// que se emite aquí.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const asyncHandler = require('../utils/asyncHandler');
const { validarPassword, MENSAJE_PASSWORD } = require('../utils/validarPassword');
const { JWT_SECRET, authRequired } = require('../middleware/auth');
const { enviarCodigo } = require('../utils/mailer');

const router = express.Router();

const MAX_INTENTOS = 5;
const BLOQUEO_MINUTOS = 3;
const CODIGO_EXPIRA_MINUTOS = 3;
const MAX_INTENTOS_CODIGO = 5;

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

// H-05: el envío del correo no se espera (la respuesta HTTP no depende de
// él), pero su promesa SIEMPRE debe tener un .catch(): un rechazo sin
// atender (p. ej. el servidor SMTP caído) puede terminar el proceso de Node.
function enviarCodigoSeguro(datos) {
  return enviarCodigo(datos).catch((err) => {
    console.error('[CheckIT] Fallo al enviar el código por correo:', err.message);
    return { enviado: false, simulado: true };
  });
}

function generarCodigo() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

function guardarCodigo(id_usuario, tipo, codigo) {
  const hash = bcrypt.hashSync(codigo, 8);
  const expira = new Date(Date.now() + CODIGO_EXPIRA_MINUTOS * 60000).toISOString();
  // Invalida cualquier código previo del mismo tipo que siga pendiente
  db.prepare(`UPDATE codigos_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = ? AND usado = 0`)
    .run(id_usuario, tipo);
  db.prepare(`
    INSERT INTO codigos_verificacion (id_usuario, codigo_hash, tipo, expira)
    VALUES (?, ?, ?, ?)
  `).run(id_usuario, hash, tipo, expira);
}

function validarCodigo(id_usuario, tipo, codigo) {
  const row = db.prepare(`
    SELECT * FROM codigos_verificacion
    WHERE id_usuario = ? AND tipo = ? AND usado = 0
    ORDER BY id_codigo DESC LIMIT 1
  `).get(id_usuario, tipo);

  if (!row) return { ok: false, error: 'No hay un código pendiente. Solicita uno nuevo.' };
  if (new Date(row.expira).getTime() < Date.now()) return { ok: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  if (!bcrypt.compareSync(String(codigo), row.codigo_hash)) {
    // O-02: el bloqueo de login_intentos no cubre este paso, así que cada
    // código cuenta sus propios fallos. Al llegar al máximo se invalida
    // aunque no haya vencido, y hay que pedir uno nuevo (que llega al correo).
    const intentos = row.intentos + 1;
    if (intentos >= MAX_INTENTOS_CODIGO) {
      db.prepare('UPDATE codigos_verificacion SET intentos = ?, usado = 1 WHERE id_codigo = ?').run(intentos, row.id_codigo);
      return { ok: false, status: 429, error: 'Demasiados intentos. Solicita un nuevo código.' };
    }
    db.prepare('UPDATE codigos_verificacion SET intentos = ? WHERE id_codigo = ?').run(intentos, row.id_codigo);
    const restantes = MAX_INTENTOS_CODIGO - intentos;
    return { ok: false, error: `Código incorrecto. Te queda${restantes === 1 ? '' : 'n'} ${restantes} intento${restantes === 1 ? '' : 's'}.` };
  }

  db.prepare('UPDATE codigos_verificacion SET usado = 1 WHERE id_codigo = ?').run(row.id_codigo);
  return { ok: true };
}

// ── Bloqueo por intentos fallidos ──────────────────────────────
function obtenerEstadoIntentos(usuario) {
  return db.prepare('SELECT * FROM login_intentos WHERE usuario = ?').get(usuario);
}

function estaBloqueado(usuario) {
  const row = obtenerEstadoIntentos(usuario);
  if (!row || !row.bloqueado_hasta) return null;
  const restante = new Date(row.bloqueado_hasta).getTime() - Date.now();
  return restante > 0 ? Math.ceil(restante / 1000) : null;
}

function registrarIntentoFallido(usuario) {
  const row = obtenerEstadoIntentos(usuario);
  const intentos = (row?.intentos || 0) + 1;

  if (intentos >= MAX_INTENTOS) {
    const bloqueadoHasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000).toISOString();
    db.prepare(`
      INSERT INTO login_intentos (usuario, intentos, bloqueado_hasta) VALUES (?, ?, ?)
      ON CONFLICT(usuario) DO UPDATE SET intentos = ?, bloqueado_hasta = ?
    `).run(usuario, intentos, bloqueadoHasta, intentos, bloqueadoHasta);
    return BLOQUEO_MINUTOS * 60;
  }

  db.prepare(`
    INSERT INTO login_intentos (usuario, intentos, bloqueado_hasta) VALUES (?, ?, NULL)
    ON CONFLICT(usuario) DO UPDATE SET intentos = ?, bloqueado_hasta = NULL
  `).run(usuario, intentos, intentos);
  return null;
}

function limpiarIntentos(usuario) {
  db.prepare('DELETE FROM login_intentos WHERE usuario = ?').run(usuario);
}

// POST /api/auth/login — primer y segundo factor (usuario + contraseña).
// Si el usuario tiene correo registrado, se envía un tercer factor
// (código de 6 dígitos) antes de emitir el token de sesión.
router.post('/login', asyncHandler((req, res) => {
  const { usuario, password } = req.body;
  if (!usuario || !password) return res.status(400).json({ error: 'Usuario y contraseña son obligatorios' });

  const segundosBloqueado = estaBloqueado(usuario);
  if (segundosBloqueado) {
    return res.status(423).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(segundosBloqueado / 60)} minuto(s).`,
      bloqueado: true,
      segundos_restantes: segundosBloqueado,
    });
  }

  const user = db.prepare(`
    SELECT u.*, r.nombre_rol FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.usuario = ?
  `).get(usuario);

  // Usuario inexistente, cuenta inactiva y contraseña errada reciben la misma
  // respuesta genérica y suman al mismo contador de bloqueo (que también se
  // lleva para nombres que no existen): así la API no revela qué cuentas son
  // reales ni cuáles están inactivas.
  const valido = user && user.estado && bcrypt.compareSync(password, user.password_hash);

  if (!valido) {
    const segundosNuevoBloqueo = registrarIntentoFallido(usuario);
    if (user) {
      db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'LOGIN_FALLIDO', 'usuarios', ?)`)
        .run(user.id_usuario, `Intento fallido de inicio de sesión de ${usuario}`);
    }
    if (segundosNuevoBloqueo) {
      return res.status(423).json({
        error: `Se alcanzó el máximo de ${MAX_INTENTOS} intentos. Cuenta bloqueada por ${BLOQUEO_MINUTOS} minutos.`,
        bloqueado: true,
        segundos_restantes: segundosNuevoBloqueo,
      });
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
  }

  limpiarIntentos(usuario);

  // Tercer factor de seguridad: código de 6 dígitos enviado al correo registrado.
  if (user.correo) {
    const codigo = generarCodigo();
    guardarCodigo(user.id_usuario, 'login_2fa', codigo);
    enviarCodigoSeguro({
      correo: user.correo,
      nombre: user.nombre,
      codigo,
      asunto: 'Tu código de verificación de CheckIT',
      intro: 'Estás iniciando sesión en CheckIT. Usa el siguiente código para completar el acceso:',
      minutos: CODIGO_EXPIRA_MINUTOS,
    });

    return res.json({
      requiereCodigo: true,
      id_usuario: user.id_usuario,
      mensaje: 'Ingresa el código de 6 dígitos enviado a tu correo para completar el inicio de sesión.',
    });
  }

  // Sin correo registrado no es posible aplicar el tercer factor; se
  // mantiene el acceso directo para no dejar cuentas sin forma de entrar.
  // Hoy solo pueden llegar aquí cuentas antiguas (anteriores a v6): crear o
  // editar un usuario exige un correo válido (routes/usuarios.js), así que
  // al editarlas quedan protegidas por el tercer factor. Queda registrado en
  // la auditoría que ese acceso fue sin tercer factor.
  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'LOGIN', 'usuarios', ?)`)
    .run(user.id_usuario, `Inicio de sesión de ${user.usuario} (sin correo, sin tercer factor)`);
  const token = signToken(user);
  res.json({ token, user: userView(user) });
}));

// POST /api/auth/login/codigo — valida el tercer factor y emite el token.
router.post('/login/codigo', asyncHandler((req, res) => {
  const { id_usuario, codigo } = req.body;
  if (!id_usuario || !codigo) return res.status(400).json({ error: 'Código requerido' });

  const user = db.prepare(`
    SELECT u.*, r.nombre_rol FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = ?
  `).get(id_usuario);
  if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

  const resultado = validarCodigo(id_usuario, 'login_2fa', codigo);
  if (!resultado.ok) return res.status(resultado.status || 401).json({ error: resultado.error });

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'LOGIN', 'usuarios', ?)`)
    .run(user.id_usuario, `Inicio de sesión de ${user.usuario} (verificado con tercer factor)`);

  const token = signToken(user);
  res.json({ token, user: userView(user) });
}));

// POST /api/auth/login/reenviar — reenvía el código del tercer factor.
router.post('/login/reenviar', asyncHandler((req, res) => {
  const { id_usuario } = req.body;
  const user = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(id_usuario);
  if (!user || !user.correo) return res.status(404).json({ error: 'No se puede reenviar el código' });

  const codigo = generarCodigo();
  guardarCodigo(user.id_usuario, 'login_2fa', codigo);
  enviarCodigoSeguro({
    correo: user.correo,
    nombre: user.nombre,
    codigo,
    asunto: 'Tu nuevo código de verificación de CheckIT',
    intro: 'Aquí tienes un nuevo código para completar tu inicio de sesión en CheckIT:',
    minutos: CODIGO_EXPIRA_MINUTOS,
  });

  res.json({ mensaje: 'Se envió un nuevo código a tu correo.' });
}));

// POST /api/auth/forgot-password — solicita el código de recuperación.
router.post('/forgot-password', asyncHandler((req, res) => {
  const { identificador } = req.body; // usuario o correo
  if (!identificador) return res.status(400).json({ error: 'Ingresa tu usuario o correo' });

  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? OR correo = ?').get(identificador, identificador);

  // Respuesta genérica siempre, para no revelar si el usuario existe o no.
  const respuestaGenerica = { mensaje: 'Si los datos son correctos, enviamos un código de verificación al correo registrado.' };

  if (!user || !user.correo) return res.json(respuestaGenerica);

  const codigo = generarCodigo();
  guardarCodigo(user.id_usuario, 'reset_password', codigo);
  enviarCodigoSeguro({
    correo: user.correo,
    nombre: user.nombre,
    codigo,
    asunto: 'Recupera tu contraseña de CheckIT',
    intro: 'Recibimos una solicitud para restablecer tu contraseña. Usa este código para continuar:',
    minutos: CODIGO_EXPIRA_MINUTOS,
  });

  res.json(respuestaGenerica);
}));

// POST /api/auth/reset-password — valida el código y define la nueva contraseña.
router.post('/reset-password', asyncHandler((req, res) => {
  const { identificador, codigo, password } = req.body;
  if (!identificador || !codigo || !password) return res.status(400).json({ error: 'Todos los campos son obligatorios' });
  if (!validarPassword(password)) return res.status(400).json({ error: MENSAJE_PASSWORD });

  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? OR correo = ?').get(identificador, identificador);
  if (!user) return res.status(400).json({ error: 'Código incorrecto o expirado' });

  const resultado = validarCodigo(user.id_usuario, 'reset_password', codigo);
  if (!resultado.ok) return res.status(resultado.status || 400).json({ error: resultado.error });

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE usuarios SET password_hash = ? WHERE id_usuario = ?').run(hash, user.id_usuario);
  limpiarIntentos(user.usuario);

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'UPDATE', 'usuarios', ?)`)
    .run(user.id_usuario, `Restablecimiento de contraseña de ${user.usuario}`);

  res.json({ mensaje: 'Contraseña actualizada correctamente. Ya puedes iniciar sesión.' });
}));

// GET /api/auth/me
router.get('/me', authRequired, asyncHandler((req, res) => {
  res.json({ user: req.user });
}));

module.exports = router;
