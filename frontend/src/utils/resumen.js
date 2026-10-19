// Funciones puras de la vista Resumen: arman los ciclos entrada -> salida a
// partir de los movimientos y aplican los filtros de búsqueda. Las usan tanto
// la tabla como las exportaciones, para que ambas muestren exactamente lo
// mismo.

// Períodos que se pueden cargar en la tabla. El historial completo ya no se
// descarga en cada visita: con 100.000 movimientos eran ~42 MB y ~4 s.
export const PERIODOS_HISTORIAL = [
  { valor: '7', etiqueta: 'Últimos 7 días' },
  { valor: '30', etiqueta: 'Últimos 30 días' },
  { valor: '90', etiqueta: 'Últimos 90 días' },
  { valor: '365', etiqueta: 'Último año' },
];
export const PERIODO_POR_DEFECTO = '30';

// Fecha local en formato AAAA-MM-DD (toISOString() usaría UTC y en la noche
// de Colombia ya devolvería el día siguiente).
export function fechaLocalISO(fecha) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

// { desde, hasta } de los últimos `dias` días, hoy incluido.
export function rangoUltimosDias(dias) {
  const hasta = new Date();
  const desde = new Date();
  desde.setDate(hasta.getDate() - (dias - 1));
  return { desde: fechaLocalISO(desde), hasta: fechaLocalISO(hasta) };
}

function cicloBase(m, sufijo, numCiclo) {
  return {
    cicloKey: `${m.serial}_${sufijo}_${numCiclo}_${m.id_registro}`,
    persona: `${m.persona_nombres || ''} ${m.persona_apellidos || ''}`.trim() || 'Sin asignar',
    documento: m.numero_documento || '',
    equipo: `${m.nombre_marca || ''} ${m.modelo || ''}`.trim() || 'Equipo',
    serial: m.serial,
    entrada: null,
    salida: null,
    observaciones: m.observaciones_equipo || '',
    registrado_por: m.registrado_por || 'admin',
    ultimoIdRegistro: m.id_registro || 0,
  };
}

// Agrupa los movimientos en ciclos por serial, en orden de id_registro: una
// entrada abre un ciclo y la siguiente salida lo cierra. Una entrada sin
// salida queda como ciclo abierto (el equipo sigue adentro) y una salida sin
// entrada previa queda como "salida aislada". Devuelve los ciclos del más
// reciente al más antiguo.
export function agruparEnCiclos(registros) {
  if (!registros || registros.length === 0) return [];

  const ordenados = [...registros].sort((a, b) => (a.id_registro || 0) - (b.id_registro || 0));
  const completados = [];
  const activos = new Map();
  const contador = new Map();
  const siguienteNumero = (serial) => {
    const n = (contador.get(serial) || 0) + 1;
    contador.set(serial, n);
    return n;
  };

  ordenados.forEach((m) => {
    const tipo = (m.nombre_movimiento || '').toLowerCase();
    const serial = m.serial;

    if (tipo === 'entrada') {
      if (activos.has(serial)) completados.push(activos.get(serial));
      const ciclo = cicloBase(m, 'ciclo', siguienteNumero(serial));
      ciclo.entrada = m.fecha_hora;
      activos.set(serial, ciclo);
    } else if (tipo === 'salida') {
      if (activos.has(serial)) {
        const ciclo = activos.get(serial);
        ciclo.salida = m.fecha_hora;
        ciclo.ultimoIdRegistro = m.id_registro || ciclo.ultimoIdRegistro;
        completados.push(ciclo);
        activos.delete(serial);
      } else {
        const ciclo = cicloBase(m, 'salida_aislada', siguienteNumero(serial));
        ciclo.salida = m.fecha_hora;
        completados.push(ciclo);
      }
    }
  });

  activos.forEach((ciclo) => completados.push(ciclo));
  return completados.sort((a, b) => b.ultimoIdRegistro - a.ultimoIdRegistro);
}

// Campo del ciclo que usa cada opción del selector de filtro.
export function campoDeFiltro(filterType) {
  if (filterType === 'persona' || filterType === 'equipo' || filterType === 'serial') return filterType;
  return 'registrado_por';
}

export function filtrarCiclos(ciclos, searchTerm, filterType, filterValue) {
  const term = searchTerm.trim().toLowerCase();
  const campo = campoDeFiltro(filterType);
  return ciclos.filter((item) => {
    const coincideBusqueda =
      !term ||
      [item.persona, item.documento, item.equipo, item.serial, item.registrado_por].some(
        (v) => v && v.toLowerCase().includes(term)
      );
    const coincideSelector = filterType === 'todos' || !filterValue || item[campo] === filterValue;
    return coincideBusqueda && coincideSelector;
  });
}
