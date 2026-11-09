require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const compression = require('compression');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const personasRoutes = require('./routes/personas');
const equiposRoutes = require('./routes/equipos');
const registrosRoutes = require('./routes/registros');
const catalogosRoutes = require('./routes/catalogos');
const dashboardRoutes = require('./routes/dashboard');
// Al importarla se crea/migra el esquema; aquí se usa además para la
// comprobación de /api/health.
const db = require('./db/database');
const { obtenerDestinos } = require('./utils/backup');
const { iniciarTareasProgramadas } = require('./utils/tareas');
const errorHandler = require('./middleware/errorHandler');


// H-05: red de seguridad general. Una promesa rechazada sin .catch() (p. ej.
// un fallo de SMTP o de respaldo) se registra en vez de tumbar toda la API.
// Cada llamada asíncrona debe seguir manejando su propio error; esto es solo
// el último recurso.
process.on('unhandledRejection', (err) => {
  console.error('[CheckIT] Rechazo de promesa no manejado:', err);
});

const app = express();
// La IP real del cliente (para los límites de peticiones) se toma de
// X-Forwarded-For solo si la petición llega desde un proxy de confianza: por
// defecto, uno en la misma máquina (proxy de Vite en desarrollo, IIS/nginx
// en producción). Configurable con TRUST_PROXY en backend/.env.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
const PORT = process.env.PORT || 4000;
// Dirección en la que escucha. Vacía: todas las interfaces de red (como
// antes). Con HOST=127.0.0.1 solo responde en el mismo equipo, que es lo
// indicado cuando CheckIT se instala y se usa en un único PC.
const HOST = process.env.HOST?.trim() || '';

// CORS: solo los orígenes de la lista pueden leer las respuestas de la API
// desde otra página. Antes estaba abierto a cualquier sitio. El frontend
// servido por Vite (o por el mismo backend en producción) es del mismo origen
// y no se ve afectado. Configurable con CORS_ORIGINS en backend/.env.
const ORIGENES_PERMITIDOS = (process.env.CORS_ORIGINS || 'https://localhost:5173,http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: ORIGENES_PERMITIDOS }));
// Comprime (gzip) las respuestas: los listados JSON repiten mucho los mismos
// nombres de campo y se reducen varias veces, sobre todo el historial de
// Resumen y las exportaciones.
app.use(compression());
app.use(express.json());

// Encabezados de seguridad básicos para la API y la interfaz: el navegador
// no adivina tipos de archivo, ninguna otra página puede mostrar CheckIT
// dentro de un marco (clickjacking) y no se envía la dirección de origen a
// sitios externos. Solo la cámara del propio sitio queda permitida.
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=(self)',
  });
  next();
});

// Estado real del servicio: además de responder, comprueba que la base de
// datos atienda una consulta. Lo usa la barra "Estado del sistema" de
// Control de Acceso (antes mostraba "Conectada" fijo, aunque fallara).
app.get('/api/health', (req, res) => {
  let baseDeDatos = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch (err) {
    baseDeDatos = 'error';
  }
  res.status(baseDeDatos === 'ok' ? 200 : 503).json({ status: baseDeDatos === 'ok' ? 'ok' : 'error', service: 'CheckIT API', baseDeDatos });
});

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/personas', personasRoutes);
app.use('/api/equipos', equiposRoutes);
app.use('/api/registros', registrosRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Una ruta /api inexistente responde un 404 en JSON. Además evita que caiga
// en la interfaz de abajo, que devolvería la página en lugar de un error.
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Interfaz compilada (frontend/dist, generada con `npm run build`). Si existe,
// la API la entrega en el mismo puerto: así basta un solo programa, sin un
// servidor web aparte. En desarrollo se sigue usando Vite (puerto 5173).
const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const INDEX = path.join(DIST, 'index.html');
const sirveInterfaz = fs.existsSync(INDEX);
if (sirveInterfaz) {
  // Los archivos de assets/ llevan un código en el nombre que cambia con
  // cada compilación, así que el navegador puede guardarlos por un año.
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  // Cualquier otra dirección (/login, /resumen...) es una ruta de React:
  // se responde la página principal sin caché, para que tome cada versión.
  app.get('*', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(INDEX);
  });
}

// H-06: manejador de errores centralizado (siempre después de las rutas).
app.use(errorHandler);

// ── Tareas automáticas ─────────────────────────────────────────
// Cierre diario (11:59 p. m.) y respaldo diario (BACKUP_HORA), con
// recuperación al arrancar si el PC estuvo apagado a esa hora y aviso por
// correo si fallan. La lógica está en utils/tareas.js; el cierre también se
// puede ejecutar a mano con "npm run reinicio" y el respaldo con
// "npm run backup".
const alIniciar = () => {
  console.log(`🚀 CheckIT API escuchando en http://localhost:${PORT}${HOST ? ` (solo ${HOST})` : ''}`);
  console.log(sirveInterfaz
    ? `🖥  Interfaz disponible en http://localhost:${PORT}`
    : '   Sin interfaz compilada: ejecuta "npm run build" en frontend para abrir CheckIT desde este puerto.');

  if (obtenerDestinos().length === 0) {
    console.warn('⚠ Respaldo automático desactivado: configura BACKUP_DIR_1 (y BACKUP_DIR_2) en backend/.env');
  }
};
const servidor = HOST ? app.listen(PORT, HOST, alIniciar) : app.listen(PORT, alIniciar);
iniciarTareasProgramadas();

// Cierre ordenado (Ctrl + C en la consola o señal de terminación): deja de
// aceptar peticiones y cierra la base, lo que vuelca el archivo -wal al .db.
function apagar(senal) {
  console.log(`\n⏹ CheckIT se detiene (${senal}).`);
  const terminar = () => {
    try { db.close(); } catch { /* ya cerrada */ }
    process.exit(0);
  };
  servidor.close(terminar);
  // Si un navegador mantiene una conexión abierta, no se espera más de 3 s.
  setTimeout(terminar, 3000).unref();
}
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
