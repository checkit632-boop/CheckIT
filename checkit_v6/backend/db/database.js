const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'checkit.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── 1. Crear esquema ──────────────────────────────────────────
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── 2. Migraciones ligeras (para bases de datos creadas con v5) ─
function columnExists(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function migrate() {
  if (!columnExists('equipos', 'observaciones')) {
    db.exec('ALTER TABLE equipos ADD COLUMN observaciones TEXT');
    // Traemos la última observación registrada en movimientos históricos,
    // para no perder la información ya capturada en v5.
    try {
      const equiposSinObs = db.prepare('SELECT id_equipo FROM equipos WHERE observaciones IS NULL').all();
      const ultimaObs = db.prepare(`
        SELECT observaciones FROM registros
        WHERE id_equipo = ? AND observaciones IS NOT NULL AND observaciones <> ''
        ORDER BY id_registro DESC LIMIT 1
      `);
      const update = db.prepare('UPDATE equipos SET observaciones = ? WHERE id_equipo = ?');
      equiposSinObs.forEach(({ id_equipo }) => {
        const row = ultimaObs.get(id_equipo);
        if (row?.observaciones) update.run(row.observaciones, id_equipo);
      });
    } catch (err) {
      console.warn('No se pudo migrar observaciones históricas:', err.message);
    }
  }

  if (!columnExists('usuarios', 'id_tipo_documento')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN id_tipo_documento INTEGER REFERENCES tipos_documento(id_tipo_documento)');
  }
  if (!columnExists('usuarios', 'numero_documento')) {
    db.exec('ALTER TABLE usuarios ADD COLUMN numero_documento TEXT');
  }
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_numero_documento
    ON usuarios(numero_documento) WHERE numero_documento IS NOT NULL
  `);

  if (!columnExists('equipos', 'activo')) {
    db.exec('ALTER TABLE equipos ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
  }

  // Reemplaza el correo de ejemplo de la cuenta semilla por el correo real
  // del Super Administrador, para que el tercer factor (PIN) le llegue de
  // verdad. Solo toca esa cuenta puntual, nunca otras que el usuario ya
  // haya editado.
  try {
    db.prepare(`
      UPDATE usuarios SET correo = 'checkit632@gmail.com'
      WHERE usuario = 'admin' AND correo = 'admin@checkit.co'
    `).run();
  } catch (err) {
    console.warn('No se pudo actualizar el correo semilla del Super Administrador:', err.message);
  }
}

migrate();

// ── 3. Semillas (solo si las tablas están vacías) ─────────────
function seed() {
  const countRoles = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
  if (countRoles === 0) {
    const insertRol = db.prepare('INSERT INTO roles (nombre_rol) VALUES (?)');
    insertRol.run('Super Administrador');
    insertRol.run('Administrador');
    insertRol.run('Operador de Sistema');
  } else {
    // Si la BD viene de v5 (solo Administrador / Operador de Sistema),
    // agregamos el rol Super Administrador sin tocar lo existente.
    const existeSuper = db.prepare("SELECT 1 FROM roles WHERE nombre_rol = 'Super Administrador'").get();
    if (!existeSuper) {
      db.prepare('INSERT INTO roles (nombre_rol) VALUES (?)').run('Super Administrador');
    }
  }

  const countDoc = db.prepare('SELECT COUNT(*) c FROM tipos_documento').get().c;
  if (countDoc === 0) {
    const insertDoc = db.prepare('INSERT INTO tipos_documento (nombre_documento) VALUES (?)');
    ['Cédula de ciudadanía', 'Tarjeta de identidad', 'Cédula extranjera', 'Pasaporte'].forEach(d => insertDoc.run(d));
  }

  const countEstados = db.prepare('SELECT COUNT(*) c FROM estados').get().c;
  if (countEstados === 0) {
    const insertEstado = db.prepare('INSERT INTO estados (nombre_estado) VALUES (?)');
    ['Bueno', 'Regular', 'Malo'].forEach(e => insertEstado.run(e));
  }

  const countMov = db.prepare('SELECT COUNT(*) c FROM tipos_movimiento').get().c;
  if (countMov === 0) {
    const insertMov = db.prepare('INSERT INTO tipos_movimiento (nombre_movimiento) VALUES (?)');
    ['Entrada', 'Salida'].forEach(m => insertMov.run(m));
  }

  const countMarcas = db.prepare('SELECT COUNT(*) c FROM marcas').get().c;
  if (countMarcas === 0) {
    const insertMarca = db.prepare('INSERT INTO marcas (nombre_marca) VALUES (?)');
    ['HP', 'Dell', 'Lenovo', 'Asus', 'Acer', 'Apple', 'Samsung', 'MSI', 'Huawei', 'Xiaomi', 'Alienware', 'Toshiba']
      .forEach(m => insertMarca.run(m));
  }

  const countUsers = db.prepare('SELECT COUNT(*) c FROM usuarios').get().c;
  if (countUsers === 0) {
    const superRolId = db.prepare("SELECT id_rol FROM roles WHERE nombre_rol = 'Super Administrador'").get().id_rol;
    const cedulaId = db.prepare("SELECT id_tipo_documento FROM tipos_documento WHERE nombre_documento = 'Cédula de ciudadanía'").get()?.id_tipo_documento;
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password_hash, id_rol, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run('admin', 'Admin', 'CheckIT', 'checkit632@gmail.com', '3000000000', cedulaId || null, '1000000000', hash, superRolId);
    console.log('✔ Usuario Super Administrador creado -> usuario: admin | contraseña: admin123 | correo: checkit632@gmail.com');
  }
}

seed();

// ── 4. Usuario interno "sistema" ──────────────────────────────
// Se usa como autor de los cierres automáticos de equipos al reinicio
// operativo (11:59 p.m.). Cuenta bloqueada (estado = 0): nunca puede
// iniciar sesión, solo existe para que quede constancia en la auditoría
// de que ese movimiento no lo hizo una persona sino el sistema.
function seedSistemaUser() {
  const existe = db.prepare("SELECT 1 FROM usuarios WHERE usuario = 'sistema'").get();
  if (existe) return;

  const operadorRolId = db.prepare("SELECT id_rol FROM roles WHERE nombre_rol = 'Operador de Sistema'").get()?.id_rol;
  if (!operadorRolId) return; // por si acaso los roles aún no existen

  const hashInutilizable = bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10);
  db.prepare(`
    INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password_hash, id_rol, estado)
    VALUES ('sistema', 'Sistema', 'CheckIT', 'sistema@checkit.local', NULL, NULL, NULL, ?, ?, 0)
  `).run(hashInutilizable, operadorRolId);
  console.log('✔ Usuario interno "sistema" creado (bloqueado) — se usa para los cierres automáticos de equipos.');
}

seedSistemaUser();

module.exports = db;
