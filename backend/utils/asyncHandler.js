// H-06: envuelve un manejador de ruta para que cualquier excepción (síncrona
// o de una promesa rechazada) llegue al middleware central de errores
// (middleware/errorHandler.js) en vez de quedar sin atender. Express 4
// captura solo los errores síncronos; los de funciones async se perderían.
const asyncHandler = (fn) => (req, res, next) => {
  try {
    Promise.resolve(fn(req, res, next)).catch(next);
  } catch (err) {
    next(err);
  }
};

module.exports = asyncHandler;
