// Formato de nombres y apellidos (v7.0): mayúscula inicial en cada palabra y
// el resto en minúscula ("ana MARÍA" -> "Ana María"), con las partículas
// intermedias en minúscula ("de", "del", "la"…). Es la misma regla de
// backend/utils/nombres.js, que es la que vale al guardar; aquí solo se
// aplica al salir del campo para que se vea el resultado.
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

export function formatoNombre(texto) {
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
