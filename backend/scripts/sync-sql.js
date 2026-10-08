// H-14: database/Script_checkIt.sql (entregable académico) debe ser idéntico
// al esquema que realmente ejecuta el servidor (backend/db/schema.sql).
//
//   npm run sql:sync    copia schema.sql -> database/Script_checkIt.sql
//   npm run sql:check   falla (código 1) si los dos archivos difieren
//
// Se comparan normalizando los saltos de línea, para que CRLF/LF de Windows
// no cuente como diferencia.
const path = require('path');
const fs = require('fs');

const ORIGEN = path.join(__dirname, '../db/schema.sql');
const DESTINO = path.join(__dirname, '../../database/Script_checkIt.sql');

const normalizar = (texto) => texto.replace(/\r\n/g, '\n');
const esquema = normalizar(fs.readFileSync(ORIGEN, 'utf8'));

if (process.argv.includes('--check')) {
  const entregado = fs.existsSync(DESTINO) ? normalizar(fs.readFileSync(DESTINO, 'utf8')) : '';
  if (entregado !== esquema) {
    console.error('✖ database/Script_checkIt.sql no coincide con backend/db/schema.sql. Ejecuta: npm run sql:sync');
    process.exit(1);
  }
  console.log('✔ database/Script_checkIt.sql coincide con backend/db/schema.sql');
} else {
  fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
  fs.writeFileSync(DESTINO, esquema);
  console.log('✔ database/Script_checkIt.sql actualizado desde backend/db/schema.sql');
}
