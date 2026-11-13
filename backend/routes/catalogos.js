const express = require('express');
const db = require('../db/database');
const { authRequired } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired);

router.get('/marcas', (req, res) =>
  res.json(db.prepare('SELECT * FROM marcas ORDER BY nombre_marca').all())
);
// POST /api/catalogos/marcas { nombre_marca } — opción "Otra" del registro de
// equipos (v7.0): agrega una marca que no está en la lista. Todos los roles
// que registran equipos pueden usarla. Si ya existe con otra combinación de
// mayúsculas o espacios ("dell", " DELL "), devuelve la existente en vez de
// duplicarla. Queda en la auditoría.
router.post('/marcas', (req, res) => {
  const nombre = String(req.body?.nombre_marca ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (nombre.length < 2 || nombre.length > 40) {
    return res
      .status(400)
      .json({ error: 'Escribe el nombre de la marca (entre 2 y 40 caracteres).' });
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} .&+-]*$/u.test(nombre)) {
    return res
      .status(400)
      .json({
        error: 'El nombre de la marca solo puede tener letras, números, espacios y . & + -',
      });
  }
  // La comparación se hace aquí y no con LOWER() de SQLite, que no reconoce
  // tildes ni la ñ como la misma letra en mayúscula y minúscula.
  const clave = nombre.toLocaleLowerCase('es');
  const existente = db
    .prepare('SELECT * FROM marcas')
    .all()
    .find((m) => m.nombre_marca.toLocaleLowerCase('es') === clave);
  if (existente) return res.json({ ...existente, existia: true });

  const marca = db.transaction(() => {
    const info = db.prepare('INSERT INTO marcas (nombre_marca) VALUES (?)').run(nombre);
    db.prepare(
      `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'INSERT', 'marcas', ?)`
    ).run(
      req.user.id_usuario,
      `Marca "${nombre}" agregada por ${req.user.usuario} desde el registro de equipos`
    );
    return { id_marca: info.lastInsertRowid, nombre_marca: nombre };
  })();
  res.status(201).json(marca);
});

router.get('/estados', (req, res) => res.json(db.prepare('SELECT * FROM estados').all()));
router.get('/tipos-documento', (req, res) =>
  res.json(db.prepare('SELECT * FROM tipos_documento').all())
);
router.get('/tipos-movimiento', (req, res) =>
  res.json(db.prepare('SELECT * FROM tipos_movimiento').all())
);
router.get('/accesorios', (req, res) =>
  res.json(db.prepare('SELECT * FROM accesorios ORDER BY id_accesorio').all())
);

module.exports = router;
