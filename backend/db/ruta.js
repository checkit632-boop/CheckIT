// Ruta del archivo de la base de datos. Por defecto, backend/db/checkit.db.
// CHECKIT_DB_PATH permite usar otro archivo; lo usan las pruebas
// automáticas (npm test) para trabajar con una base temporal y nunca tocar
// la real. La comparten la API, el respaldo y los scripts.
const path = require('path');

module.exports = process.env.CHECKIT_DB_PATH
  ? path.resolve(process.env.CHECKIT_DB_PATH)
  : path.join(__dirname, 'checkit.db');
