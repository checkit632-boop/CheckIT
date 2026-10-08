// H-06: manejo centralizado de errores. Traduce los fallos conocidos a una
// respuesta que le dice al cliente qué corregir (4xx) y deja el 500 solo para
// las caídas reales del servidor. Debe registrarse en server.js DESPUÉS de
// todas las rutas.

// Códigos extendidos de better-sqlite3 -> respuesta HTTP.
const ERRORES_SQLITE = {
  SQLITE_CONSTRAINT_UNIQUE: [409, 'El registro ya existe (hay un valor repetido que debe ser único).'],
  SQLITE_CONSTRAINT_PRIMARYKEY: [409, 'El registro ya existe.'],
  SQLITE_CONSTRAINT_FOREIGNKEY: [409, 'La operación entra en conflicto con datos relacionados (referencia inexistente o registro en uso).'],
  SQLITE_CONSTRAINT_NOTNULL: [400, 'Falta un campo obligatorio.'],
  SQLITE_CONSTRAINT_CHECK: [400, 'Uno de los valores enviados no es válido.'],
  SQLITE_BUSY: [503, 'La base de datos está ocupada. Intenta de nuevo en unos segundos.'],
  SQLITE_LOCKED: [503, 'La base de datos está ocupada. Intenta de nuevo en unos segundos.'],
};

// eslint-disable-next-line no-unused-vars -- Express reconoce el manejador de errores por sus 4 parámetros.
function errorHandler(err, req, res, next) {
  // Cuerpo JSON mal formado: es un error de quien llama, no del servidor.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }

  const conocido = ERRORES_SQLITE[err.code];
  if (conocido) {
    const [status, mensaje] = conocido;
    console.warn(`[CheckIT] ${req.method} ${req.originalUrl} -> ${status} (${err.code}): ${err.message}`);
    return res.status(status).json({ error: mensaje });
  }

  console.error(`[CheckIT] ${req.method} ${req.originalUrl} -> 500:`, err);
  res.status(500).json({ error: 'Error interno del servidor.' });
}

module.exports = errorHandler;
