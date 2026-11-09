import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import QRCode from 'qrcode';
import Modal from './Modal';

// Compone una imagen final (título + logo + QR + datos del equipo) para que
// la descarga no sea solo el QR "pelado", sino una tarjeta identificable.
function componerImagenDescarga({ dataUrl, equipo }) {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const W = 420;
    const H = 560;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, W - 16, H - 16);

    const qrImg = new Image();
    qrImg.onload = () => {
      const logo = new Image();
      const dibujarResto = () => {
        // Título
        ctx.fillStyle = '#0d6d32';
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CheckIT - Computador', W / 2, 100);

        // QR centrado
        const qrSize = 280;
        ctx.drawImage(qrImg, (W - qrSize) / 2, 130, qrSize, qrSize);

        // Datos del equipo
        ctx.textAlign = 'left';
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 16px Arial';
        const startY = 440;
        const lineas = [
          `Marca: ${equipo.nombre_marca || '—'}`,
          `Modelo: ${equipo.modelo || '—'}`,
          `Serial: ${equipo.serial || '—'}`,
        ];
        lineas.forEach((linea, i) => {
          ctx.fillText(linea, 40, startY + i * 26);
        });

        resolve(canvas.toDataURL('image/png'));
      };

      logo.onload = () => {
        ctx.drawImage(logo, (W - 48) / 2, 30, 48, 48);
        dibujarResto();
      };
      logo.onerror = dibujarResto;
      logo.src = '/logo.png';
    };
    qrImg.onerror = reject;
    qrImg.src = dataUrl;
  });
}

// El serial, la marca y el modelo los escribe un usuario: se escapan antes de
// insertarlos en la página de impresión.
const escaparHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export default function EquipmentQRModal({ equipo, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!equipo) { setDataUrl(null); return; }
    // El QR se genera en el navegador (auditoría, punto 5.2): antes lo
    // dibujaba el servidor en cada consulta, gastando CPU y memoria del
    // backend. Mismo contenido y mismas opciones que antes.
    QRCode.toDataURL(equipo.codigo_qr || equipo.serial, { width: 260, margin: 1 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null));
  }, [equipo]);

  const handleDownload = async () => {
    if (!dataUrl) return;
    try {
      const imagenFinal = await componerImagenDescarga({ dataUrl, equipo });
      const link = document.createElement('a');
      link.download = `QR_Computador_${equipo.serial}.png`;
      link.href = imagenFinal;
      link.click();
    } catch (err) {
      // Respaldo: si falla la composición, descarga el QR simple
      const link = document.createElement('a');
      link.download = `QR_Computador_${equipo.serial}.png`;
      link.href = dataUrl;
      link.click();
    }
  };

  // Etiqueta para la impresora térmica del centro (Jaltech 838L, controlador
  // 4Barcode 3B-365B) con rollo adhesivo de 48 × 48 mm. Todo en negro, sin
  // logo ni bordes, y con medidas en milímetros: el QR mide 32 mm, más que el
  // mínimo de 2 × 2 cm que lee bien la pistola.
  const handlePrint = async () => {
    if (!equipo) return;
    // El QR de la etiqueta se genera aparte, en alta resolución y sin margen
    // propio: la etiqueta ya deja el espacio blanco que el lector necesita.
    let qrEtiqueta;
    try {
      qrEtiqueta = await QRCode.toDataURL(equipo.codigo_qr || equipo.serial, { width: 600, margin: 0, color: { dark: '#000000', light: '#ffffff' } });
    } catch {
      return;
    }
    const marcaModelo = [equipo.nombre_marca, equipo.modelo].filter(Boolean).join(' ');
    // El serial se imprime completo: con más caracteres, letra más pequeña
    // (y, si no alcanza, dos líneas) en lugar de cortarlo.
    const largo = String(equipo.serial || '').length;
    const tamSerial = largo <= 16 ? '8pt' : largo <= 22 ? '7pt' : '6pt';
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!doctype html>
      <html><head><meta charset="utf-8"><title>Etiqueta ${escaparHtml(equipo.serial)}</title>
      <style>
        @page { size: 48mm 48mm; margin: 0; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { width: 48mm; height: 48mm; background: #fff; color: #000; }
        body { font-family: Arial, Helvetica, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
        .titulo { font-size: 6.5pt; font-weight: bold; letter-spacing: .3pt; line-height: 1; margin-bottom: 1mm; }
        img.qr { width: 32mm; height: 32mm; image-rendering: pixelated; }
        .serial { font-size: ${tamSerial}; font-weight: bold; line-height: 1.1; margin-top: 1.2mm; max-width: 44mm; text-align: center; word-break: break-all; }
        .equipo { font-size: 6pt; line-height: 1; margin-top: .8mm; max-width: 44mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>
      <div class="titulo">CheckIT</div>
      <img class="qr" src="${qrEtiqueta}" alt="" />
      <div class="serial">${escaparHtml(equipo.serial)}</div>
      ${marcaModelo ? `<div class="equipo">${escaparHtml(marcaModelo)}</div>` : ''}
      <script>
        window.onafterprint = () => window.close();
        window.onload = () => window.print();
      </script>
      </body></html>`);
    win.document.close();
  };

  return (
    <Modal open={!!equipo} onClose={onClose} title="Código QR del Equipo" maxWidth="max-w-sm">
      {equipo && (
        <div className="flex flex-col items-center gap-4">
          {dataUrl ? (
            <img src={dataUrl} alt={`QR ${equipo.serial}`} className="rounded-xl border border-gray-200 dark:border-gray-600 shadow-sm w-56 h-56" />
          ) : (
            <div className="w-56 h-56 border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-xl flex items-center justify-center text-gray-400 text-sm">
              Generando QR...
            </div>
          )}
          <div className="text-center text-sm">
            <strong className="dark:text-gray-100">{equipo.nombre_marca} {equipo.modelo}</strong>
            <p className="font-mono-num text-xs text-gray-500 dark:text-gray-400 mt-1">{equipo.serial}</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
              <Download size={15} /> Descargar
            </button>
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
              <Printer size={15} /> Imprimir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
