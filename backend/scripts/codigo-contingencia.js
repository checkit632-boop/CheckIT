// Código de acceso de contingencia, para cuando el correo no funciona (sin
// internet, Gmail caído o contraseña de aplicación vencida).
//
// Uso, en el PC de CheckIT, desde la carpeta backend:
//   1. La persona escribe su usuario y contraseña en la pantalla de inicio de
//      sesión y queda en la pantalla del código.
//   2. Un administrador del equipo ejecuta:
//        npm run codigo -- NOMBRE_DE_USUARIO
//   3. La persona escribe el código que aparece en la consola (vence en 5
//      minutos y reemplaza al que se envió por correo).
//
// Por qué no debilita el ingreso: solo funciona con acceso a la consola y a
// la carpeta backend del PC, que ya permiten leer la base y el .env. La
// contraseña se sigue exigiendo en la pantalla, y cada código queda en la
// auditoría.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');

const MINUTOS = 5;
const usuario = (process.argv[2] || '').trim();

if (!usuario) {
  console.error('Uso: npm run codigo -- NOMBRE_DE_USUARIO');
  process.exit(1);
}

const cuenta = db.prepare('SELECT id_usuario, usuario, estado FROM usuarios WHERE usuario = ?').get(usuario);
if (!cuenta || cuenta.usuario === 'sistema') {
  console.error(`✖ No existe el usuario "${usuario}".`);
  process.exit(1);
}
if (!cuenta.estado) {
  console.error(`✖ La cuenta "${usuario}" está inactiva. Actívela antes de generar un código.`);
  process.exit(1);
}

const codigo = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
const expira = new Date(Date.now() + MINUTOS * 60000).toISOString();

db.transaction(() => {
  db.prepare(`UPDATE codigos_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = 'login_2fa' AND usado = 0`)
    .run(cuenta.id_usuario);
  db.prepare(`INSERT INTO codigos_verificacion (id_usuario, codigo_hash, tipo, expira) VALUES (?, ?, 'login_2fa', ?)`)
    .run(cuenta.id_usuario, bcrypt.hashSync(codigo, 8), expira);
  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, 'SISTEMA', 'usuarios', ?)`)
    .run(cuenta.id_usuario, `Código de acceso de contingencia generado en la consola del PC para ${cuenta.usuario}`);
})();

console.log(`\nCódigo de contingencia para ${cuenta.usuario}: ${codigo}`);
console.log(`Vence en ${MINUTOS} minutos. Debe escribirse en la pantalla del código, después de la contraseña.\n`);
db.close();
