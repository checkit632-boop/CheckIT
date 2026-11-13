// Limpieza de datos sin uso (v7.0, pedido de portería).
//
// El sistema detecta, pero NUNCA elimina solo: un Administrador o el Super
// Administrador lo autoriza desde la alerta que ve al iniciar sesión.
// - Equipo inactivo: sin entradas ni salidas en 365 días (o, si nunca tuvo
//   movimientos, registrado hace más de 365 días). Al autorizar se borran el
//   equipo, sus movimientos y sus accesorios; si la persona dueña queda sin
//   equipos, también sus datos personales.
// - Usuario inactivo: sin iniciar sesión en 365 días (o creado hace más de
//   365 días sin haber entrado nunca). Si nunca registró nada, se elimina.
//   Si tiene movimientos o auditoría, se ANONIMIZA: se borran sus datos
//   personales y queda como "eliminado_N" solo para que el historial siga
//   diciendo quién hizo cada cosa.
// Cada quien solo ve y autoriza lo que su rol puede gestionar (utils/roles),
// nunca su propia cuenta ni la cuenta interna "sistema". Antes de borrar se
// genera un respaldo; si el respaldo falla, no se borra nada. Cada acción
// queda en la auditoría.
const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const asyncHandler = require('../utils/asyncHandler');
const { aHoraLocal } = require('../utils/periodos');
const { rolesGestionables } = require('../utils/roles');
const { ejecutarRespaldo, obtenerDestinos } = require('../utils/backup');
const { authRequired, requireRole, ROL_ADMIN, ROL_SUPER } = require('../middleware/auth');

const router = express.Router();
router.use(authRequired, requireRole(ROL_ADMIN, ROL_SUPER));

// Configurable solo para pruebas; en operación es un año.
const DIAS = Number(process.env.INACTIVIDAD_DIAS) > 0 ? Number(process.env.INACTIVIDAD_DIAS) : 365;
const LIMITE = `datetime('now', '-${DIAS} days')`;
const MAX_POR_SOLICITUD = 500;

function equiposInactivos() {
  return db
    .prepare(
      `
    SELECT * FROM (
      SELECT e.id_equipo, e.serial, e.modelo, m.nombre_marca, e.id_persona,
             p.nombres AS persona_nombres, p.apellidos AS persona_apellidos,
             (SELECT MAX(r.fecha_hora) FROM registros r WHERE r.id_equipo = e.id_equipo) AS ultimo_utc,
             e.fecha_registro AS registro_utc,
             (SELECT COUNT(*) FROM registros r WHERE r.id_equipo = e.id_equipo) AS movimientos,
             (SELECT COUNT(*) FROM equipos e2 WHERE e2.id_persona = e.id_persona AND e2.id_equipo <> e.id_equipo) AS otros_equipos
      FROM equipos e
      JOIN marcas m ON m.id_marca = e.id_marca
      JOIN personas p ON p.id_persona = e.id_persona
    ) x
    WHERE COALESCE(x.ultimo_utc, x.registro_utc) < ${LIMITE}
    ORDER BY COALESCE(x.ultimo_utc, x.registro_utc)
  `
    )
    .all()
    .map((e) => ({
      id_equipo: e.id_equipo,
      serial: e.serial,
      modelo: e.modelo,
      nombre_marca: e.nombre_marca,
      propietario: `${e.persona_nombres} ${e.persona_apellidos}`,
      ultimo_uso: db.prepare(`SELECT ${aHoraLocal('?')} AS f`).get(e.ultimo_utc || e.registro_utc)
        .f,
      nunca_usado: !e.ultimo_utc,
      movimientos: e.movimientos,
      se_borra_propietario: e.otros_equipos === 0,
    }));
}

function usuariosInactivos(usuarioActual) {
  const roles = rolesGestionables(usuarioActual.rol);
  if (roles.length === 0) return [];
  return db
    .prepare(
      `
    SELECT * FROM (
      SELECT u.id_usuario, u.usuario, u.nombre, u.apellidos, r.nombre_rol,
             (SELECT MAX(a.fecha) FROM auditoria a WHERE a.id_usuario = u.id_usuario AND a.accion = 'LOGIN') AS ultimo_utc,
             u.fecha_creacion AS creacion_utc,
             (SELECT COUNT(*) FROM registros rg WHERE rg.id_usuario = u.id_usuario) AS movimientos,
             (SELECT COUNT(*) FROM auditoria a WHERE a.id_usuario = u.id_usuario) AS auditorias
      FROM usuarios u JOIN roles r ON r.id_rol = u.id_rol
      WHERE u.usuario <> 'sistema' AND u.anonimizado = 0 AND u.id_usuario <> ?
        AND r.nombre_rol IN (${roles.map(() => '?').join(',')})
    ) x
    WHERE COALESCE(x.ultimo_utc, x.creacion_utc) < ${LIMITE}
    ORDER BY COALESCE(x.ultimo_utc, x.creacion_utc)
  `
    )
    .all(usuarioActual.id_usuario, ...roles)
    .map((u) => ({
      id_usuario: u.id_usuario,
      usuario: u.usuario,
      nombre: `${u.nombre} ${u.apellidos}`,
      rol: u.nombre_rol,
      ultimo_acceso: db
        .prepare(`SELECT ${aHoraLocal('?')} AS f`)
        .get(u.ultimo_utc || u.creacion_utc).f,
      nunca_entro: !u.ultimo_utc,
      movimientos: u.movimientos,
      accion: u.movimientos > 0 || u.auditorias > 0 ? 'anonimizar' : 'eliminar',
    }));
}

// GET /api/inactividad — lo que este usuario puede autorizar eliminar.
router.get(
  '/',
  asyncHandler((req, res) => {
    res.json({ dias: DIAS, equipos: equiposInactivos(), usuarios: usuariosInactivos(req.user) });
  })
);

const idsValidos = (lista) =>
  Array.isArray(lista) &&
  lista.length <= MAX_POR_SOLICITUD &&
  lista.every((n) => Number.isInteger(n) && n > 0);

// POST /api/inactividad/eliminar { equipos: [ids], usuarios: [ids] }
// Solo actúa sobre los ids que SIGUEN siendo candidatos para este usuario en
// este momento (se recalcula aquí, no se confía en lo que envía la pantalla).
router.post(
  '/eliminar',
  asyncHandler(async (req, res) => {
    const pedidosEquipos = req.body?.equipos ?? [];
    const pedidosUsuarios = req.body?.usuarios ?? [];
    if (!idsValidos(pedidosEquipos) || !idsValidos(pedidosUsuarios)) {
      return res.status(400).json({ error: 'La lista de equipos o usuarios no es válida.' });
    }

    const candEquipos = new Map(equiposInactivos().map((e) => [e.id_equipo, e]));
    const candUsuarios = new Map(usuariosInactivos(req.user).map((u) => [u.id_usuario, u]));
    const equipos = pedidosEquipos
      .filter((id) => candEquipos.has(id))
      .map((id) => candEquipos.get(id));
    const usuarios = pedidosUsuarios
      .filter((id) => candUsuarios.has(id))
      .map((id) => candUsuarios.get(id));
    const omitidos =
      pedidosEquipos.length + pedidosUsuarios.length - equipos.length - usuarios.length;
    if (equipos.length + usuarios.length === 0) {
      return res
        .status(409)
        .json({
          error:
            'Ninguno de los elementos elegidos se puede eliminar (ya no está inactivo o tu rol no lo permite).',
        });
    }

    // Respaldo previo: si está configurado y falla, no se borra nada.
    let respaldo = null;
    if (obtenerDestinos().length > 0) {
      respaldo = await ejecutarRespaldo().catch((err) => ({ ok: false, error: err.message }));
      if (!respaldo.ok) {
        return res
          .status(500)
          .json({ error: `No se eliminó nada: falló el respaldo previo (${respaldo.error}).` });
      }
    }

    const auditar = db.prepare(
      `INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (?, ?, ?, ?)`
    );
    let personasBorradas = 0;
    db.transaction(() => {
      for (const e of equipos) {
        const persona = db
          .prepare('SELECT id_persona FROM equipos WHERE id_equipo = ?')
          .get(e.id_equipo);
        db.prepare(
          'DELETE FROM registro_accesorios WHERE id_registro IN (SELECT id_registro FROM registros WHERE id_equipo = ?)'
        ).run(e.id_equipo);
        const movs = db
          .prepare('DELETE FROM registros WHERE id_equipo = ?')
          .run(e.id_equipo).changes;
        db.prepare('DELETE FROM equipos WHERE id_equipo = ?').run(e.id_equipo);
        let borroPersona = false;
        if (
          persona &&
          !db.prepare('SELECT 1 FROM equipos WHERE id_persona = ?').get(persona.id_persona)
        ) {
          db.prepare('DELETE FROM personas WHERE id_persona = ?').run(persona.id_persona);
          borroPersona = true;
          personasBorradas++;
        }
        // Sin nombres ni documentos: la auditoría se conserva y no debe guardar
        // los datos personales que se están eliminando.
        auditar.run(
          req.user.id_usuario,
          'DELETE',
          'equipos',
          `Equipo ${e.serial} eliminado por ${DIAS} días de inactividad, con ${movs} movimiento(s)${borroPersona ? '; la persona dueña no tenía otros equipos y sus datos se eliminaron' : ''}. Autorizó ${req.user.usuario}.`
        );
      }

      for (const u of usuarios) {
        const actual = db
          .prepare('SELECT usuario FROM usuarios WHERE id_usuario = ?')
          .get(u.id_usuario);
        db.prepare('DELETE FROM codigos_verificacion WHERE id_usuario = ?').run(u.id_usuario);
        db.prepare('DELETE FROM login_intentos WHERE usuario = ?').run(actual.usuario);
        if (u.accion === 'eliminar') {
          db.prepare('DELETE FROM usuarios WHERE id_usuario = ?').run(u.id_usuario);
          auditar.run(
            req.user.id_usuario,
            'DELETE',
            'usuarios',
            `Cuenta #${u.id_usuario} (${u.rol}) eliminada por ${DIAS} días sin iniciar sesión; no tenía historial. Autorizó ${req.user.usuario}.`
          );
        } else {
          db.prepare(
            `
          UPDATE usuarios SET usuario = ?, nombre = 'Usuario', apellidos = 'eliminado', correo = ?,
                 celular = NULL, id_tipo_documento = NULL, numero_documento = NULL,
                 password_hash = ?, estado = 0, anonimizado = 1
          WHERE id_usuario = ?
        `
          ).run(
            `eliminado_${u.id_usuario}`,
            `eliminado_${u.id_usuario}@checkit.local`,
            bcrypt.hashSync(crypto.randomBytes(24).toString('hex'), 10),
            u.id_usuario
          );
          auditar.run(
            req.user.id_usuario,
            'UPDATE',
            'usuarios',
            `Cuenta #${u.id_usuario} (${u.rol}) anonimizada por ${DIAS} días sin iniciar sesión: se borraron sus datos personales y se conserva como eliminado_${u.id_usuario} en el historial. Autorizó ${req.user.usuario}.`
          );
        }
      }
    })();

    res.json({
      equipos: equipos.length,
      personas: personasBorradas,
      usuarios_eliminados: usuarios.filter((u) => u.accion === 'eliminar').length,
      usuarios_anonimizados: usuarios.filter((u) => u.accion === 'anonimizar').length,
      omitidos,
      respaldo: respaldo?.archivo || null,
    });
  })
);

module.exports = router;
