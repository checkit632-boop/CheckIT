// NC-8: helper de formato de fecha extraído de EntradasSalidas.jsx para que
// ese archivo deje de mezclar utilidades genéricas con la UI del módulo.
// Soporta fechas con formato ISO ("YYYY-MM-DDTHH:mm:ss") o SQLite
// ("YYYY-MM-DD HH:mm:ss").
export function fmtHora(fechaStr) {
  if (!fechaStr) return '—';

  let limpia = fechaStr.replace('T', ' ');
  if (limpia.includes('.')) limpia = limpia.split('.')[0];
  if (limpia.includes('-') && limpia.split('-').length > 3) {
    limpia = limpia.substring(0, 19);
  }

  const partes = limpia.split(' ');
  if (partes.length < 2) return fechaStr;

  const [fecha, hora] = partes;
  const [year, month, day] = fecha.split('-');
  let [hours, minutes] = hora.split(':');

  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;

  return `${day}/${month}/${year.slice(2)}, ${h}:${minutes} ${ampm}`;
}
