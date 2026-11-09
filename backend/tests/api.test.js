// Pruebas automáticas de la API (npm test, desde la carpeta backend).
//
// Levantan el servidor real (server.js) con una base TEMPORAL
// (CHECKIT_DB_PATH) y datos ficticios, en un puerto aparte: nunca tocan
// backend/db/checkit.db ni envían correos. Los códigos de acceso se leen de
// la consola del servidor, como en desarrollo (NODE_ENV=development sin SMTP).
//
// Cubren lo crítico antes de implantar: inicio de sesión con código, roles,
// entrada y salida con accesorios, lecturas repetidas, código de
// contingencia, cuenta inactivada a mitad del ingreso y la recuperación de
// tareas cuando el PC estuvo apagado (respaldo y cierre de la noche).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const BACKEND = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-pruebas-'));
const DB_PATH = path.join(TMP, 'db', 'checkit.db');
const RESPALDOS = path.join(TMP, 'respaldos');
const PORT = 4300 + Math.floor(Math.random() * 500);
const URL = `http://127.0.0.1:${PORT}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const ENV = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  NODE_ENV: 'development',
  JWT_SECRET: 'prueba-'.repeat(12),
  CHECKIT_DB_PATH: DB_PATH,
  CHECKIT_ESPERA_RECUPERACION_MS: '0',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '',
  BACKUP_DIR_1: RESPALDOS, BACKUP_DIR_2: '',
  ZONA_HORARIA_OFFSET: '-5',
};

let servidor = null;
let consola = '';

async function arrancar() {
  consola = '';
  servidor = spawn(process.execPath, ['server.js'], { cwd: BACKEND, env: ENV });
  servidor.stdout.on('data', (d) => { consola += d; });
  servidor.stderr.on('data', (d) => { consola += d; });
  for (let i = 0; i < 100 && !/escuchando/.test(consola); i++) await dormir(100);
  assert.match(consola, /escuchando/, `El servidor no arrancó:\n${consola}`);
}

async function detener() {
  if (!servidor) return;
  const fin = new Promise((r) => servidor.once('exit', r));
  servidor.kill();
  await fin;
  servidor = null;
}

async function pedir(metodo, ruta, { token, cuerpo } = {}) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let datos = null;
  try { datos = JSON.parse(texto); } catch { datos = texto; }
  return { status: r.status, datos, headers: r.headers };
}

// Último código de acceso que el servidor imprimió para ese correo.
async function codigoPara(correo) {
  for (let i = 0; i < 30; i++) {
    const todos = [...consola.matchAll(new RegExp(`Código para ${correo.replace(/[.]/g, '\\.')}: (\\d{6})`, 'g'))];
    if (todos.length) return todos.at(-1)[1];
    await dormir(100);
  }
  throw new Error(`No apareció el código para ${correo}`);
}

async function iniciarSesion(usuario, password, correo) {
  const marca = consola.length;
  const paso1 = await pedir('POST', '/api/auth/login', { cuerpo: { usuario, password } });
  assert.equal(paso1.status, 200, JSON.stringify(paso1.datos));
  assert.equal(paso1.datos.requiereCodigo, true);
  for (let i = 0; i < 30 && !consola.slice(marca).includes(correo); i++) await dormir(100);
  const codigo = await codigoPara(correo);
  const paso2 = await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: paso1.datos.id_usuario, codigo } });
  assert.equal(paso2.status, 200, JSON.stringify(paso2.datos));
  return { token: paso2.datos.token, id_usuario: paso1.datos.id_usuario };
}

const ctx = {};

before(async () => {
  await arrancar();
  const archivo = fs.readFileSync(path.join(TMP, '.super_admin_password_inicial.txt'), 'utf8');
  ctx.passAdmin = archivo.match(/Contraseña inicial: (\S+)/)[1];
});

after(async () => {
  await detener();
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 });
});

test('la base de prueba está aislada de la real', () => {
  assert.ok(fs.existsSync(DB_PATH));
  assert.ok(!DB_PATH.startsWith(BACKEND));
});

test('health responde ok y con encabezados de seguridad', async () => {
  const r = await pedir('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.datos.baseDeDatos, 'ok');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  assert.equal(r.headers.get('x-powered-by'), null);
});

test('una ruta /api inexistente responde 404 en JSON', async () => {
  const r = await pedir('GET', '/api/no-existe');
  assert.equal(r.status, 404);
  assert.equal(typeof r.datos.error, 'string');
});

test('al arrancar sin respaldos previos se genera uno, íntegro', async () => {
  let archivos = [];
  for (let i = 0; i < 50 && archivos.length === 0; i++) {
    archivos = fs.existsSync(RESPALDOS) ? fs.readdirSync(RESPALDOS).filter((f) => f.endsWith('.db')) : [];
    await dormir(100);
  }
  assert.equal(archivos.length, 1);
  const copia = new Database(path.join(RESPALDOS, archivos[0]), { readonly: true });
  assert.equal(copia.pragma('integrity_check', { simple: true }), 'ok');
  copia.close();
});

test('contraseña incorrecta: 401 y sin código', async () => {
  const r = await pedir('POST', '/api/auth/login', { cuerpo: { usuario: 'admin', password: 'Incorrecta1' } });
  assert.equal(r.status, 401);
});

test('ingreso en dos pasos: código errado y luego correcto', async () => {
  const paso1 = await pedir('POST', '/api/auth/login', { cuerpo: { usuario: 'admin', password: ctx.passAdmin } });
  assert.equal(paso1.datos.requiereCodigo, true);
  const codigo = await codigoPara('checkit632@gmail.com');
  const errado = String((Number(codigo) + 1) % 1000000).padStart(6, '0');
  const mal = await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: paso1.datos.id_usuario, codigo: errado } });
  assert.equal(mal.status, 401);
  assert.match(mal.datos.error, /Te quedan 4 intentos/);
  const bien = await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: paso1.datos.id_usuario, codigo } });
  assert.equal(bien.status, 200);
  ctx.admin = bien.datos.token;
  const me = await pedir('GET', '/api/auth/me', { token: ctx.admin });
  assert.equal(me.datos.user.rol, 'Super Administrador');
});

test('sin token o con token alterado no hay acceso', async () => {
  assert.equal((await pedir('GET', '/api/equipos')).status, 401);
  assert.equal((await pedir('GET', '/api/equipos', { token: ctx.admin.slice(0, -2) + 'xx' })).status, 401);
});

test('el Super Administrador crea un Operador; el Operador no entra a módulos de administración', async () => {
  const roles = await pedir('GET', '/api/usuarios/roles/all', { token: ctx.admin });
  const tipos = await pedir('GET', '/api/catalogos/tipos-documento', { token: ctx.admin });
  const idOperador = Array.isArray(roles.datos) ? roles.datos.find((r) => r.nombre_rol === 'Operador de Sistema')?.id_rol : 3;
  const crear = await pedir('POST', '/api/usuarios', {
    token: ctx.admin,
    cuerpo: {
      usuario: 'vigilante1', nombre: 'Vigilante', apellidos: 'Prueba', correo: 'vigilante1@prueba.co',
      id_tipo_documento: tipos.datos[0].id_tipo_documento, numero_documento: '900000001',
      password: 'Portería2026', id_rol: idOperador || 3,
    },
  });
  assert.equal(crear.status, 201, JSON.stringify(crear.datos));
  ctx.idOperador = crear.datos.id_usuario;
  const sesion = await iniciarSesion('vigilante1', 'Portería2026', 'vigilante1@prueba.co');
  ctx.operador = sesion.token;
  assert.equal((await pedir('GET', '/api/usuarios', { token: ctx.operador })).status, 403);
  assert.equal((await pedir('GET', '/api/registros/summary', { token: ctx.operador })).status, 403);
  assert.equal((await pedir('GET', '/api/registros/stats/hoy', { token: ctx.operador })).status, 200);
});

test('entrada con accesorios, lectura repetida ignorada y salida con los accesorios de la entrada', async () => {
  const tipos = await pedir('GET', '/api/catalogos/tipos-documento', { token: ctx.admin });
  const marcas = await pedir('GET', '/api/catalogos/marcas', { token: ctx.admin });
  const estados = await pedir('GET', '/api/catalogos/estados', { token: ctx.admin });
  const accesorios = await pedir('GET', '/api/catalogos/accesorios', { token: ctx.admin });
  assert.deepEqual(accesorios.datos.map((a) => a.nombre_accesorio), ['Mouse', 'Cargador', 'Teclado', 'Pantalla', 'Base refrigerante', 'Diademas']);

  const persona = await pedir('POST', '/api/personas', {
    token: ctx.operador,
    cuerpo: { id_tipo_documento: tipos.datos[0].id_tipo_documento, numero_documento: '1077000001', nombres: 'Ana', apellidos: 'Gómez' },
  });
  assert.equal(persona.status, 201);
  const equipo = await pedir('POST', '/api/equipos', {
    token: ctx.operador,
    cuerpo: { id_persona: persona.datos.id_persona, id_marca: marcas.datos[0].id_marca, modelo: 'Prueba 1', serial: 'TEST-SN-001', id_estado: estados.datos[0].id_estado },
  });
  assert.equal(equipo.status, 201);
  ctx.idEquipo = equipo.datos.id_equipo;
  const qr = equipo.datos.codigo_qr;

  const sinConfirmar = await pedir('POST', '/api/registros/escanear', { token: ctx.operador, cuerpo: { codigo: qr } });
  assert.equal(sinConfirmar.datos.requiereAccesorios, true);

  const [mouse, cargador] = accesorios.datos;
  const entrada = await pedir('POST', '/api/registros/escanear', {
    token: ctx.operador, cuerpo: { codigo: qr, accesorios: [mouse.id_accesorio, cargador.id_accesorio] },
  });
  assert.equal(entrada.status, 201, JSON.stringify(entrada.datos));
  assert.equal(entrada.datos.movimiento, 'Entrada');
  assert.equal(entrada.datos.stats.equiposDentro, 1);

  const repetida = await pedir('POST', '/api/registros/escanear', { token: ctx.operador, cuerpo: { codigo: qr } });
  assert.equal(repetida.status, 409);
  assert.equal(repetida.datos.duplicado, true);

  await dormir(8200); // ventana de lectura repetida

  // Con otra distribución de teclado la pistola puede cambiar comillas y llaves.
  const salidaSinConfirmar = await pedir('POST', '/api/registros/escanear', { token: ctx.operador, cuerpo: { codigo: '¨sistema¨Ñ¨CheckIT¨,¨serial¨Ñ¨TEST-SN-001¨*' } });
  assert.equal(salidaSinConfirmar.datos.requiereConfirmacionSalida, true, JSON.stringify(salidaSinConfirmar.datos));
  assert.deepEqual(salidaSinConfirmar.datos.accesoriosEntrada.map((a) => a.nombre_accesorio), ['Mouse', 'Cargador']);

  const salida = await pedir('POST', '/api/registros/escanear', { token: ctx.operador, cuerpo: { codigo: qr, confirmaSalida: true } });
  assert.equal(salida.status, 201);
  assert.equal(salida.datos.movimiento, 'Salida');
  assert.equal(salida.datos.stats.equiposDentro, 0);
});

test('código de contingencia: permite entrar sin correo y queda en la auditoría', async () => {
  const paso1 = await pedir('POST', '/api/auth/login', { cuerpo: { usuario: 'vigilante1', password: 'Portería2026' } });
  assert.equal(paso1.datos.requiereCodigo, true);
  const salidaScript = execFileSync(process.execPath, ['scripts/codigo-contingencia.js', 'vigilante1'], { cwd: BACKEND, env: ENV, encoding: 'utf8' });
  const codigo = salidaScript.match(/vigilante1: (\d{6})/)[1];
  const r = await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: paso1.datos.id_usuario, codigo } });
  assert.equal(r.status, 200);
  const db = new Database(DB_PATH, { readonly: true });
  const evento = db.prepare("SELECT descripcion FROM auditoria WHERE descripcion LIKE 'Código de acceso de contingencia%' ").get();
  db.close();
  assert.ok(evento);
});

test('código de contingencia: rechaza usuarios inexistentes y la cuenta interna', () => {
  for (const u of ['no-existe', 'sistema']) {
    assert.throws(() => execFileSync(process.execPath, ['scripts/codigo-contingencia.js', u], { cwd: BACKEND, env: ENV, stdio: 'pipe' }));
  }
});

test('una cuenta inactivada entre la contraseña y el código no recibe sesión', async () => {
  const paso1 = await pedir('POST', '/api/auth/login', { cuerpo: { usuario: 'vigilante1', password: 'Portería2026' } });
  const codigo = await codigoPara('vigilante1@prueba.co');
  const inactivar = await pedir('PATCH', `/api/usuarios/${ctx.idOperador}/estado`, { token: ctx.admin, cuerpo: { estado: false } });
  assert.equal(inactivar.status, 200);
  const r = await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: paso1.datos.id_usuario, codigo } });
  assert.equal(r.status, 401);
  assert.equal(r.datos.token, undefined);
  // y su sesión anterior deja de servir
  assert.equal((await pedir('GET', '/api/registros/stats/hoy', { token: ctx.operador })).status, 401);
});

test('PC apagado a las 11:59 p. m.: al arrancar cierra lo de la noche anterior y respeta lo de hoy', async () => {
  // Segundo equipo con entrada de hoy (no debe cerrarse).
  const equipos = await pedir('GET', '/api/equipos', { token: ctx.admin });
  const base = equipos.datos.find((e) => e.id_equipo === ctx.idEquipo);
  const nuevo = await pedir('POST', '/api/equipos', {
    token: ctx.admin,
    cuerpo: { id_persona: base.id_persona, id_marca: base.id_marca, modelo: 'Prueba 2', serial: 'TEST-SN-002', id_estado: base.id_estado },
  });
  const entradaHoy = await pedir('POST', '/api/registros/escanear', { token: ctx.admin, cuerpo: { codigo: 'TEST-SN-002', accesorios: [] } });
  assert.equal(entradaHoy.status, 201);
  await detener();

  // El primer equipo "entró ayer" y la noche pasada no hubo cierre.
  const db = new Database(DB_PATH);
  const idAdmin = db.prepare("SELECT id_usuario FROM usuarios WHERE usuario = 'admin'").get().id_usuario;
  db.prepare(`INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento, fecha_hora)
              VALUES (?, ?, (SELECT id_tipo_movimiento FROM tipos_movimiento WHERE nombre_movimiento = 'Entrada'), datetime('now', '-30 hours'))`)
    .run(ctx.idEquipo, idAdmin);
  db.prepare("DELETE FROM auditoria WHERE accion = 'SISTEMA' AND tabla_afectada = 'registros'").run();
  db.close();

  await arrancar();
  for (let i = 0; i < 50 && !/recuperado al iniciar; el PC/.test(consola); i++) await dormir(100);
  assert.match(consola, /Cierre diario \(recuperado al iniciar.*\): 1 equipo/);

  const estado1 = await pedir('GET', `/api/registros/estado/${ctx.idEquipo}`, { token: ctx.admin });
  const estado2 = await pedir('GET', `/api/registros/estado/${nuevo.datos.id_equipo}`, { token: ctx.admin });
  assert.equal(estado1.datos.estado, 'Afuera');
  assert.equal(estado2.datos.estado, 'Adentro');

  const alerta = await pedir('GET', '/api/registros/cierres-automaticos', { token: ctx.admin });
  assert.deepEqual(alerta.datos.equipos.map((e) => e.serial), ['TEST-SN-001']);

  // Un segundo arranque el mismo día no vuelve a cerrar nada.
  await detener();
  await arrancar();
  await dormir(1000);
  assert.doesNotMatch(consola, /Cierre diario/);
  const estado2b = await pedir('GET', `/api/registros/estado/${nuevo.datos.id_equipo}`, { token: ctx.admin });
  assert.equal(estado2b.datos.estado, 'Adentro');
});
