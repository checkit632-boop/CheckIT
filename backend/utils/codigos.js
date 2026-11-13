// Códigos de verificación de 6 dígitos (inicio de sesión, recuperación de
// contraseña y, desde v7.0, acceso al visor de la base de datos). Antes vivía
// dentro de routes/auth.js; se separó para que el visor use exactamente la
// misma lógica: hash con bcrypt, vencimiento, intentos y uso único.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { enviarCodigo } = require('./mailer');

const CODIGO_EXPIRA_MINUTOS = 3;
const MAX_INTENTOS_CODIGO = 5;

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
  db.prepare(
    `UPDATE codigos_verificacion SET usado = 1 WHERE id_usuario = ? AND tipo = ? AND usado = 0`
  ).run(id_usuario, tipo);
  db.prepare(
    `
    INSERT INTO codigos_verificacion (id_usuario, codigo_hash, tipo, expira)
    VALUES (?, ?, ?, ?)
  `
  ).run(id_usuario, hash, tipo, expira);
}

// Lee el código pendiente, cuenta el intento y lo marca como usado en una
// sola transacción IMMEDIATE (toma el bloqueo de escritura desde el inicio).
// Con un solo proceso de Node no hay carrera posible, porque better-sqlite3
// es síncrono; la transacción lo mantiene correcto también si el backend
// llegara a correr en varios procesos, y el contador se incrementa en SQL
// (intentos = intentos + 1) en vez de a partir de un valor leído antes.
const validarCodigoEnTransaccion = db.transaction((id_usuario, tipo, codigo) => {
  const row = db
    .prepare(
      `
    SELECT * FROM codigos_verificacion
    WHERE id_usuario = ? AND tipo = ? AND usado = 0
    ORDER BY id_codigo DESC LIMIT 1
  `
    )
    .get(id_usuario, tipo);

  if (!row) return { ok: false, error: 'No hay un código pendiente. Solicita uno nuevo.' };
  if (new Date(row.expira).getTime() < Date.now())
    return { ok: false, error: 'El código ha expirado. Solicita uno nuevo.' };
  if (!bcrypt.compareSync(String(codigo), row.codigo_hash)) {
    // O-02: cada código cuenta sus propios fallos. Al llegar al máximo se
    // invalida aunque no haya vencido, y hay que pedir uno nuevo.
    const { intentos } = db
      .prepare(
        `
      UPDATE codigos_verificacion SET intentos = intentos + 1 WHERE id_codigo = ? RETURNING intentos
    `
      )
      .get(row.id_codigo);
    if (intentos >= MAX_INTENTOS_CODIGO) {
      db.prepare('UPDATE codigos_verificacion SET usado = 1 WHERE id_codigo = ?').run(
        row.id_codigo
      );
      return { ok: false, status: 429, error: 'Demasiados intentos. Solicita un nuevo código.' };
    }
    const restantes = MAX_INTENTOS_CODIGO - intentos;
    return {
      ok: false,
      error: `Código incorrecto. Te queda${restantes === 1 ? '' : 'n'} ${restantes} intento${restantes === 1 ? '' : 's'}.`,
    };
  }

  db.prepare('UPDATE codigos_verificacion SET usado = 1 WHERE id_codigo = ?').run(row.id_codigo);
  return { ok: true };
});

function validarCodigo(id_usuario, tipo, codigo) {
  return validarCodigoEnTransaccion.immediate(id_usuario, tipo, codigo);
}

module.exports = {
  CODIGO_EXPIRA_MINUTOS,
  MAX_INTENTOS_CODIGO,
  enviarCodigoSeguro,
  generarCodigo,
  guardarCodigo,
  validarCodigo,
};
