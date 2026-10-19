// Patrón para LIKE ... ESCAPE '!' con los comodines % y _ (y el propio !)
// escapados: así quien busca "50%" o "A_1" encuentra exactamente ese texto.
function patronContiene(texto) {
  return `%${String(texto).replace(/[!%_]/g, (c) => `!${c}`)}%`;
}

module.exports = { patronContiene };
