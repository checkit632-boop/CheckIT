// Serial para equipos que no tienen uno visible (v7.0, pedido de portería).
//
// Formato: 5 caracteres en mayúscula, letras y números, sin los que se
// confunden al leer o escribir (O/0, I/1). Ejemplo para un HP ProBook de
// Ana Gómez: "HP7KM".
//   1.ª letra: inicial de la marca.
//   2.ª: primer carácter válido del modelo (si no hay, sale del cálculo).
//   3.ª a 5.ª: derivadas de marca + modelo + documento del propietario, con
//   SHA-256; así dos equipos del mismo modelo reciben códigos distintos.
// Se comprueba contra la base que no exista; si existe, se recalcula con
// otro intento. Como el código no está impreso en el equipo, la etiqueta QR
// pasa a ser su identificación.
const crypto = require('crypto');
const db = require('../db/database');

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO = 5;
const MAX_INTENTOS = 200;

const normalizar = (t) =>
  String(t || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '') // quita tildes: "Á" -> "A"
    .toUpperCase();
const primeroValido = (t) => [...normalizar(t)].find((c) => ALFABETO.includes(c)) || '';

function derivados(base, intento, cantidad) {
  const hash = crypto.createHash('sha256').update(`${base}|${intento}`).digest();
  return Array.from({ length: cantidad }, (_, i) => ALFABETO[hash[i] % ALFABETO.length]).join('');
}

const existe = db.prepare('SELECT 1 FROM equipos WHERE UPPER(serial) = ?');

function generarSerial({ marca, modelo, documento }) {
  const prefijo = (primeroValido(marca) + primeroValido(modelo)).slice(0, 2);
  const base = `${normalizar(marca)}|${normalizar(modelo)}|${normalizar(documento)}`;
  for (let intento = 0; intento < MAX_INTENTOS; intento++) {
    const serial = prefijo + derivados(base, intento, LARGO - prefijo.length);
    if (!existe.get(serial)) return serial;
  }
  // Prácticamente imposible: el prefijo está saturado; se usa uno al azar.
  for (;;) {
    const serial = derivados(crypto.randomUUID(), 0, LARGO);
    if (!existe.get(serial)) return serial;
  }
}

module.exports = { generarSerial, ALFABETO, LARGO };
