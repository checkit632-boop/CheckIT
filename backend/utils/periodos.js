// Condiciones SQL de "hoy / esta semana / este mes" escritas como RANGOS
// (columna >= inicio AND columna < fin) en vez de aplicar date()/strftime()
// a cada fila. Con una función sobre la columna SQLite no puede usar el
// índice y recorre toda la tabla; con un rango sí lo usa.
//
// Cada función es equivalente a la condición que reemplaza, incluida la zona
// horaria de cada columna:
// - registros.fecha_hora de los movimientos manuales se guarda en hora local
//   de Bogotá (routes/registros.js), así que se compara con límites locales.
// - auditoria.fecha (y el Dashboard, que aplica 'localtime' a la columna) se
//   tratan como UTC: los límites locales se convierten a UTC con 'utc'.

// Límites [inicio, fin) del período en hora local, como expresiones SQL.
// La semana va de lunes a domingo y, como strftime('%Y-%W'), no cruza el
// cambio de año: se recorta al 1 de enero / 1 de enero siguiente.
function limitesLocales(periodo) {
  switch (periodo) {
    case 'semana':
      return [
        "max(date('now','localtime','weekday 0','-6 days'), date('now','localtime','start of year'))",
        "min(date('now','localtime','weekday 0','+1 day'), date('now','localtime','start of year','+1 year'))",
      ];
    case 'mes':
      return ["date('now','localtime','start of month')", "date('now','localtime','start of month','+1 month')"];
    case 'dia':
    default:
      return ["date('now','localtime')", "date('now','localtime','+1 day')"];
  }
}

// Para columnas guardadas en hora local (equivale a date(col) = hoy).
function rangoLocal(columna, periodo = 'dia') {
  const [inicio, fin] = limitesLocales(periodo);
  return `${columna} >= ${inicio} AND ${columna} < ${fin}`;
}

// Para columnas guardadas en UTC (equivale a date(col,'localtime') = hoy).
function rangoUtc(columna, periodo = 'dia') {
  const [inicio, fin] = limitesLocales(periodo);
  return `${columna} >= datetime(${inicio}, 'utc') AND ${columna} < datetime(${fin}, 'utc')`;
}

module.exports = { rangoLocal, rangoUtc };
