import { useEffect, useState, useMemo, useCallback } from 'react';
import { FileBarChart2, FileSpreadsheet, FileText, Filter, RotateCcw, Search, Calendar, Settings, X, Upload } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../api/client';

const fmtDateOnly = (fechaStr) => {
  if (!fechaStr) return '—';
  let limpia = fechaStr.replace('T', ' ');
  if (limpia.includes('.')) limpia = limpia.split('.')[0];
  const partes = limpia.split(' ');
  const [year, month, day] = partes[0].split('-');
  return `${day}/${month}/${year}`;
};

const fmtTimeOnly = (fechaStr) => {
  if (!fechaStr) return '—';
  let limpia = fechaStr.replace('T', ' ');
  if (limpia.includes('.')) limpia = limpia.split('.')[0];
  const partes = limpia.split(' ');
  if (partes.length < 2) return '—';

  const [, hora] = partes;
  let [hours, minutes] = hora.split(':');
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;

  return `${h}:${minutes} ${ampm}`;
};

const fmt = (fechaStr) => {
  if (!fechaStr) return '—';
  const partes = fechaStr.split(' ');
  if (partes.length < 2) return fechaStr;

  const [fecha, hora] = partes;
  const [year, month, day] = fecha.split('-');
  let [hours, minutes] = hora.split(':');
  
  let h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;

  return `${day}/${month}/${year.slice(2)}, ${h}:${minutes} ${ampm}`;
};

export default function Resumen() {
  const [summary, setSummary] = useState({ totales: [], total: 0 });
  const [registros, setRegistros] = useState([]);

  // Filtros de tabla
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [filterValue, setFilterValue] = useState('');

  // Modal Exportación
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('pdf');
  
  // Filtros de tiempo
  const [timeFilter, setTimeFilter] = useState('rango'); 
  const [singleDate, setSingleDate] = useState(new Date().toISOString().slice(0, 10));
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [timeAmount, setTimeAmount] = useState('2');
  const [timeUnit, setTimeUnit] = useState('dias');

  // Personalización
  const [useCustomBrand, setUseCustomBrand] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [footerNote, setFooterNote] = useState('CheckIT - Sistema Inteligente de Control de Equipos');

  // 1. Cargar datos generales
  const cargarDatos = useCallback(() => {
    api.get('/registros/summary').then((res) => setSummary(res.data)).catch(() => {});
    api.get('/registros', {
      params: {
        search: searchTerm,
        filterType: filterType !== 'todos' ? filterType : undefined,
        filterValue: filterValue || undefined
      }
    }).then((res) => {
      setRegistros(res.data || []);
    }).catch(() => {});
  }, [searchTerm, filterType, filterValue]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const entradas = summary.totales?.find((t) => t.nombre_movimiento === 'Entrada')?.total || 0;
  const salidas = summary.totales?.find((t) => t.nombre_movimiento === 'Salida')?.total || 0;

  // 2. Agrupación por Ciclos (Entrada / Salida) manteniendo el historial completo
  const registrosAgrupados = useMemo(() => {
    if (!registros || registros.length === 0) return [];

    const logsOrdenados = [...registros].sort((a, b) => (a.id_registro || 0) - (b.id_registro || 0));

    const ciclosCompletados = [];
    const ciclosActivos = new Map();
    const contadorCiclos = new Map();

    logsOrdenados.forEach((m) => {
      const nombrePersona = `${m.persona_nombres || ''} ${m.persona_apellidos || ''}`.trim() || 'Sin asignar';
      const equipoInfo = `${m.nombre_marca || ''} ${m.modelo || ''}`.trim() || 'Equipo';
      const tipo = (m.nombre_movimiento || '').toLowerCase();
      const serial = m.serial;

      if (tipo === 'entrada') {
        if (ciclosActivos.has(serial)) {
          ciclosCompletados.push(ciclosActivos.get(serial));
          ciclosActivos.delete(serial);
        }

        const numCiclo = (contadorCiclos.get(serial) || 0) + 1;
        contadorCiclos.set(serial, numCiclo);

        const nuevoCiclo = {
          cicloKey: `${serial}_ciclo_${numCiclo}_${m.id_registro}`,
          persona: nombrePersona,
          documento: m.numero_documento || '',
          equipo: equipoInfo,
          serial: serial,
          entrada: m.fecha_hora,
          salida: null,
          registrado_por: m.registrado_por || 'admin',
          ultimoIdRegistro: m.id_registro || 0,
        };

        ciclosActivos.set(serial, nuevoCiclo);

      } else if (tipo === 'salida') {
        if (ciclosActivos.has(serial)) {
          const cicloEnProgreso = ciclosActivos.get(serial);
          cicloEnProgreso.salida = m.fecha_hora;
          cicloEnProgreso.ultimoIdRegistro = m.id_registro || cicloEnProgreso.ultimoIdRegistro;
          
          ciclosCompletados.push(cicloEnProgreso);
          ciclosActivos.delete(serial);
        } else {
          const numCiclo = (contadorCiclos.get(serial) || 0) + 1;
          contadorCiclos.set(serial, numCiclo);

          ciclosCompletados.push({
            cicloKey: `${serial}_salida_aislada_${numCiclo}_${m.id_registro}`,
            persona: nombrePersona,
            documento: m.numero_documento || '',
            equipo: equipoInfo,
            serial: serial,
            entrada: null,
            salida: m.fecha_hora,
            registrado_por: m.registrado_por || 'admin',
            ultimoIdRegistro: m.id_registro || 0,
          });
        }
      }
    });

    ciclosActivos.forEach((ciclo) => {
      ciclosCompletados.push(ciclo);
    });

    return ciclosCompletados.sort((a, b) => b.ultimoIdRegistro - a.ultimoIdRegistro);
  }, [registros]);

  // 3. Opciones dinámicas para el selector
  const filterOptions = useMemo(() => {
    if (filterType === 'todos') return [];
    const targetKey = filterType === 'persona' ? 'persona' : filterType === 'equipo' ? 'equipo' : filterType === 'serial' ? 'serial' : 'registrado_por';
    const setValores = new Set();
    registrosAgrupados.forEach((item) => { 
      if (item[targetKey]) setValores.add(item[targetKey]); 
    });
    return Array.from(setValores).sort();
  }, [registrosAgrupados, filterType]);

  // 4. Filtro cliente local (Respaldo inmediato)
  const registrosFiltrados = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return registrosAgrupados.filter((item) => {
      const matchSearch =
        !term ||
        (item.persona && item.persona.toLowerCase().includes(term)) ||
        (item.documento && item.documento.toLowerCase().includes(term)) ||
        (item.equipo && item.equipo.toLowerCase().includes(term)) ||
        (item.serial && item.serial.toLowerCase().includes(term)) ||
        (item.registrado_por && item.registrado_por.toLowerCase().includes(term));

      let matchDropdown = true;
      if (filterType !== 'todos' && filterValue) {
        const targetKey = filterType === 'persona' ? 'persona' : filterType === 'equipo' ? 'equipo' : filterType === 'serial' ? 'serial' : 'registrado_por';
        matchDropdown = item[targetKey] === filterValue;
      }

      return matchSearch && matchDropdown;
    });
  }, [registrosAgrupados, searchTerm, filterType, filterValue]);

  const openExportModal = (format) => {
    setExportFormat(format);
    setExportModalOpen(true);
  };

  const ejecutarCSV = (data, filename) => {
    const headers = ['Fecha', 'Hora Ingreso', 'Hora Salida', 'Serial', 'Persona', 'Equipo'];
    const rows = data.map((r) => [
      `"${r.fecha}"`,
      `"${r.horaIngreso}"`,
      `"${r.horaSalida}"`,
      `"${r.serial}"`,
      `"${r.persona}"`,
      `"${r.equipo}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const procesarExportacion = () => {
    try {
      let fechaInicio = new Date();
      let fechaFin = new Date();

      if (timeFilter === 'dia_especifico') {
        fechaInicio = new Date(`${singleDate}T00:00:00`);
        fechaFin = new Date(`${singleDate}T23:59:59`);
      } else if (timeFilter === 'rango') {
        fechaInicio = new Date(`${customStartDate}T00:00:00`);
        fechaFin = new Date(`${customEndDate}T23:59:59`);
      } else if (timeFilter === 'mensual') {
        const [yearStr, monthStr] = selectedMonth.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr) - 1;
        fechaInicio = new Date(year, month, 1, 0, 0, 0);
        fechaFin = new Date(year, month + 1, 0, 23, 59, 59);
      } else if (timeFilter === 'anual') {
        const year = parseInt(selectedYear) || new Date().getFullYear();
        fechaInicio = new Date(year, 0, 1, 0, 0, 0);
        fechaFin = new Date(year, 11, 31, 23, 59, 59);
      } else if (timeFilter === 'ultimos_x') {
        const cantidad = parseInt(timeAmount) || 1;
        const ahora = new Date();
        fechaFin = new Date(ahora.setHours(23, 59, 59));
        fechaInicio = new Date();

        if (timeUnit === 'dias') fechaInicio.setDate(ahora.getDate() - cantidad);
        else if (timeUnit === 'meses') fechaInicio.setMonth(ahora.getMonth() - cantidad);
        else if (timeUnit === 'anos') fechaInicio.setFullYear(ahora.getFullYear() - cantidad);
        fechaInicio.setHours(0, 0, 0);
      }

      const dataExtraida = registrosFiltrados
        .filter((item) => {
          const fechaRef = new Date(item.entrada || item.salida);
          return fechaRef >= fechaInicio && fechaRef <= fechaFin;
        })
        .map((r) => {
          const fechaRef = r.entrada || r.salida;
          return {
            fecha: fmtDateOnly(fechaRef),
            horaIngreso: r.entrada ? fmtTimeOnly(r.entrada) : '—',
            horaSalida: r.salida ? fmtTimeOnly(r.salida) : '—',
            serial: r.serial || '—',
            persona: r.persona || '—',
            equipo: r.equipo || '—',
          };
        });

      const tituloEmpresa = useCustomBrand && companyName.trim() ? companyName : 'CheckIT';

      if (exportFormat === 'csv') {
        ejecutarCSV(dataExtraida, `Reporte_Movimientos_${tituloEmpresa}`);
        setExportModalOpen(false);
        return;
      }

      const doc = new jsPDF('landscape');
      let currentY = 15;
      const marginX = 14;

      if (useCustomBrand) {
        let textLeftMargin = marginX;

        if (logoUrl) {
          try {
            doc.addImage(logoUrl, 'PNG', marginX, 10, 25, 18);
            textLeftMargin = 45;
          } catch (e) {
            console.warn('Error al cargar la imagen del logo:', e);
            textLeftMargin = marginX;
          }
        }

        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text(tituloEmpresa, textLeftMargin, 16);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('Reporte Oficial de Control de Accesos', textLeftMargin, 22);

        currentY = 32;
      } else {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('CheckIT - Control de Accesos', marginX, 16);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text('Reporte General de Movimientos', marginX, 22);

        currentY = 30;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.text(
        `Rango del reporte: ${fmtDateOnly(fechaInicio.toISOString())} a ${fmtDateOnly(fechaFin.toISOString())}`,
        marginX,
        currentY
      );

      const tableStartY = currentY + 6;

      const tableRows = dataExtraida.map((r) => [
        r.fecha,
        r.horaIngreso,
        r.horaSalida,
        r.serial,
        r.persona,
        r.equipo,
      ]);

      autoTable(doc, {
        head: [['FECHA', 'HORA INGRESO', 'HORA SALIDA', 'SERIAL', 'PERSONA', 'EQUIPO']],
        body: tableRows,
        startY: tableStartY,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        didDrawPage: (data) => {
          const pageSize = doc.internal.pageSize;
          const pageHeight = pageSize.height || pageSize.getHeight();
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(130);
          doc.text(
            footerNote.trim() || 'CheckIT - Sistema Inteligente de Control de Equipos',
            data.settings.margin.left,
            pageHeight - 8
          );
        },
      });

      doc.save(`Reporte_${tituloEmpresa.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportModalOpen(false);
    } catch (err) {
      console.error('Error al generar PDF:', err);
      alert('Ocurrió un inconveniente con el PDF. Se procederá a descargar el reporte en formato CSV.');
      ejecutarCSV(registrosFiltrados, 'Reporte_Respaldo');
      setExportModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] space-y-4 pb-2 overflow-hidden">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Resumen General</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reportes y estadísticas del sistema</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openExportModal('csv')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => openExportModal('pdf')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-black text-white transition-all shadow-sm"
          >
            <FileText size={16} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      {/* FILTROS Y RESUMEN */}
      <div className="flex-none grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
            <div className="flex items-center gap-2 font-bold text-gray-900 text-sm">
              <Filter size={16} className="text-emerald-600" />
              <span>Búsqueda y Filtros</span>
            </div>
            {(searchTerm !== '' || filterType !== 'todos' || filterValue !== '') && (
              <button
                onClick={() => { setSearchTerm(''); setFilterType('todos'); setFilterValue(''); }}
                className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} /> Limpiar filtros
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 block mb-1">Búsqueda rápida:</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Escribe persona, equipo, serial o quien registró..."
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white placeholder:text-gray-400"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Filtrar por categoría:</label>
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setFilterValue(''); }}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                >
                  <option value="todos">Mostrar Todos</option>
                  <option value="persona">Persona</option>
                  <option value="equipo">Equipo</option>
                  <option value="serial">Serial</option>
                  <option value="registrado_por">Registrado por</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Seleccionar opción:</label>
                {filterType === 'todos' ? (
                  <input
                    type="text"
                    disabled
                    placeholder="Selecciona un filtro primero..."
                    className="w-full border border-gray-100 rounded-xl px-3 py-2 text-xs bg-gray-50 text-gray-400 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  >
                    <option value="">-- Ver todos ({filterType}) --</option>
                    {filterOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 font-bold text-gray-900 text-sm">
            <FileBarChart2 size={16} className="text-emerald-600" />
            <span>Movimientos por Tipo</span>
          </div>
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Entradas</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">{entradas}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Salidas</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold">{salidas}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
              <span className="text-gray-900 font-bold">Total</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">{summary.total}</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA HISTORIAL */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex-none px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="font-bold text-gray-900 text-sm">Historial de Movimientos</div>
          <span className="text-xs text-gray-400 font-medium">{registrosFiltrados.length} registros encontrados</span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-emerald-50/80 text-gray-700 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 font-bold">PERSONA</th>
                <th className="px-5 py-3 font-bold">EQUIPO</th>
                <th className="px-5 py-3 font-bold">SERIAL</th>
                <th className="px-5 py-3 font-bold text-center">ENTRADA</th>
                <th className="px-5 py-3 font-bold text-center">SALIDA</th>
                <th className="px-5 py-3 font-bold">REGISTRADO POR</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-xs">
              {registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10">No se encontraron movimientos registrados</td>
                </tr>
              ) : (
                registrosFiltrados.map((m) => (
                  <tr key={m.cicloKey} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-bold text-gray-900">{m.persona}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{m.documento}</div>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800">{m.equipo}</td>
                    <td className="px-5 py-3 font-mono font-bold text-emerald-600">{m.serial}</td>
                    <td className="px-5 py-3 text-center">
                      {m.entrada ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 leading-none mb-0.5">Entrada</span>
                          <span className="text-[10px] text-gray-500 font-mono">{fmt(m.entrada)}</span>
                        </div>
                      ) : <span className="text-gray-300 font-mono">—</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {m.salida ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 text-white leading-none mb-0.5">Salida</span>
                          <span className="text-[10px] text-gray-500 font-mono">{fmt(m.salida)}</span>
                        </div>
                      ) : <span className="text-gray-300 font-mono">—</span>}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-700">{m.registrado_por}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EXPORTACIÓN */}
      {exportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 font-bold text-gray-900 text-base">
                <Calendar size={18} className="text-emerald-600" />
                <span>Exportar Reporte ({exportFormat.toUpperCase()})</span>
              </div>
              <button onClick={() => setExportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Rango / Modo de Fecha:</label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 bg-white font-medium"
                >
                  <option value="rango">Seleccionar Rango en Calendario (Desde - Hasta)</option>
                  <option value="dia_especifico">Un Día Específico</option>
                  <option value="mensual">Mes Completo (1 al último día del mes)</option>
                  <option value="anual">Año Completo</option>
                  <option value="ultimos_x">Últimos X Días / Meses / Años</option>
                </select>
              </div>

              {timeFilter === 'rango' && (
                <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Fecha Inicio:</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Fecha Fin:</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                </div>
              )}

              {timeFilter === 'dia_especifico' && (
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Seleccionar Día:</label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
              )}

              {timeFilter === 'mensual' && (
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Seleccionar Mes y Año:</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  />
                  <p className="text-[10px] text-emerald-700 mt-1 font-medium">✓ Abarca desde el día 1 hasta el cierre del mes seleccionado.</p>
                </div>
              )}

              {timeFilter === 'anual' && (
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  <label className="text-[11px] font-bold text-gray-700 block mb-1">Año a Consultar:</label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                  />
                </div>
              )}

              {timeFilter === 'ultimos_x' && (
                <div className="grid grid-cols-2 gap-3 bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Cantidad:</label>
                    <input
                      type="number"
                      min="1"
                      value={timeAmount}
                      onChange={(e) => setTimeAmount(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Unidad:</label>
                    <select
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500 bg-white"
                    >
                      <option value="dias">Días pasados</option>
                      <option value="meses">Meses pasados</option>
                      <option value="anos">Años pasados</option>
                    </select>
                  </div>
                </div>
              )}

              {/* PERSONALIZACIÓN */}
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                    <Settings size={14} className="text-emerald-600" /> Personalización de Empresa / Marca
                  </span>
                  <input
                    type="checkbox"
                    checked={useCustomBrand}
                    onChange={(e) => setUseCustomBrand(e.target.checked)}
                    className="accent-emerald-600 rounded cursor-pointer h-4 w-4"
                  />
                </div>

                {useCustomBrand && (
                  <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Nombre de la Empresa:</label>
                      <input
                        type="text"
                        placeholder="Ej: Empresa S.A.S."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Cargar Logotipo:</label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 cursor-pointer border border-emerald-200 transition-colors">
                          <Upload size={14} />
                          <span>Subir Imagen</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => setLogoUrl(reader.result);
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                        {logoUrl && <span className="text-[10px] text-emerald-600 font-bold">✓ Cargado</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Pie de página (Copyright / Leyenda):</label>
                <input
                  type="text"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3 py-1.5 text-xs bg-white focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100">
              <button
                onClick={() => setExportModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={procesarExportacion}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
              >
                Generar y Descargar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}