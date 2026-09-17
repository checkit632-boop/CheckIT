require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const personasRoutes = require('./routes/personas');
const equiposRoutes = require('./routes/equipos');
const registrosRoutes = require('./routes/registros');
const catalogosRoutes = require('./routes/catalogos');
const dashboardRoutes = require('./routes/dashboard');
// Se importa solo para que corra su inicialización (crea/migra las
// tablas al arrancar el servidor) — no se usa directamente aquí.
require('./db/database');
const { ejecutarRespaldo, obtenerDestinos } = require('./utils/backup');
const { ejecutarReinicioOperativo } = require('./utils/reinicio');


const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'CheckIT API' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/personas', personasRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Manejador de errores genérico
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

// ── Reinicio operativo diario (11:59 p.m.) ─────────────────────
// La lógica vive en utils/reinicio.js. Este bloque es solo el disparador
// automático: si el backend está corriendo justo a esa hora, se ejecuta
// solo. Si prefieres que corra SIN depender de que el backend esté
// encendido, usa una tarea programada de Windows con:
//   node scripts/reinicio.js
// (ver README para el paso a paso). Ambas formas conviven sin problema.
let ultimoReinicio = null;
setInterval(() => {
  const ahora = new Date();
  const hoyStr = ahora.toISOString().slice(0, 10);
  if (ahora.getHours() === 23 && ahora.getMinutes() === 59 && ultimoReinicio !== hoyStr) {
    ultimoReinicio = hoyStr;
    try {
      const cerrados = ejecutarReinicioOperativo();
      console.log(`🔄 Reinicio operativo diario ejecutado (${hoyStr} 23:59) — ${cerrados} equipo(s) cerrado(s) automáticamente`);
    } catch (err) {
      console.error('Error registrando el reinicio operativo:', err.message);
    }
  }
}, 30000);

app.listen(PORT, () => {
  console.log(`🚀 CheckIT API escuchando en http://localhost:${PORT}`);

  if (obtenerDestinos().length === 0) {
    console.warn('⚠ Respaldo automático desactivado: configura BACKUP_DIR_1 (y BACKUP_DIR_2) en backend/.env');
  }
});

// ── Respaldo automático diario de la base de datos ─────────────
// Hora configurable con BACKUP_HORA en backend/.env (formato "HH:MM",
// 24 horas). Por defecto 02:00 a.m., pensado para que no coincida con el
// reinicio operativo de las 11:59 p.m. ni con el horario de uso normal.
// Guarda la copia en BACKUP_DIR_1 y, si está configurado, también en
// BACKUP_DIR_2 — idealmente unidades/discos distintos al del proyecto.
const [BACKUP_HORA_H, BACKUP_HORA_M] = (process.env.BACKUP_HORA || '02:00').split(':').map(Number);

let ultimoRespaldo = null;
setInterval(async () => {
  const ahora = new Date();
  const hoyStr = ahora.toISOString().slice(0, 10);
  if (ahora.getHours() === BACKUP_HORA_H && ahora.getMinutes() === BACKUP_HORA_M && ultimoRespaldo !== hoyStr) {
    ultimoRespaldo = hoyStr;
    const resultado = await ejecutarRespaldo().catch((err) => ({ ok: false, error: err.message }));
    if (resultado.ok) {
      console.log(`💾 Respaldo automático "${resultado.archivo}" guardado en: ${resultado.destinos.join(', ')}`);
    } else {
      console.error('✖ Falló el respaldo automático:', resultado.error);
    }
  }
}, 30000);
