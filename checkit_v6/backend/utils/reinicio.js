// Reinicio operativo diario (pensado para las 11:59 p.m.).
//
// No borra ningún registro histórico. Lo que sí hace:
//   1. A cada equipo que sigue "Adentro" (nunca registró su salida) se le
//      crea automáticamente un registro de Salida, autorado por la cuenta
//      interna "sistema" — así "Equipos Dentro" arranca el nuevo día en 0
//      y no queda un hueco sin cierre en el historial de ese equipo.
//   2. Deja constancia en la auditoría de cuántos equipos se cerraron así.
//
// Se puede disparar de dos formas (ambas conviven sin problema, ver nota
// de idempotencia más abajo):
//   a) Automáticamente desde server.js, mientras el backend esté corriendo.
//   b) Como tarea programada de Windows, corriendo scripts/reinicio.js —
//      esta no depende de que el backend esté encendido en ese momento.
//
// Nota de idempotencia: si por cualquier motivo se ejecuta dos veces el
// mismo día (por ejemplo, el backend estaba corriendo a las 11:59 p.m. Y
// además hay una tarea programada a esa misma hora), no pasa nada raro —
// la segunda vez ya no va a encontrar ningún equipo "Adentro" para cerrar
// (el primer run ya los cerró todos), así que simplemente no hace nada.
const db = require('../db/database');

function ejecutarReinicioOperativo() {
  const idSistema = db.prepare("SELECT id_usuario FROM usuarios WHERE usuario = 'sistema'").get()?.id_usuario;
  const idSalida = db.prepare("SELECT id_tipo_movimiento FROM tipos_movimiento WHERE nombre_movimiento = 'Salida'").get()?.id_tipo_movimiento;

  let cerrados = 0;

  if (idSistema && idSalida) {
    const equipos = db.prepare('SELECT id_equipo FROM equipos').all();
    const ultimoMovimiento = db.prepare(`
      SELECT tm.nombre_movimiento
      FROM registros r
      JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
      WHERE r.id_equipo = ?
      ORDER BY r.fecha_hora DESC, r.id_registro DESC
      LIMIT 1
    `);
    const insertarSalida = db.prepare(`
      INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento)
      VALUES (?, ?, ?)
    `);

    for (const { id_equipo } of equipos) {
      const ultimo = ultimoMovimiento.get(id_equipo);
      if (ultimo && ultimo.nombre_movimiento === 'Entrada') {
        insertarSalida.run(id_equipo, idSistema, idSalida);
        cerrados++;
      }
    }
  }

  db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (NULL, 'SISTEMA', 'registros', ?)`)
    .run(`Reinicio operativo diario — se registraron ${cerrados} salida(s) automática(s) (equipos que seguían "Adentro"). No se eliminó ningún dato.`);

  return cerrados;
}

module.exports = { ejecutarReinicioOperativo };
