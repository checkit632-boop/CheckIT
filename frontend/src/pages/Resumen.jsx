import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  FileBarChart2,
  FileSpreadsheet,
  FileText,
  Filter,
  RotateCcw,
  Search,
  Calendar,
  Settings,
  X,
  Upload,
  Table,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
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
  const [footerNote, setFooterNote] = useState(
    'CheckIT - Sistema Inteligente de Control de Equipos'
  );

  // 1. Cargar datos generales
  const cargarDatos = useCallback(() => {
    api
      .get('/registros/summary')
      .then((res) => setSummary(res.data))
      .catch(() => {});
    api
      .get('/registros', {
        params: {
          search: searchTerm,
          filterType: filterType !== 'todos' ? filterType : undefined,
          filterValue: filterValue || undefined,
        },
      })
      .then((res) => {
        setRegistros(res.data || []);
      })
      .catch(() => {});
  }, [searchTerm, filterType, filterValue]);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const entradas = summary.totales?.find((t) => t.nombre_movimiento === 'Entrada')?.total || 0;
  const salidas = summary.totales?.find((t) => t.nombre_movimiento === 'Salida')?.total || 0;

  // 2. Agrupación por Ciclos (Entrada / Salida) manteniendo el historial completo
  const registrosAgrupados = useMemo(() => {
    if (!registros || registros.length === 0) return [];

    const logsOrdenados = [...registros].sort(
      (a, b) => (a.id_registro || 0) - (b.id_registro || 0)
    );

    const ciclosCompletados = [];
    const ciclosActivos = new Map();
    const contadorCiclos = new Map();

    logsOrdenados.forEach((m) => {
      const nombrePersona =
        `${m.persona_nombres || ''} ${m.persona_apellidos || ''}`.trim() || 'Sin asignar';
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
          observaciones: m.observaciones_equipo || '',
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
            observaciones: m.observaciones_equipo || '',
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
    const targetKey =
      filterType === 'persona'
        ? 'persona'
        : filterType === 'equipo'
          ? 'equipo'
          : filterType === 'serial'
            ? 'serial'
            : 'registrado_por';
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
        const targetKey =
          filterType === 'persona'
            ? 'persona'
            : filterType === 'equipo'
              ? 'equipo'
              : filterType === 'serial'
                ? 'serial'
                : 'registrado_por';
        matchDropdown = item[targetKey] === filterValue;
      }

      return matchSearch && matchDropdown;
    });
  }, [registrosAgrupados, searchTerm, filterType, filterValue]);

  const openExportModal = (format) => {
    setExportFormat(format);
    setExportModalOpen(true);
  };

  // Separador ";" (no ",") porque Excel en configuración regional en
  // español/Latinoamérica usa "," como separador decimal y por lo tanto
  // espera ";" como separador de columnas en un CSV. Con "," como
  // delimitador, Excel abre el archivo entero en una sola columna (el
  // problema que se estaba viendo). El BOM al inicio (U+FEFF) se mantiene
  // para que tildes y la "ñ" se vean bien.
  const CSV_DELIM = ';';
  const csvEscape = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const ejecutarCSV = (data, filename, empresaNombre) => {
    const headers = [
      'Fecha',
      'Hora Ingreso',
      'Hora Salida',
      'Serial',
      'Responsable',
      'Equipo',
      'Registrado por',
    ];
    const rows = data.map((r) => [
      csvEscape(r.fecha),
      csvEscape(r.horaIngreso),
      csvEscape(r.horaSalida),
      csvEscape(r.serial),
      csvEscape(r.persona),
      csvEscape(r.equipo),
      csvEscape(r.registradoPor || ''),
    ]);

    const pie = csvEscape(`CheckIT — ${empresaNombre || 'TECNOSOFT'}`);
    const csvContent =
      '\uFEFF' +
      [headers.map(csvEscape).join(CSV_DELIM), ...rows.map((e) => e.join(CSV_DELIM)), '', pie].join(
        '\n'
      );
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convierte un data URL ("data:image/png;base64,....") en lo que ExcelJS
  // necesita para insertar la imagen (base64 puro + extensión).
  const parseDataUrlParaExcel = (dataUrl) => {
    if (!dataUrl) return null;
    const match = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUrl);
    if (!match) return null;
    let extension = match[1].toLowerCase();
    if (extension === 'jpg') extension = 'jpeg';
    return { base64: match[2], extension };
  };

  // Genera el reporte como Excel (.xlsx) real: a diferencia de un .csv (texto
  // plano, no puede llevar imágenes), aquí el logo se incrusta como imagen
  // de verdad, bien posicionada en el encabezado y en el pie de página.
  const ejecutarXLSX = async (
    data,
    filename,
    tituloEmpresa,
    empresaFija,
    rangoInicioStr,
    rangoFinStr
  ) => {
    const headers = [
      'Fecha',
      'Hora Ingreso',
      'Hora Salida',
      'Serial',
      'Responsable',
      'Equipo',
      'Registrado por',
    ];
    const numCols = headers.length;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CheckIT';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Movimientos', {
      views: [{ state: 'frozen', ySplit: 5 }],
    });

    sheet.columns = [
      { width: 13 },
      { width: 13 },
      { width: 13 },
      { width: 18 },
      { width: 28 },
      { width: 24 },
      { width: 18 },
    ];

    // --- Encabezado: logo de personalización (opcional) + títulos ---
    const logoPersonalizado = useCustomBrand ? parseDataUrlParaExcel(logoUrl) : null;
    const colInicioTexto = logoPersonalizado ? 3 : 1; // ExcelJS es 1-indexado

    sheet.getRow(1).height = 22;
    sheet.getRow(2).height = 16;
    sheet.getRow(3).height = 16;

    if (logoPersonalizado) {
      const imgId = workbook.addImage(logoPersonalizado);
      sheet.addImage(imgId, {
        tl: { col: 0.15, row: 0.15 },
        ext: { width: 105, height: 54 },
      });
    }

    sheet.mergeCells(1, colInicioTexto, 1, numCols);
    const tituloCell = sheet.getCell(1, colInicioTexto);
    tituloCell.value = tituloEmpresa;
    tituloCell.font = { bold: true, size: 16, color: { argb: 'FF111827' } };
    tituloCell.alignment = { vertical: 'middle' };

    sheet.mergeCells(2, colInicioTexto, 2, numCols);
    const subtituloCell = sheet.getCell(2, colInicioTexto);
    subtituloCell.value = logoPersonalizado
      ? 'Reporte Oficial de Control de Accesos'
      : 'Reporte General de Movimientos';
    subtituloCell.font = { size: 10, color: { argb: 'FF6B7280' } };
    subtituloCell.alignment = { vertical: 'middle' };

    sheet.mergeCells(3, colInicioTexto, 3, numCols);
    const rangoCell = sheet.getCell(3, colInicioTexto);
    rangoCell.value = `Rango del reporte: ${rangoInicioStr} a ${rangoFinStr}`;
    rangoCell.font = { size: 9, bold: true, color: { argb: 'FF3C3C3C' } };
    rangoCell.alignment = { vertical: 'middle' };

    sheet.getRow(4).height = 6; // fila espaciadora

    // --- Encabezado de tabla ---
    const headerRow = sheet.getRow(5);
    headerRow.values = headers;
    headerRow.height = 20;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF158942' } }; // brand-600
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // --- Filas de datos, con bandas alternadas para mejor lectura ---
    data.forEach((r, idx) => {
      const row = sheet.addRow([
        r.fecha,
        r.horaIngreso,
        r.horaSalida,
        r.serial,
        r.persona,
        r.equipo,
        r.registradoPor,
      ]);
      row.eachCell((cell) => {
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle' };
        cell.border = { bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } } };
      });
      if (idx % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }
    });

    sheet.addRow([]); // fila espaciadora

    // --- Pie de página: logo CheckIT (requerido en todo reporte) + texto ---
    const logoFooter = parseDataUrlParaExcel(await obtenerLogoDataUrl());
    const footerRowIndex = sheet.lastRow.number + 1;
    sheet.getRow(footerRowIndex).height = 22;

    let colTextoFooter = 1;
    if (logoFooter) {
      const footerImgId = workbook.addImage(logoFooter);
      sheet.addImage(footerImgId, {
        tl: { col: 0.1, row: footerRowIndex - 1 + 0.1 },
        ext: { width: 20, height: 20 },
      });
      colTextoFooter = 2;
    }

    sheet.mergeCells(footerRowIndex, colTextoFooter, footerRowIndex, 4);
    const footerNoteCell = sheet.getCell(footerRowIndex, colTextoFooter);
    footerNoteCell.value =
      footerNote.trim() || 'CheckIT - Sistema Inteligente de Control de Equipos';
    footerNoteCell.font = { size: 9, italic: true, color: { argb: 'FF9CA3AF' } };
    footerNoteCell.alignment = { vertical: 'middle' };

    sheet.mergeCells(footerRowIndex, 5, footerRowIndex, numCols);
    const footerBrandCell = sheet.getCell(footerRowIndex, 5);
    footerBrandCell.value = `CheckIT · ${empresaFija}`;
    footerBrandCell.font = { size: 9, bold: true, color: { argb: 'FF4B5563' } };
    footerBrandCell.alignment = { vertical: 'middle', horizontal: 'right' };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.xlsx`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Convierte /logo.png a Data URL una sola vez, para poder incrustarlo en el
  // pie de página del PDF (logo CheckIT, requerido en todo reporte).
  const obtenerLogoDataUrl = async () => {
    try {
      const res = await fetch('/logo.png');
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (err) {
      return null;
    }
  };

  const procesarExportacion = async () => {
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
            registradoPor: r.registrado_por || '—',
            observaciones: r.observaciones || '',
          };
        });

      const tituloEmpresa = useCustomBrand && companyName.trim() ? companyName : 'CheckIT';
      const EMPRESA_FIJA = 'TECNOSOFT';

      if (exportFormat === 'csv') {
        ejecutarCSV(dataExtraida, `Reporte_Movimientos_${tituloEmpresa}`, EMPRESA_FIJA);
        setExportModalOpen(false);
        return;
      }

      if (exportFormat === 'xlsx') {
        await ejecutarXLSX(
          dataExtraida,
          `Reporte_Movimientos_${tituloEmpresa}`,
          tituloEmpresa,
          EMPRESA_FIJA,
          fmtDateOnly(fechaInicio.toISOString()),
          fmtDateOnly(fechaFin.toISOString())
        );
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
        r.registradoPor,
      ]);

      // Logo CheckIT para el pie de página (requerido en todo reporte, además
      // del logo de personalización opcional que va en el encabezado).
      const logoFooterDataUrl = await obtenerLogoDataUrl();

      autoTable(doc, {
        head: [
          [
            'FECHA',
            'HORA INGRESO',
            'HORA SALIDA',
            'SERIAL',
            'RESPONSABLE',
            'EQUIPO',
            'REGISTRADO POR',
          ],
        ],
        body: tableRows,
        startY: tableStartY,
        theme: 'grid',
        headStyles: {
          fillColor: [21, 137, 66], // brand-600 (#158942)
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        didDrawPage: (data) => {
          const pageSize = doc.internal.pageSize;
          const pageWidth = pageSize.width || pageSize.getWidth();
          const pageHeight = pageSize.height || pageSize.getHeight();
          const footerY = pageHeight - 10;

          if (logoFooterDataUrl) {
            try {
              doc.addImage(logoFooterDataUrl, 'PNG', data.settings.margin.left, footerY - 6, 8, 8);
            } catch (e) {
              /* ignore */
            }
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(130);
          doc.text(
            footerNote.trim() || 'CheckIT - Sistema Inteligente de Control de Equipos',
            data.settings.margin.left + (logoFooterDataUrl ? 11 : 0),
            footerY
          );

          doc.setFont('helvetica', 'bold');
          doc.text(`CheckIT · ${EMPRESA_FIJA}`, pageWidth - data.settings.margin.right, footerY, {
            align: 'right',
          });
        },
      });

      doc.save(
        `Reporte_${tituloEmpresa.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
      );
      setExportModalOpen(false);
    } catch (err) {
      console.error(`Error al generar el reporte (${exportFormat}):`, err);
      alert(
        'Ocurrió un inconveniente al generar el reporte. Se procederá a descargar el reporte en formato CSV.'
      );
      ejecutarCSV(registrosFiltrados, 'Reporte_Respaldo', 'TECNOSOFT');
      setExportModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] space-y-4 pb-2 overflow-hidden">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            Resumen General
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Reportes y estadísticas del sistema
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openExportModal('csv')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm"
          >
            <Table size={16} />
            <span>Exportar CSV</span>
          </button>

          <button
            onClick={() => openExportModal('xlsx')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white transition-all shadow-sm"
          >
            <FileSpreadsheet size={16} />
            <span>Exportar Excel</span>
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
        <div className="md:col-span-2 bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3 border-b border-gray-100 dark:border-gray-700 pb-2">
            <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 text-sm">
              <Filter size={16} className="text-brand-600 dark:text-brand-400" />
              <span>Búsqueda y Filtros</span>
            </div>
            {(searchTerm !== '' || filterType !== 'todos' || filterValue !== '') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setFilterType('todos');
                  setFilterValue('');
                }}
                className="text-xs text-brand-600 dark:text-brand-400 font-semibold hover:underline flex items-center gap-1"
              >
                <RotateCcw size={12} /> Limpiar filtros
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                Búsqueda rápida:
              </label>
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Escribe persona, equipo, serial o quien registró..."
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Filtrar por categoría:
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setFilterValue('');
                  }}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                >
                  <option value="todos">Mostrar Todos</option>
                  <option value="persona">Persona</option>
                  <option value="equipo">Equipo</option>
                  <option value="serial">Serial</option>
                  <option value="registrado_por">Registrado por</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Seleccionar opción:
                </label>
                {filterType === 'todos' ? (
                  <input
                    type="text"
                    disabled
                    placeholder="Selecciona un filtro primero..."
                    className="w-full border border-gray-100 dark:border-gray-700 rounded-xl px-3 py-2 text-xs bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  />
                ) : (
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                  >
                    <option value="">-- Ver todos ({filterType}) --</option>
                    {filterOptions.map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col justify-between">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 text-sm">
            <FileBarChart2 size={16} className="text-brand-600 dark:text-brand-400" />
            <span>Movimientos por Tipo</span>
          </div>
          <div className="p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Entradas</span>
              <span className="px-2.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 font-bold">
                {entradas}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 dark:text-gray-400 font-medium">Salidas</span>
              <span className="px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-bold">
                {salidas}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-700">
              <span className="text-gray-900 dark:text-gray-100 font-bold">Total</span>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                {summary.total}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TABLA HISTORIAL */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <div className="flex-none px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div className="font-bold text-gray-900 dark:text-gray-100 text-sm">
            Historial de Movimientos
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">
            {registrosFiltrados.length} registros encontrados
          </span>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="bg-brand-50/80 dark:bg-brand-900/30 text-gray-700 dark:text-gray-300 text-[11px] uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3 font-bold">RESPONSABLE</th>
                <th className="px-5 py-3 font-bold">EQUIPO</th>
                <th className="px-5 py-3 font-bold">SERIAL</th>
                <th className="px-5 py-3 font-bold text-center">ENTRADA</th>
                <th className="px-5 py-3 font-bold text-center">SALIDA</th>
                <th className="px-5 py-3 font-bold">REGISTRADO POR</th>
                <th className="px-5 py-3 font-bold">OBSERVACIONES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700 text-xs">
              {registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 dark:text-gray-500 py-10">
                    No se encontraron movimientos registrados
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map((m) => (
                  <tr
                    key={m.cicloKey}
                    className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <div className="font-bold text-gray-900 dark:text-gray-100">{m.persona}</div>
                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                        {m.documento}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-800 dark:text-gray-100">
                      {m.equipo}
                    </td>
                    <td className="px-5 py-3 font-mono font-bold text-brand-600 dark:text-brand-400">
                      {m.serial}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {m.entrada ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 leading-none mb-0.5">
                            Entrada
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                            {fmt(m.entrada)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {m.salida ? (
                        <div className="inline-flex flex-col items-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-900 text-white leading-none mb-0.5">
                            Salida
                          </span>
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                            {fmt(m.salida)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600 font-mono">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-700 dark:text-gray-300">
                      {m.registrado_por}
                    </td>
                    <td
                      className="px-5 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate"
                      title={m.observaciones}
                    >
                      {m.observaciones || '—'}
                    </td>
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
          <div className="bg-surface dark:bg-gray-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100 text-base">
                <Calendar size={18} className="text-brand-600 dark:text-brand-400" />
                <span>
                  Exportar Reporte ({exportFormat === 'xlsx' ? 'EXCEL' : exportFormat.toUpperCase()}
                  )
                </span>
              </div>
              <button
                onClick={() => setExportModalOpen(false)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Rango / Modo de Fecha:
                </label>
                <select
                  value={timeFilter}
                  onChange={(e) => setTimeFilter(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800 font-medium"
                >
                  <option value="rango">Seleccionar Rango en Calendario (Desde - Hasta)</option>
                  <option value="dia_especifico">Un Día Específico</option>
                  <option value="mensual">Mes Completo (1 al último día del mes)</option>
                  <option value="anual">Año Completo</option>
                  <option value="ultimos_x">Últimos X Días / Meses / Años</option>
                </select>
              </div>

              {timeFilter === 'rango' && (
                <div className="grid grid-cols-2 gap-3 bg-brand-50/50 dark:bg-brand-900/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Fecha Inicio:
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Fecha Fin:
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                    />
                  </div>
                </div>
              )}

              {timeFilter === 'dia_especifico' && (
                <div className="bg-brand-50/50 dark:bg-brand-900/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Seleccionar Día:
                  </label>
                  <input
                    type="date"
                    value={singleDate}
                    onChange={(e) => setSingleDate(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                  />
                </div>
              )}

              {timeFilter === 'mensual' && (
                <div className="bg-brand-50/50 dark:bg-brand-900/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Seleccionar Mes y Año:
                  </label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                  />
                  <p className="text-[10px] text-brand-700 mt-1 font-medium">
                    ✓ Abarca desde el día 1 hasta el cierre del mes seleccionado.
                  </p>
                </div>
              )}

              {timeFilter === 'anual' && (
                <div className="bg-brand-50/50 dark:bg-brand-900/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                    Año a Consultar:
                  </label>
                  <input
                    type="number"
                    min="2020"
                    max="2030"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                  />
                </div>
              )}

              {timeFilter === 'ultimos_x' && (
                <div className="grid grid-cols-2 gap-3 bg-brand-50/50 dark:bg-brand-900/20 p-3 rounded-2xl border border-brand-100 dark:border-brand-800">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Cantidad:
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={timeAmount}
                      onChange={(e) => setTimeAmount(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                      Unidad:
                    </label>
                    <select
                      value={timeUnit}
                      onChange={(e) => setTimeUnit(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 bg-surface dark:bg-gray-800"
                    >
                      <option value="dias">Días pasados</option>
                      <option value="meses">Meses pasados</option>
                      <option value="anos">Años pasados</option>
                    </select>
                  </div>
                </div>
              )}

              {/* PERSONALIZACIÓN */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <Settings size={14} className="text-brand-600 dark:text-brand-400" />{' '}
                    Personalización de Empresa / Marca
                  </span>
                  <input
                    type="checkbox"
                    checked={useCustomBrand}
                    onChange={(e) => setUseCustomBrand(e.target.checked)}
                    className="accent-brand-600 rounded cursor-pointer h-4 w-4"
                  />
                </div>

                {useCustomBrand && (
                  <div className="space-y-3 bg-slate-50 dark:bg-gray-900 p-3.5 rounded-2xl border border-slate-200 dark:border-gray-700">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                        Nombre de la Empresa:
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Empresa S.A.S."
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs bg-surface dark:bg-gray-800 focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 dark:text-gray-300 block mb-1">
                        Cargar Logotipo:
                      </label>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300 hover:bg-brand-200 dark:hover:bg-brand-800/60 cursor-pointer border border-brand-200 dark:border-brand-700 transition-colors">
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
                        {logoUrl && (
                          <span className="text-[10px] text-brand-600 dark:text-brand-400 font-bold">
                            ✓ Cargado
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1">
                  Pie de página (Copyright / Leyenda):
                </label>
                <input
                  type="text"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-1.5 text-xs bg-surface dark:bg-gray-800 focus:outline-none focus:border-brand-500 font-medium"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setExportModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={procesarExportacion}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors shadow-sm"
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
