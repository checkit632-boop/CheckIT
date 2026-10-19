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

  // Una sola transacción para todo el cierre: antes era una consulta y una
  // escritura a disco por cada equipo, y si el proceso fallaba a la mitad
  // quedaban unos equipos cerrados y otros no, sin su registro de auditoría.
  // Ahora se cierran todos (con su auditoría) o ninguno. "Adentro" se decide
  // igual que en el resto del sistema: el último movimiento por id_registro
  // es una entrada (idx_registros_equipo).
  const cerrar = db.transaction(() => {
    let cerrados = 0;
    if (idSistema && idSalida) {
      cerrados = db.prepare(`
        INSERT INTO registros (id_equipo, id_usuario, id_tipo_movimiento)
        SELECT e.id_equipo, ?, ?
        FROM equipos e
        JOIN registros r ON r.id_registro = (SELECT MAX(id_registro) FROM registros WHERE id_equipo = e.id_equipo)
        JOIN tipos_movimiento tm ON tm.id_tipo_movimiento = r.id_tipo_movimiento
        WHERE tm.nombre_movimiento = 'Entrada'
      `).run(idSistema, idSalida).changes;
    }

    db.prepare(`INSERT INTO auditoria (id_usuario, accion, tabla_afectada, descripcion) VALUES (NULL, 'SISTEMA', 'registros', ?)`)
      .run(`Reinicio operativo diario — se registraron ${cerrados} salida(s) automática(s) (equipos que seguían "Adentro"). No se eliminó ningún dato.`);
    return cerrados;
  });

  return cerrar();
}


module.exports = { ejecutarReinicioOperativo };
