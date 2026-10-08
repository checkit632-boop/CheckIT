// Siembra de datos de prueba FICTICIOS para desarrollo y demostraciones.
//
// H-03: los datos de prueba se comparten con este script, nunca con el
// archivo binario de la base (checkit.db), que puede contener cuentas y
// hashes reales. Las contraseñas de estas cuentas se generan al azar en cada
// ejecución y se guardan solo en backend/.seed_credenciales.txt (ignorado
// por Git), igual que la contraseña inicial del Super Administrador (H-02).
//
// Uso:  cd backend  &&  npm run seed
// Es idempotente: si un registro de prueba ya existe, no se vuelve a crear.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

// Garantiza mayúscula, minúscula y dígito para cumplir la política de
// contraseñas (H-08) aunque el azar no los produzca.
function passwordAleatoria() {
  return `Ck${crypto.randomBytes(6).toString('base64url')}7`;
}

const idPorNombre = (tabla, columnaId, columnaNombre, valor) =>
  db.prepare(`SELECT ${columnaId} AS id FROM ${tabla} WHERE ${columnaNombre} = ?`).get(valor)?.id;

const cedula = idPorNombre('tipos_documento', 'id_tipo_documento', 'nombre_documento', 'Cédula de ciudadanía');
const rolAdmin = idPorNombre('roles', 'id_rol', 'nombre_rol', 'Administrador');
const rolOperador = idPorNombre('roles', 'id_rol', 'nombre_rol', 'Operador de Sistema');
const estadoBueno = idPorNombre('estados', 'id_estado', 'nombre_estado', 'Bueno');

const usuariosDemo = [
  { usuario: 'demo_admin', nombre: 'Ana', apellidos: 'Prueba', correo: 'demo_admin@checkit.local', documento: '9000000001', id_rol: rolAdmin },
  { usuario: 'demo_operador', nombre: 'Luis', apellidos: 'Prueba', correo: 'demo_operador@checkit.local', documento: '9000000002', id_rol: rolOperador },
];

const personasDemo = [
  { documento: '9100000001', nombres: 'Carla', apellidos: 'Ficticia', serial: 'DEMO-SN-0001', marca: 'Lenovo', modelo: 'ThinkPad E14' },
  { documento: '9100000002', nombres: 'Mario', apellidos: 'Inventado', serial: 'DEMO-SN-0002', marca: 'HP', modelo: 'ProBook 440' },
];

const credenciales = [];

const sembrar = db.transaction(() => {
  const insertUsuario = db.prepare(`
    INSERT INTO usuarios (usuario, nombre, apellidos, correo, celular, id_tipo_documento, numero_documento, password_hash, id_rol, estado)
    VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)
  `);
  for (const u of usuariosDemo) {
    if (db.prepare('SELECT 1 FROM usuarios WHERE usuario = ?').get(u.usuario)) continue;
    const password = passwordAleatoria();
    insertUsuario.run(u.usuario, u.nombre, u.apellidos, u.correo, cedula, u.documento, bcrypt.hashSync(password, 10), u.id_rol);
    credenciales.push(`${u.usuario}: ${password}`);
  }

  const insertPersona = db.prepare(`
    INSERT INTO personas (id_tipo_documento, numero_documento, nombres, apellidos) VALUES (?, ?, ?, ?)
  `);
  const insertEquipo = db.prepare(`
    INSERT INTO equipos (id_persona, id_marca, modelo, serial, codigo_qr, id_estado) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const p of personasDemo) {
    let idPersona = db.prepare('SELECT id_persona FROM personas WHERE numero_documento = ?').get(p.documento)?.id_persona;
    if (!idPersona) idPersona = insertPersona.run(cedula, p.documento, p.nombres, p.apellidos).lastInsertRowid;
    if (db.prepare('SELECT 1 FROM equipos WHERE serial = ?').get(p.serial)) continue;
    const idMarca = idPorNombre('marcas', 'id_marca', 'nombre_marca', p.marca);
    const codigoQr = JSON.stringify({ sistema: 'CheckIT', serial: p.serial });
    insertEquipo.run(idPersona, idMarca, p.modelo, p.serial, codigoQr, estadoBueno);
  }
});

sembrar();

if (credenciales.length) {
  const ruta = path.join(__dirname, '../.seed_credenciales.txt');
  fs.appendFileSync(ruta, `# Cuentas de prueba (ficticias) — ${new Date().toISOString()}\n${credenciales.join('\n')}\n\n`, { mode: 0o600 });
  console.log(`✔ ${credenciales.length} cuenta(s) de prueba creada(s). Credenciales en backend/.seed_credenciales.txt`);
} else {
  console.log('✔ Los datos de prueba ya existían; no se creó nada nuevo.');
}
