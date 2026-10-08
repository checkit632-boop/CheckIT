import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import api from '../api/client';
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

export default function EquipmentQRModal({ equipo, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!equipo) { setDataUrl(null); return; }
    api.get(`/equipos/${equipo.id_equipo}/qr`).then((res) => setDataUrl(res.data.dataUrl)).catch(() => setDataUrl(null));
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

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR ${equipo.serial}</title>
      <style>
        body { font-family: Arial, sans-serif; display:flex; flex-direction:column; align-items:center; padding:2rem; }
        img.logo { width:56px; height:56px; object-fit:contain; margin-bottom:.5rem; }
        img.qr { border: 1px solid #e5e7eb; border-radius: 8px; }
        p { margin-top: 1rem; font-size:.8rem; color:#6b7280; text-align:center; }
        h3 { color: #0d6d32; margin:.25rem 0 .75rem; font-size:1.15rem; }
      </style></head><body>
      <img class="logo" src="/logo.png" onerror="this.style.display='none'" />
      <h3>CheckIT — Computador</h3>
      <img class="qr" src="${dataUrl}" width="220" height="220" />
      <p>${equipo.nombre_marca} ${equipo.modelo || ''}<br/>Serial: <strong>${equipo.serial}</strong></p>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
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
