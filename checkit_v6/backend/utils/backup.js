// Respaldo de la base de datos de CheckIT.
//
// Por qué así: una copia "cruda" del archivo .db mientras el servidor lo
// tiene abierto (modo WAL) puede quedar corrupta o incompleta a medias
// escritura. Por eso usamos el motor propio de SQLite (a través de
// better-sqlite3) para generar una copia consistente, sin tener que apagar
// el servidor ni bloquear a los usuarios mientras se hace el respaldo.
//
// Guarda el respaldo en hasta 2 destinos (BACKUP_DIR_1 y BACKUP_DIR_2 en
// backend/.env). La idea: BACKUP_DIR_1 en un disco/unidad distinto al del
// proyecto, y BACKUP_DIR_2 en un tercer lugar aparte (otra unidad, o una
// carpeta sincronizada con la nube tipo Google Drive/OneDrive) — así, si
// un disco falla, sigue habiendo una copia en otro lado.
const path = require('path');
const fs = require('fs');
const os = require('os');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '../db/checkit.db');

function obtenerDestinos() {
  return [process.env.BACKUP_DIR_1, process.env.BACKUP_DIR_2].map((d) => d?.trim()).filter(Boolean);
}

function limpiarRespaldosAntiguos(carpeta, retencion) {
  try {
    const archivos = fs
      .readdirSync(carpeta)
      .filter((f) => f.startsWith('checkit_backup_') && f.endsWith('.db'))
      .map((f) => {
        const ruta = path.join(carpeta, f);
        return { nombre: f, ruta, tiempo: fs.statSync(ruta).mtimeMs };
      })
      .sort((a, b) => b.tiempo - a.tiempo);

    archivos.slice(retencion).forEach((a) => {
      fs.unlinkSync(a.ruta);
      console.log(`🗑 Respaldo antiguo eliminado (${carpeta}): ${a.nombre}`);
    });
  } catch (err) {
    console.error(`No se pudo limpiar respaldos antiguos en ${carpeta}:`, err.message);
  }
}

// Devuelve { ok: true, archivo, destinos } o { ok: false, error }
async function ejecutarRespaldo() {
  if (!fs.existsSync(DB_PATH)) {
    return { ok: false, error: `No se encontró la base de datos en ${DB_PATH}` };
  }

  const destinos = obtenerDestinos();
  if (destinos.length === 0) {
    return {
      ok: false,
      error:
        'No hay carpetas de respaldo configuradas (BACKUP_DIR_1 / BACKUP_DIR_2 en backend/.env)',
    };
  }

  const ahora = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const marca = `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}`;
  const nombreArchivo = `checkit_backup_${marca}.db`;
  const rutaTemporal = path.join(os.tmpdir(), nombreArchivo);

  // Copia consistente vía el motor de SQLite (no una copia de archivo cruda)
  const db = new Database(DB_PATH, { readonly: true });
  try {
    await db.backup(rutaTemporal);
  } finally {
    db.close();
  }

  const retencion = Number(process.env.BACKUP_RETENCION) || 14;
  const guardadosEn = [];
  const fallidosEn = [];

  for (const carpeta of destinos) {
    try {
      if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });
      const destinoFinal = path.join(carpeta, nombreArchivo);
      fs.copyFileSync(rutaTemporal, destinoFinal);
      guardadosEn.push(destinoFinal);
      limpiarRespaldosAntiguos(carpeta, retencion);
    } catch (err) {
      fallidosEn.push({ carpeta, error: err.message });
    }
  }

  fs.unlinkSync(rutaTemporal);

  if (guardadosEn.length === 0) {
    return {
      ok: false,
      error: `No se pudo guardar el respaldo en ninguna carpeta: ${JSON.stringify(fallidosEn)}`,
    };
  }

  return { ok: true, archivo: nombreArchivo, destinos: guardadosEn, fallidosEn };
}

module.exports = { ejecutarRespaldo, obtenerDestinos };
