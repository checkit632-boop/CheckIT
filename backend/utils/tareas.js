// Tareas automáticas de la API: cierre diario (11:59 p. m.) y respaldo
// diario (BACKUP_HORA, 2:00 a. m. por defecto).
//
// - La hora se calcula con ZONA_HORARIA_OFFSET (Colombia, UTC-5), igual que
//   el resto del sistema, y no con la zona configurada en Windows: si el PC
//   queda con otra zona horaria, las tareas siguen corriendo a su hora.
// - Recuperación al arrancar: con CheckIT en un solo PC, es normal que el
//   equipo esté apagado a las 11:59 p. m. o a las 2:00 a. m. Al iniciar, la
//   API revisa si quedó pendiente el cierre de la noche anterior o si el
//   último respaldo tiene más de 26 horas, y los ejecuta.
// - Si un respaldo o un cierre falla, además de la consola se avisa por
//   correo a los Super Administradores activos (si hay SMTP configurado).
const db = require('../db/database');
const { OFFSET_HORAS } = require('./periodos');
const { ejecutarRespaldo, obtenerDestinos, ultimoRespaldo } = require('./backup');
const { ejecutarReinicioOperativo } = require('./reinicio');
const { enviarAviso } = require('./mailer');

const HORA_MS = 3600000;
const MAX_HORAS_SIN_RESPALDO = 26;

// 'AAAA-MM-DD HH:MM:SS' en UTC, el formato de CURRENT_TIMESTAMP.
const formatoUtc = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function ahoraLocal() {
  const d = new Date(Date.now() + OFFSET_HORAS * HORA_MS);
  return { fecha: d.toISOString().slice(0, 10), h: d.getUTCHours(), m: d.getUTCMinutes() };
}

// Medianoche de hoy (hora local) expresada en UTC.
function inicioDeHoyUtcMs() {
  const [a, mes, dia] = ahoraLocal().fecha.split('-').map(Number);
  return Date.UTC(a, mes - 1, dia) - OFFSET_HORAS * HORA_MS;
}

function horaRespaldo() {
  const [h, m] = (process.env.BACKUP_HORA || '02:00').split(':').map(Number);
  if (Number.isInteger(h) && Number.isInteger(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) return { h, m };
  console.warn(`⚠ BACKUP_HORA="${process.env.BACKUP_HORA}" no es válida (formato HH:MM). Se usa 02:00.`);
  return { h: 2, m: 0 };
}

async function avisar(asunto, lineas) {
  const destinatarios = db.prepare(`
    SELECT u.nombre, u.correo FROM usuarios u
    JOIN roles r ON r.id_rol = u.id_rol
    WHERE r.nombre_rol = 'Super Administrador' AND u.estado = 1
      AND u.correo IS NOT NULL AND u.usuario <> 'sistema'
  `).all();
  let enviados = 0;
  for (const d of destinatarios) {
    if (await enviarAviso({ correo: d.correo, nombre: d.nombre, asunto, lineas })) enviados++;
  }
  if (enviados === 0) console.warn('⚠ El aviso no se envió por correo (sin SMTP o sin Super Administrador con correo).');
}

async function respaldar(motivo = '') {
  const resultado = await ejecutarRespaldo().catch((err) => ({ ok: false, error: err.message }));
  const etiqueta = motivo ? ` (${motivo})` : '';
  if (resultado.ok) {
    console.log(`💾 Respaldo${etiqueta} "${resultado.archivo}" guardado en: ${resultado.destinos.join(', ')}`);
    if (resultado.fallidosEn?.length) {
      const detalle = resultado.fallidosEn.map((f) => `${f.carpeta}: ${f.error}`);
      console.error('⚠ El respaldo no se pudo guardar en:', detalle.join(' | '));
      await avisar('un destino de respaldo falló', [
        `El respaldo ${resultado.archivo} se guardó en ${resultado.destinos.length} destino(s), pero falló en:`,
        ...detalle,
        'Revise que el disco USB esté conectado y que OneDrive tenga la sesión iniciada.',
      ]);
    }
  } else {
    console.error(`✖ Falló el respaldo${etiqueta}:`, resultado.error);
    await avisar('falló el respaldo de la base de datos', [
      `El respaldo automático${etiqueta} no se pudo generar.`,
      `Detalle: ${resultado.error}`,
      'Revise los destinos de respaldo y ejecute "npm run backup" en la carpeta backend.',
    ]);
  }
  return resultado;
}

function cerrarDia(opciones = {}) {
  try {
    const cerrados = ejecutarReinicioOperativo(opciones);
    console.log(`🔄 Cierre diario${opciones.motivo ? ` (${opciones.motivo})` : ''}: ${cerrados} equipo(s) con salida automática.`);
    return cerrados;
  } catch (err) {
    console.error('✖ Error en el cierre diario:', err.message);
    avisar('falló el cierre diario', [
      'El cierre diario de los equipos que quedaron dentro no se pudo ejecutar.',
      `Detalle: ${err.message}`,
      'Puede ejecutarse a mano con "npm run reinicio" en la carpeta backend.',
    ]).catch(() => {});
    return null;
  }
}

async function recuperarTareasPendientes() {
  // Cierre: el último debió ocurrir ayer a las 11:59 p. m. (local) o después.
  const inicioHoy = inicioDeHoyUtcMs();
  const ultimoCierre = db.prepare(`
    SELECT MAX(fecha) AS f FROM auditoria WHERE accion = 'SISTEMA' AND tabla_afectada = 'registros'
  `).get().f;
  const hayRegistrosAnteriores = db.prepare('SELECT 1 FROM registros WHERE fecha_hora < ? LIMIT 1').get(formatoUtc(inicioHoy));
  if (hayRegistrosAnteriores && (!ultimoCierre || ultimoCierre < formatoUtc(inicioHoy - 60000))) {
    // Solo se cierran las entradas anteriores a hoy: las de hoy son reales.
    cerrarDia({ antesDe: formatoUtc(inicioHoy), motivo: 'recuperado al iniciar; el PC estaba apagado a las 11:59 p. m.' });
  }

  // Respaldo: si el más reciente tiene más de 26 horas, o no hay ninguno.
  if (obtenerDestinos().length > 0) {
    const ultimo = ultimoRespaldo();
    if (ultimo === null || Date.now() - ultimo > MAX_HORAS_SIN_RESPALDO * HORA_MS) {
      await respaldar('recuperado al iniciar');
    }
  }
}

function iniciarTareasProgramadas() {
  const { h: horaR, m: minR } = horaRespaldo();
  const hechas = { cierre: null, respaldo: null };

  setInterval(() => {
    const { fecha, h, m } = ahoraLocal();
    if (h === 23 && m === 59 && hechas.cierre !== fecha) {
      hechas.cierre = fecha;
      cerrarDia();
    }
    if (h === horaR && m === minR && hechas.respaldo !== fecha) {
      hechas.respaldo = fecha;
      respaldar();
    }
  }, 30000);

  // Unos segundos después de arrancar, para no demorar el inicio.
  setTimeout(() => {
    recuperarTareasPendientes().catch((err) => console.error('✖ Error al recuperar tareas pendientes:', err.message));
  }, Number(process.env.CHECKIT_ESPERA_RECUPERACION_MS ?? 5000));
}

module.exports = { iniciarTareasProgramadas, recuperarTareasPendientes, respaldar, cerrarDia, ahoraLocal };
