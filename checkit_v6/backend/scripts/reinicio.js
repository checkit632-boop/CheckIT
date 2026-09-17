// Ejecuta el reinicio operativo manualmente, o desde una tarea programada
// de Windows (independiente de que el backend esté corriendo):
//   cd backend
//   npm run reinicio
require('dotenv').config();
const { ejecutarReinicioOperativo } = require('../utils/reinicio');

try {
  const cerrados = ejecutarReinicioOperativo();
  console.log(`🔄 Reinicio operativo ejecutado — ${cerrados} equipo(s) cerrado(s) automáticamente.`);
  process.exit(0);
} catch (err) {
  console.error('✖ Error ejecutando el reinicio operativo:', err.message);
  process.exit(1);
}
