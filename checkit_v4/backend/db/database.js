const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'checkit.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// ── 1. Crear esquema ──────────────────────────────────────────
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// ── 2. Semillas (solo si las tablas están vacías) ─────────────
function seed() {
  const countRoles = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
  if (countRoles === 0) {
    const insertRol = db.prepare('INSERT INTO roles (nombre_rol) VALUES (?)');
    insertRol.run('Administrador');
    insertRol.run('Operador de Sistema');
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
    const adminRolId = db.prepare("SELECT id_rol FROM roles WHERE nombre_rol = 'Administrador'").get().id_rol;
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, password_hash, id_rol, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run('admin', 'Admin', 'CheckIT', 'admin@checkit.co', '3000000000', hash, adminRolId);
    console.log('✔ Usuario administrador creado -> usuario: admin | contraseña: admin123');
  }
}

seed();

module.exports = db;
