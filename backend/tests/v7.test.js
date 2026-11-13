// Pruebas de la versión 7.0: serial generado, limpieza por inactividad,
// visor de la base de datos y migración de una base de la versión 6.11.
// Igual que api.test.js: API real, base TEMPORAL, sin correos reales.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('better-sqlite3');

const BACKEND = path.join(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-v7-'));
const DB_PATH = path.join(TMP, 'db', 'checkit.db');
const RESPALDOS = path.join(TMP, 'respaldos');
const PORT = 4800 + Math.floor(Math.random() * 500);
const URL = `http://127.0.0.1:${PORT}`;
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const ENV = {
  ...process.env,
  PORT: String(PORT),
  HOST: '127.0.0.1',
  NODE_ENV: 'development',
  JWT_SECRET: 'prueba-v7-'.repeat(8),
  CHECKIT_DB_PATH: DB_PATH,
  CHECKIT_ESPERA_RECUPERACION_MS: '0',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASS: '',
  BACKUP_DIR_1: RESPALDOS,
  BACKUP_DIR_2: '',
  ZONA_HORARIA_OFFSET: '-5',
};

let servidor = null;
let consola = '';
async function arrancar() {
  consola = '';
  servidor = spawn(process.execPath, ['server.js'], { cwd: BACKEND, env: ENV });
  servidor.stdout.on('data', (d) => {
    consola += d;
  });
  servidor.stderr.on('data', (d) => {
    consola += d;
  });
  for (let i = 0; i < 100 && !/escuchando/.test(consola); i++) await dormir(100);
  assert.match(consola, /escuchando/, consola);
}
async function pedir(metodo, ruta, { token, cuerpo, visor } = {}) {
  const r = await fetch(URL + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(visor ? { 'X-Visor-Token': visor } : {}),
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await r.text();
  let datos;
  try {
    datos = JSON.parse(texto);
  } catch {
    datos = texto;
  }
  return { status: r.status, datos };
}
async function codigoPara(correo, asunto) {
  const re = new RegExp(
    `Código para ${correo.replace(/[.]/g, '\\.')}: (\\d{6})  \\(([^)]*)\\)`,
    'g'
  );
  for (let i = 0; i < 30; i++) {
    const todos = [...consola.matchAll(re)].filter((m) => !asunto || m[2].includes(asunto));
    if (todos.length) return todos.at(-1)[1];
    await dormir(100);
  }
  throw new Error(`Sin código para ${correo}`);
}
async function iniciarSesion(usuario, password, correo) {
  const marca = consola.length;
  const p1 = await pedir('POST', '/api/auth/login', { cuerpo: { usuario, password } });
  assert.equal(p1.status, 200, JSON.stringify(p1.datos));
  for (let i = 0; i < 30 && !consola.slice(marca).includes(correo); i++) await dormir(100);
  const p2 = await pedir('POST', '/api/auth/login/codigo', {
    cuerpo: { id_usuario: p1.datos.id_usuario, codigo: await codigoPara(correo, 'verificación') },
  });
  assert.equal(p2.status, 200, JSON.stringify(p2.datos));
  return p2.datos.token;
}
const conBase = (fn) => {
  const db = new Database(DB_PATH);
  try {
    return fn(db);
  } finally {
    db.close();
  }
};

const ctx = {};
before(async () => {
  await arrancar();
  ctx.pass = fs
    .readFileSync(path.join(TMP, '.super_admin_password_inicial.txt'), 'utf8')
    .match(/Contraseña inicial: (\S+)/)[1];
  ctx.admin = await iniciarSesion('admin', ctx.pass, 'checkit632@gmail.com');
  const cat = async (r) => (await pedir('GET', `/api/catalogos/${r}`, { token: ctx.admin })).datos;
  ctx.tipos = await cat('tipos-documento');
  ctx.marcas = await cat('marcas');
  ctx.estados = await cat('estados');
  ctx.roles = (await pedir('GET', '/api/usuarios/roles/all', { token: ctx.admin })).datos;
});
after(async () => {
  if (servidor) {
    const fin = new Promise((r) => servidor.once('exit', r));
    servidor.kill();
    await fin;
  }
  fs.rmSync(TMP, { recursive: true, force: true, maxRetries: 5 });
});

async function crearPersonaYEquipo(doc, serial, token = ctx.admin) {
  const persona = await pedir('POST', '/api/personas', {
    token,
    cuerpo: {
      id_tipo_documento: ctx.tipos[0].id_tipo_documento,
      numero_documento: doc,
      nombres: 'Persona',
      apellidos: doc,
    },
  });
  const equipo = await pedir('POST', '/api/equipos', {
    token,
    cuerpo: {
      id_persona: persona.datos.id_persona,
      id_marca: ctx.marcas[0].id_marca,
      modelo: 'Modelo X',
      serial,
      id_estado: ctx.estados[0].id_estado,
    },
  });
  assert.equal(equipo.status, 201, JSON.stringify(equipo.datos));
  return { id_persona: persona.datos.id_persona, id_equipo: equipo.datos.id_equipo };
}
async function crearUsuario(usuario, rol = 'Operador de Sistema') {
  const r = await pedir('POST', '/api/usuarios', {
    token: ctx.admin,
    cuerpo: {
      usuario,
      nombre: 'Nombre',
      apellidos: usuario,
      correo: `${usuario}@prueba.co`,
      id_tipo_documento: ctx.tipos[0].id_tipo_documento,
      numero_documento: `8${Math.floor(Math.random() * 1e9)}`,
      password: 'Clave2026x',
      id_rol: ctx.roles.find((x) => x.nombre_rol === rol).id_rol,
    },
  });
  assert.equal(r.status, 201, JSON.stringify(r.datos));
  return r.datos.id_usuario;
}

// ---------- Serial generado ----------
test('serial generado: 5 caracteres en mayúscula, sin O/0/I/1, empieza por la marca y es único', async () => {
  const persona = await pedir('POST', '/api/personas', {
    token: ctx.admin,
    cuerpo: {
      id_tipo_documento: ctx.tipos[0].id_tipo_documento,
      numero_documento: '1001',
      nombres: 'Ana',
      apellidos: 'Gómez',
    },
  });
  const marca = ctx.marcas.find((m) => m.nombre_marca === 'HP');
  const q = `/api/equipos/serial-generado?id_marca=${marca.id_marca}&modelo=ProBook%20450&id_persona=${persona.datos.id_persona}`;
  const a = await pedir('GET', q, { token: ctx.admin });
  assert.equal(a.status, 200);
  assert.match(a.datos.serial, /^[A-HJ-NP-Z2-9]{5}$/);
  assert.equal(a.datos.serial.slice(0, 2), 'HP');
  // Es determinista mientras esté libre, y cambia cuando ya se usó.
  assert.equal((await pedir('GET', q, { token: ctx.admin })).datos.serial, a.datos.serial);
  await pedir('POST', '/api/equipos', {
    token: ctx.admin,
    cuerpo: {
      id_persona: persona.datos.id_persona,
      id_marca: marca.id_marca,
      modelo: 'ProBook 450',
      serial: a.datos.serial,
      id_estado: ctx.estados[0].id_estado,
    },
  });
  const b = await pedir('GET', q, { token: ctx.admin });
  assert.notEqual(b.datos.serial, a.datos.serial);
  assert.match(b.datos.serial, /^HP[A-HJ-NP-Z2-9]{3}$/);
  // Sin persona elegida también funciona, con el documento escrito.
  const c = await pedir(
    'GET',
    `/api/equipos/serial-generado?id_marca=${marca.id_marca}&documento=555`,
    { token: ctx.admin }
  );
  assert.match(c.datos.serial, /^H[A-HJ-NP-Z2-9]{4}$/);
  // El serial generado se lee con la pistola como cualquier otro.
  const lectura = await pedir('POST', '/api/registros/escanear', {
    token: ctx.admin,
    cuerpo: { codigo: JSON.stringify({ sistema: 'CheckIT', serial: a.datos.serial }) },
  });
  assert.equal(lectura.datos.requiereAccesorios, true);
});

test('serial generado: sin marca responde 400', async () => {
  const r = await pedir('GET', '/api/equipos/serial-generado?modelo=X', { token: ctx.admin });
  assert.equal(r.status, 400);
});

// ---------- Inactividad ----------
test('inactividad: detecta equipos y usuarios con más de un año sin uso, y solo Administrador o Super la ven', async () => {
  const viejo = await crearPersonaYEquipo('2001', 'VIEJO-001');
  const compartida = await crearPersonaYEquipo('2002', 'VIEJO-002');
  // La persona de VIEJO-002 tiene otro equipo reciente: no debe borrarse.
  const reciente = await pedir('POST', '/api/equipos', {
    token: ctx.admin,
    cuerpo: {
      id_persona: compartida.id_persona,
      id_marca: ctx.marcas[0].id_marca,
      serial: 'NUEVO-002',
      id_estado: ctx.estados[0].id_estado,
    },
  });
  assert.equal(reciente.status, 201);
  await pedir('POST', '/api/registros/escanear', {
    token: ctx.admin,
    cuerpo: { codigo: 'VIEJO-001', accesorios: [1] },
  });

  ctx.idOpViejo = await crearUsuario('opviejo');
  await iniciarSesion('opviejo', 'Clave2026x', 'opviejo@prueba.co'); // deja auditoría: se anonimiza
  ctx.idOpNunca = await crearUsuario('opnunca'); // nunca entró ni registró: se elimina
  ctx.idAdminViejo = await crearUsuario('adminviejo', 'Administrador');
  ctx.opNuevo = await crearUsuario('opnuevo');
  ctx.tokenOpNuevo = await iniciarSesion('opnuevo', 'Clave2026x', 'opnuevo@prueba.co');

  conBase((db) => {
    db.prepare(
      "UPDATE registros SET fecha_hora = datetime('now','-400 days') WHERE id_equipo = ?"
    ).run(viejo.id_equipo);
    db.prepare(
      "UPDATE equipos SET fecha_registro = datetime('now','-400 days') WHERE serial IN ('VIEJO-001','VIEJO-002')"
    ).run();
    db.prepare(
      "UPDATE auditoria SET fecha = datetime('now','-400 days') WHERE id_usuario IN (?, ?)"
    ).run(ctx.idOpViejo, ctx.idAdminViejo);
    db.prepare(
      "UPDATE usuarios SET fecha_creacion = datetime('now','-400 days') WHERE id_usuario IN (?, ?, ?)"
    ).run(ctx.idOpViejo, ctx.idOpNunca, ctx.idAdminViejo);
  });
  ctx.viejo = viejo;
  ctx.compartida = compartida;

  const r = await pedir('GET', '/api/inactividad', { token: ctx.admin });
  assert.equal(r.status, 200);
  assert.equal(r.datos.dias, 365);
  const eq = Object.fromEntries(r.datos.equipos.map((e) => [e.serial, e]));
  assert.deepEqual(Object.keys(eq).sort(), ['VIEJO-001', 'VIEJO-002']);
  assert.equal(eq['VIEJO-001'].se_borra_propietario, true);
  assert.equal(eq['VIEJO-002'].se_borra_propietario, false);
  assert.equal(eq['VIEJO-002'].nunca_usado, true);
  const us = Object.fromEntries(r.datos.usuarios.map((u) => [u.usuario, u]));
  assert.equal(us.opviejo.accion, 'anonimizar');
  assert.equal(us.opnunca.accion, 'eliminar');
  assert.ok(us.adminviejo, 'el Super ve también Administradores');
  assert.ok(!us.admin && !us.opnuevo && !us.sistema);

  assert.equal((await pedir('GET', '/api/inactividad', { token: ctx.tokenOpNuevo })).status, 403);
});

test('inactividad: un Administrador solo ve Operadores, nunca otros Administradores', async () => {
  const idAdm = await crearUsuario('admin2', 'Administrador');
  const token = await iniciarSesion('admin2', 'Clave2026x', 'admin2@prueba.co');
  const r = await pedir('GET', '/api/inactividad', { token });
  const nombres = r.datos.usuarios.map((u) => u.usuario);
  assert.ok(nombres.includes('opviejo') && !nombres.includes('adminviejo'));
  // Y no puede autorizar uno que no le corresponde.
  const x = await pedir('POST', '/api/inactividad/eliminar', {
    token,
    cuerpo: { usuarios: [ctx.idAdminViejo] },
  });
  assert.equal(x.status, 409);
  ctx.idAdmin2 = idAdm;
});

test('inactividad: al autorizar hace respaldo, borra equipos, movimientos y dueños sin equipos, anonimiza y audita', async () => {
  const r = await pedir('POST', '/api/inactividad/eliminar', {
    token: ctx.admin,
    cuerpo: {
      equipos: [ctx.viejo.id_equipo, ctx.compartida.id_equipo],
      usuarios: [ctx.idOpViejo, ctx.idOpNunca, ctx.opNuevo],
    },
  });
  assert.equal(r.status, 200, JSON.stringify(r.datos));
  assert.deepEqual(
    { ...r.datos, respaldo: undefined },
    {
      equipos: 2,
      personas: 1,
      usuarios_eliminados: 1,
      usuarios_anonimizados: 1,
      omitidos: 1,
      respaldo: undefined,
    }
  );
  // El respaldo previo existe y todavía contiene lo que se acaba de borrar.
  assert.ok(r.datos.respaldo);
  const copia = new Database(path.join(RESPALDOS, r.datos.respaldo), { readonly: true });
  assert.equal(
    copia.prepare("SELECT COUNT(*) FROM equipos WHERE serial = 'VIEJO-001'").pluck().get(),
    1
  );
  copia.close();

  conBase((db) => {
    assert.equal(
      db
        .prepare("SELECT COUNT(*) FROM equipos WHERE serial IN ('VIEJO-001','VIEJO-002')")
        .pluck()
        .get(),
      0
    );
    assert.equal(
      db
        .prepare('SELECT COUNT(*) FROM registros WHERE id_equipo = ?')
        .pluck()
        .get(ctx.viejo.id_equipo),
      0
    );
    assert.equal(
      db
        .prepare('SELECT COUNT(*) FROM personas WHERE id_persona = ?')
        .pluck()
        .get(ctx.viejo.id_persona),
      0
    );
    assert.equal(
      db
        .prepare('SELECT COUNT(*) FROM personas WHERE id_persona = ?')
        .pluck()
        .get(ctx.compartida.id_persona),
      1
    );
    const anon = db.prepare('SELECT * FROM usuarios WHERE id_usuario = ?').get(ctx.idOpViejo);
    assert.equal(anon.usuario, `eliminado_${ctx.idOpViejo}`);
    assert.equal(anon.anonimizado, 1);
    assert.equal(anon.estado, 0);
    assert.equal(anon.numero_documento, null);
    assert.equal(anon.celular, null);
    assert.ok(!anon.correo.includes('opviejo'));
    assert.equal(
      db.prepare('SELECT COUNT(*) FROM usuarios WHERE id_usuario = ?').pluck().get(ctx.idOpNunca),
      0
    );
    const aud = db
      .prepare(
        "SELECT descripcion FROM auditoria WHERE descripcion LIKE '%inactividad%' OR descripcion LIKE '%sin iniciar sesión%'"
      )
      .pluck()
      .all()
      .join('\n');
    assert.match(aud, /Equipo VIEJO-001 eliminado/);
    assert.match(aud, /anonimizada/);
    assert.doesNotMatch(aud, /2001|opviejo/); // sin documento ni usuario borrado
  });
  const lista = (await pedir('GET', '/api/usuarios', { token: ctx.admin })).datos.map(
    (u) => u.usuario
  );
  assert.ok(!lista.includes(`eliminado_${ctx.idOpViejo}`) && lista.includes('opnuevo'));
  // La cuenta anonimizada ya no puede entrar.
  assert.equal(
    (
      await pedir('POST', '/api/auth/login', {
        cuerpo: { usuario: 'opviejo', password: 'Clave2026x' },
      })
    ).status,
    401
  );
  // Ya no aparecen como candidatos.
  const otra = await pedir('GET', '/api/inactividad', { token: ctx.admin });
  assert.ok(!otra.datos.equipos.some((e) => e.serial.startsWith('VIEJO')));
});

// ---------- Visor de la base de datos ----------
test('visor: exige Super Administrador, contraseña y código; es de solo lectura y oculta secretos', async () => {
  assert.equal(
    (
      await pedir('POST', '/api/visor/solicitar', {
        token: ctx.tokenOpNuevo,
        cuerpo: { password: 'Clave2026x' },
      })
    ).status,
    403
  );
  assert.equal((await pedir('GET', '/api/visor/tablas', { token: ctx.admin })).status, 403);
  assert.equal(
    (
      await pedir('POST', '/api/visor/solicitar', {
        token: ctx.admin,
        cuerpo: { password: 'Incorrecta1' },
      })
    ).status,
    400
  );

  const sol = await pedir('POST', '/api/visor/solicitar', {
    token: ctx.admin,
    cuerpo: { password: ctx.pass },
  });
  assert.equal(sol.status, 200);
  const codigo = await codigoPara('checkit632@gmail.com', 'visor');
  assert.equal(
    (
      await pedir('POST', '/api/visor/verificar', {
        token: ctx.admin,
        cuerpo: { codigo: codigo === '000000' ? '111111' : '000000' },
      })
    ).status,
    400
  );
  const ver = await pedir('POST', '/api/visor/verificar', { token: ctx.admin, cuerpo: { codigo } });
  assert.equal(ver.status, 200);
  ctx.visor = ver.datos.token;
  // El código del visor no sirve para iniciar sesión.
  assert.equal(
    (await pedir('POST', '/api/auth/login/codigo', { cuerpo: { id_usuario: 1, codigo } })).status,
    401
  );

  const tablas = await pedir('GET', '/api/visor/tablas', { token: ctx.admin, visor: ctx.visor });
  assert.equal(tablas.status, 200);
  assert.equal(tablas.datos.length, 14);
  assert.ok(tablas.datos.find((t) => t.nombre === 'usuarios').filas >= 3);

  const usuarios = await pedir('GET', '/api/visor/tablas/usuarios?por_pagina=5', {
    token: ctx.admin,
    visor: ctx.visor,
  });
  assert.equal(usuarios.status, 200);
  assert.ok(usuarios.datos.filas.length <= 5 && usuarios.datos.total >= 3);
  assert.ok(usuarios.datos.filas.every((f) => f.password_hash === '•••••• (oculto)'));
  const codigos = await pedir('GET', '/api/visor/tablas/codigos_verificacion', {
    token: ctx.admin,
    visor: ctx.visor,
  });
  assert.ok(codigos.datos.filas.every((f) => f.codigo_hash === '•••••• (oculto)'));
  assert.equal(
    (
      await pedir('GET', '/api/visor/tablas/usuarios%22%3BDROP%20TABLE%20usuarios', {
        token: ctx.admin,
        visor: ctx.visor,
      })
    ).status,
    404
  );

  // El permiso del visor no le sirve a otra cuenta.
  const idAdm3 = await crearUsuario('superdos', 'Administrador');
  conBase((db) =>
    db
      .prepare(
        "UPDATE usuarios SET id_rol = (SELECT id_rol FROM roles WHERE nombre_rol = 'Super Administrador') WHERE id_usuario = ?"
      )
      .run(idAdm3)
  );
  const tokenSuper2 = await iniciarSesion('superdos', 'Clave2026x', 'superdos@prueba.co');
  assert.equal(
    (await pedir('GET', '/api/visor/tablas', { token: tokenSuper2, visor: ctx.visor })).status,
    403
  );

  conBase((db) => {
    const a = db
      .prepare(
        "SELECT accion, descripcion FROM auditoria WHERE tabla_afectada = 'visor_bd' ORDER BY id_auditoria"
      )
      .all();
    assert.ok(a.some((x) => x.accion === 'SISTEMA' && /Acceso al visor/.test(x.descripcion)));
    assert.ok(a.filter((x) => x.accion === 'LOGIN_FALLIDO').length >= 2);
  });
});

test('visor: código de contingencia con "npm run codigo -- admin visor"', async () => {
  await pedir('POST', '/api/visor/solicitar', { token: ctx.admin, cuerpo: { password: ctx.pass } });
  const salida = execFileSync(
    process.execPath,
    ['scripts/codigo-contingencia.js', 'admin', 'visor'],
    { cwd: BACKEND, env: ENV, encoding: 'utf8' }
  );
  const codigo = salida.match(/admin: (\d{6})/)[1];
  assert.equal(
    (await pedir('POST', '/api/visor/verificar', { token: ctx.admin, cuerpo: { codigo } })).status,
    200
  );
  assert.throws(() =>
    execFileSync(process.execPath, ['scripts/codigo-contingencia.js', 'opnuevo', 'visor'], {
      cwd: BACKEND,
      env: ENV,
      stdio: 'pipe',
    })
  );
});

// ---------- Migración desde 6.11 ----------
test('migración: una base de la 6.11 recibe la columna anonimizado y el tipo visor_bd sin perder códigos', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'checkit-mig-'));
  const ruta = path.join(dir, 'db', 'checkit.db');
  fs.mkdirSync(path.dirname(ruta));
  const vieja = new Database(ruta);
  vieja.exec(`
    CREATE TABLE usuarios (id_usuario INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, apellidos TEXT NOT NULL,
      correo TEXT NOT NULL UNIQUE, celular TEXT, id_tipo_documento INTEGER, numero_documento TEXT, password_hash TEXT NOT NULL, id_rol INTEGER NOT NULL,
      estado INTEGER DEFAULT 1, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE codigos_verificacion (id_codigo INTEGER PRIMARY KEY AUTOINCREMENT, id_usuario INTEGER NOT NULL, codigo_hash TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK (tipo IN ('reset_password','login_2fa')), expira DATETIME NOT NULL, usado INTEGER NOT NULL DEFAULT 0,
      intentos INTEGER NOT NULL DEFAULT 0, fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario));
    INSERT INTO usuarios (usuario, nombre, apellidos, correo, password_hash, id_rol) VALUES ('viejo', 'V', 'V', 'v@v.co', 'x', 1);
    INSERT INTO codigos_verificacion (id_usuario, codigo_hash, tipo, expira) VALUES (1, 'h', 'login_2fa', '2030-01-01');
  `);
  vieja.close();
  execFileSync(process.execPath, ['-e', "require('./db/database')"], {
    cwd: BACKEND,
    env: { ...ENV, CHECKIT_DB_PATH: ruta },
    stdio: 'pipe',
  });
  const db = new Database(ruta, { readonly: true });
  try {
    assert.match(
      db.prepare("SELECT sql FROM sqlite_master WHERE name = 'codigos_verificacion'").pluck().get(),
      /visor_bd/
    );
    assert.equal(db.prepare('SELECT COUNT(*) FROM codigos_verificacion').pluck().get(), 1);
    assert.ok(
      db
        .prepare('PRAGMA table_info(usuarios)')
        .all()
        .some((c) => c.name === 'anonimizado')
    );
    assert.equal(db.pragma('foreign_key_check').length, 0);
  } finally {
    db.close();
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
  }
});

// ---------- Marca "Otra" ----------
test('marca nueva: cualquier rol la agrega, no se duplica con otras mayúsculas y se usa en un equipo', async () => {
  const nueva = await pedir('POST', '/api/catalogos/marcas', {
    token: ctx.tokenOpNuevo,
    cuerpo: { nombre_marca: '  Compumax   Ñandú ' },
  });
  assert.equal(nueva.status, 201, JSON.stringify(nueva.datos));
  assert.equal(nueva.datos.nombre_marca, 'Compumax Ñandú');

  const repetida = await pedir('POST', '/api/catalogos/marcas', {
    token: ctx.admin,
    cuerpo: { nombre_marca: 'COMPUMAX ñANDÚ' },
  });
  assert.equal(repetida.status, 200);
  assert.equal(repetida.datos.existia, true);
  assert.equal(repetida.datos.id_marca, nueva.datos.id_marca);
  assert.equal(
    (
      await pedir('POST', '/api/catalogos/marcas', {
        token: ctx.admin,
        cuerpo: { nombre_marca: 'hp' },
      })
    ).datos.existia,
    true
  );

  for (const malo of ['', 'x', '<script>', 'a'.repeat(41)]) {
    const r = await pedir('POST', '/api/catalogos/marcas', {
      token: ctx.admin,
      cuerpo: { nombre_marca: malo },
    });
    assert.equal(r.status, 400, malo);
  }
  assert.equal(
    (await pedir('POST', '/api/catalogos/marcas', { cuerpo: { nombre_marca: 'Sin Sesion' } }))
      .status,
    401
  );

  const marcas = (await pedir('GET', '/api/catalogos/marcas', { token: ctx.admin })).datos;
  assert.equal(marcas.filter((m) => m.nombre_marca.toLowerCase() === 'compumax ñandú').length, 1);

  const persona = await pedir('POST', '/api/personas', {
    token: ctx.tokenOpNuevo,
    cuerpo: {
      id_tipo_documento: ctx.tipos[0].id_tipo_documento,
      numero_documento: '3001',
      nombres: 'Luz',
      apellidos: 'Mora',
    },
  });
  const equipo = await pedir('POST', '/api/equipos', {
    token: ctx.tokenOpNuevo,
    cuerpo: {
      id_persona: persona.datos.id_persona,
      id_marca: nueva.datos.id_marca,
      serial: 'MARCA-NUEVA-1',
      id_estado: ctx.estados[0].id_estado,
    },
  });
  assert.equal(equipo.status, 201);
  const serial = await pedir(
    'GET',
    `/api/equipos/serial-generado?id_marca=${nueva.datos.id_marca}&documento=3001`,
    { token: ctx.admin }
  );
  assert.match(serial.datos.serial, /^C[A-HJ-NP-Z2-9]{4}$/);
  conBase((db) => {
    assert.ok(
      db
        .prepare(
          "SELECT 1 FROM auditoria WHERE tabla_afectada = 'marcas' AND descripcion LIKE '%Compumax Ñandú%'"
        )
        .get()
    );
  });
});
