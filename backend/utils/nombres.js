// Formato de nombres y apellidos de las personas (v7.0, pedido de portería):
// cada palabra con la primera letra en mayúscula y las demás en minúscula,
// sin importar cómo se escribió ("ana MARÍA  pérez" -> "Ana María Pérez").
// - Respeta tildes y ñ ("ÑUSTES" -> "Ñustes").
// - También después de guion o apóstrofo ("maría-josé" -> "María-José").
// - Las partículas intermedias se dejan en minúscula, como se escriben en
//   español ("maría DE LOS ángeles" -> "María de los Ángeles"); si una de
//   ellas va primera, sí lleva mayúscula.
// La misma regla está en frontend/src/utils/nombres.js para mostrarla al
// escribir; la que vale es la del servidor, que se aplica al guardar.
const PARTICULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'los',
  'y',
  'e',
  'da',
  'do',
  'dos',
  'van',
  'von',
]);

function formatoNombre(texto) {
  const limpio = String(texto ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('es');
  return limpio
    .split(' ')
    .map((palabra, i) =>
      i > 0 && PARTICULAS.has(palabra)
        ? palabra
        : palabra.replace(
            /(^|[-'’])(\p{L})/gu,
            (m, sep, letra) => sep + letra.toLocaleUpperCase('es')
          )
    )
    .join(' ');
}

module.exports = { formatoNombre };
