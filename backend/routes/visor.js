// Visor de la base de datos (v7.0). Solo para el Super Administrador, desde
// el módulo de Auditoría.
//
// Acceso en dos pasos, igual que el inicio de sesión: 1) la contraseña de su
// cuenta y 2) un código de 6 dígitos enviado a su correo (tipo visor_bd).
// Al validar, recibe un permiso temporal de 15 minutos (X-Visor-Token) que
// solo sirve para su propia cuenta y solo para estas rutas.
//
// Es de SOLO LECTURA: las consultas usan una conexión abierta con
// { readonly: true }, así que aunque hubiera un error no podría modificar la
// base. Las contraseñas y los códigos se muestran ocultos. Cada acceso y cada
// intento fallido quedan en la auditoría.
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
const db = require('../db/database');
const DB_PATH = require('../db/ruta');
const asyncHandler = require('../utils/asyncHandler');
const {
  CODIGO_EXPIRA_MINUTOS,
  enviarCodigoSeguro,
  generarCodigo,
  guardarCodigo,
  validarCodigo,
} = require('../utils/codigos');
const { authRequired, requireRole, JWT_SECRET, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole(ROL_SUPER));

const MINUTOS_PERMISO = 15;
const POR_PAGINA_DEFECTO = 50;
const POR_PAGINA_MAXIMO = 200;
const OCULTAS = { usuarios: ['password_hash'], codigos_verificacion: ['codigo_hash'] };

const auditar = (id, accion, texto) =>
  db
    .prepare(
      `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, ?, 'visor_bd', ?)`
    )
    .run(id, accion, texto);

// Pocos intentos por cuenta: protege la contraseña y el correo.
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `visor|${req.user.id_usuario}`,
  handler: (req, res) =>
    res
      .status(429)
      .json({ error: 'Demasiados intentos de acceso al visor. Intenta de nuevo en 15 minutos.' }),
});

// POST /api/visor/solicitar { password } — paso 1: contraseña; envía el código.
router.post(
  '/solicitar',
  limite,
  asyncHandler((req, res) => {
    const cuenta = db
      .prepare(
        'SELECT id_usuario, usuario, nombre, correo, password_hash FROM usuarios WHERE id_usuario = ?'
      )
      .get(req.user.id_usuario);
    if (
      !req.body?.password ||
      !bcrypt.compareSync(String(req.body.password), cuenta.password_hash)
    ) {
      auditar(
        cuenta.id_usuario,
        'LOGIN_FALLIDO',
        `Contraseña incorrecta al intentar abrir el visor de la base de datos (${cuenta.usuario})`
      );
      // 400 y no 401: la interfaz cierra la sesión ante un 401.
      return res.status(400).json({ error: 'Contraseña incorrecta.' });
    }
    const codigo = generarCodigo();
    guardarCodigo(cuenta.id_usuario, 'visor_bd', codigo);
    enviarCodigoSeguro({
      correo: cuenta.correo,
      nombre: cuenta.nombre,
      codigo,
      asunto: 'Código para abrir el visor de la base de datos de CheckIT',
      intro:
        'Se solicitó abrir el visor de la base de datos desde Auditoría. Si fuiste tú, usa este código:',
      minutos: CODIGO_EXPIRA_MINUTOS,
    });
    res.json({ mensaje: 'Enviamos un código de 6 dígitos a tu correo.' });
  })
);

// POST /api/visor/verificar { codigo } — paso 2: código; entrega el permiso.
router.post(
  '/verificar',
  limite,
  asyncHandler((req, res) => {
    if (!req.body?.codigo) return res.status(400).json({ error: 'Escribe el código.' });
    const resultado = validarCodigo(req.user.id_usuario, 'visor_bd', req.body.codigo);
    if (!resultado.ok) {
      auditar(
        req.user.id_usuario,
        'LOGIN_FALLIDO',
        `Código incorrecto o vencido al abrir el visor de la base de datos (${req.user.usuario})`
      );
      return res.status(resultado.status || 400).json({ error: resultado.error });
    }
    const token = jwt.sign({ id_usuario: req.user.id_usuario, alcance: 'visor_bd' }, JWT_SECRET, {
      expiresIn: `${MINUTOS_PERMISO}m`,
    });
    auditar(
      req.user.id_usuario,
      'SISTEMA',
      `Acceso al visor de la base de datos, solo lectura, por ${MINUTOS_PERMISO} minutos (${req.user.usuario})`
    );
    res.json({ token, minutos: MINUTOS_PERMISO });
  })
);

// Exige el permiso temporal del paso 2, emitido para esta misma cuenta.
function permisoVisor(req, res, next) {
  try {
    const p = jwt.verify(String(req.headers['x-visor-token'] || ''), JWT_SECRET);
    if (p.alcance === 'visor_bd' && p.id_usuario === req.user.id_usuario) return next();
  } catch {
    // vencido o alterado
  }
  return res
    .status(403)
    .json({
      error: 'El acceso al visor venció. Vuelve a ingresar la contraseña y el código.',
      visorVencido: true,
    });
}

function conLectura(fn) {
  const lectura = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    return fn(lectura);
  } finally {
    lectura.close();
  }
}

const nombresTablas = (cx) =>
  cx
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    .pluck()
    .all();

// GET /api/visor/tablas — tablas con su cantidad de filas.
router.get(
  '/tablas',
  permisoVisor,
  asyncHandler((req, res) => {
    res.json(
      conLectura((cx) =>
        nombresTablas(cx).map((nombre) => ({
          nombre,
          filas: cx.prepare(`SELECT COUNT(*) FROM "${nombre}"`).pluck().get(),
        }))
      )
    );
  })
);

// GET /api/visor/tablas/:nombre?pagina=N&por_pagina=M — filas de una tabla,
// las más recientes primero.
router.get(
  '/tablas/:nombre',
  permisoVisor,
  asyncHandler((req, res) => {
    const resultado = conLectura((cx) => {
      // El nombre solo se acepta si es una tabla real (lista blanca), porque
      // los nombres de tabla no pueden ir como parámetro (?) en SQL.
      const nombre = nombresTablas(cx).find((t) => t === req.params.nombre);
      if (!nombre) return null;
      const columnas = cx
        .prepare(`PRAGMA table_info("${nombre}")`)
        .all()
        .map((c) => ({ nombre: c.name, tipo: c.type, llave: c.pk > 0 }));
      const pagina = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
      const pedidos = Number.parseInt(req.query.por_pagina, 10);
      const porPagina =
        Number.isInteger(pedidos) && pedidos > 0
          ? Math.min(pedidos, POR_PAGINA_MAXIMO)
          : POR_PAGINA_DEFECTO;
      const total = cx.prepare(`SELECT COUNT(*) FROM "${nombre}"`).pluck().get();
      const ocultas = OCULTAS[nombre] || [];
      const filas = cx
        .prepare(`SELECT * FROM "${nombre}" ORDER BY rowid DESC LIMIT ? OFFSET ?`)
        .all(porPagina, (pagina - 1) * porPagina)
        .map((f) => {
          for (const c of ocultas) if (c in f) f[c] = '•••••• (oculto)';
          return f;
        });
      return { tabla: nombre, columnas, filas, total, pagina, por_pagina: porPagina };
    });
    if (!resultado) return res.status(404).json({ error: 'La tabla no existe.' });
    res.json(resultado);
  })
);

module.exports = router;
