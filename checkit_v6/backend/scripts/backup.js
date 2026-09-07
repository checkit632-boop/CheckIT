// Ejecuta un respaldo de la base de datos manualmente, desde la terminal:
//   cd backend
//   npm run backup
require('dotenv').config();
const { ejecutarRespaldo } = require('../utils/backup');

ejecutarRespaldo()
  .then((resultado) => {
    if (!resultado.ok) {
      console.error('✖ No se pudo generar el respaldo:', resultado.error);
      process.exit(1);
    }
    console.log(`✔ Respaldo "${resultado.archivo}" guardado en:`);
    resultado.destinos.forEach((d) => console.log(`   - ${d}`));
    if (resultado.fallidosEn?.length) {
      resultado.fallidosEn.forEach((f) => console.warn(`   ⚠ Falló en ${f.carpeta}: ${f.error}`));
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('✖ Error inesperado al respaldar:', err.message);
    process.exit(1);
  });
