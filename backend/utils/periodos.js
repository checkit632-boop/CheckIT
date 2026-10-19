// Fechas y zona horaria de CheckIT: el único lugar que sabe de zonas.
//
// Regla (auditoría, punto 3.2): toda fecha se GUARDA en UTC
// (CURRENT_TIMESTAMP, formato 'AAAA-MM-DD HH:MM:SS') y se CONVIERTE a la hora
// de Colombia solo al entregarla a la interfaz (aHoraLocal) o al calcular
// "hoy / esta semana / este mes" (rangoUtc). Antes los movimientos manuales
// se guardaban en hora de Bogotá y los cierres automáticos en UTC, y cada
// pantalla los interpretaba distinto.
//
// Se usa el desfase fijo de Colombia (UTC-5, sin horario de verano) en vez
// de 'localtime', para que el resultado no dependa de la zona horaria con
// la que esté configurado el servidor donde se instale el sistema.

const OFFSET_POR_DEFECTO = -5;
const offsetConfigurado = Number(process.env.ZONA_HORARIA_OFFSET);
const OFFSET_HORAS =
  Number.isInteger(offsetConfigurado) && offsetConfigurado >= -12 && offsetConfigurado <= 14
    ? offsetConfigurado
    : OFFSET_POR_DEFECTO;

// Modificadores de SQLite para pasar de UTC a local y de local a UTC.
const A_LOCAL = `'${OFFSET_HORAS >= 0 ? '+' : ''}${OFFSET_HORAS} hours'`;
const A_UTC = `'${-OFFSET_HORAS >= 0 ? '+' : ''}${-OFFSET_HORAS} hours'`;

// Expresión SQL: la columna (UTC) en hora local, para devolverla a la interfaz.
function aHoraLocal(columna) {
  return `datetime(${columna}, ${A_LOCAL})`;
}

// Límites [inicio, fin) del período en hora local, como expresiones SQL.
// La semana va de lunes a domingo y no cruza el cambio de año (igual que
// strftime('%Y-%W'), que era la regla anterior).
function limitesLocales(periodo) {
  const hoy = `'now', ${A_LOCAL}`;
  switch (periodo) {
    case 'semana':
      return [
        `max(date(${hoy}, 'weekday 0', '-6 days'), date(${hoy}, 'start of year'))`,
        `min(date(${hoy}, 'weekday 0', '+1 day'), date(${hoy}, 'start of year', '+1 year'))`,
      ];
    case 'mes':
      return [`date(${hoy}, 'start of month')`, `date(${hoy}, 'start of month', '+1 month')`];
    case 'dia':
    default:
      return [`date(${hoy})`, `date(${hoy}, '+1 day')`];
  }
}

// Condición "la columna (UTC) cae en el período local", como rango para que
// SQLite use el índice de la columna.
function rangoUtc(columna, periodo = 'dia') {
  const [inicio, fin] = limitesLocales(periodo);
  return `${columna} >= datetime(${inicio}, ${A_UTC}) AND ${columna} < datetime(${fin}, ${A_UTC})`;
}

// Condición para un período entre dos fechas locales 'AAAA-MM-DD' (ambas
// incluidas) que llegan como parámetros (?, ?): desde y hasta, en ese orden.
function rangoEntreFechasLocales(columna) {
  return `${columna} >= datetime(?, ${A_UTC}) AND ${columna} < datetime(date(?, '+1 day'), ${A_UTC})`;
}

module.exports = { aHoraLocal, rangoUtc, rangoEntreFechasLocales, OFFSET_HORAS };
