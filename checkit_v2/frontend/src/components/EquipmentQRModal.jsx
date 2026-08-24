import { useEffect, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import api from '../api/client';
import Modal from './Modal';

export default function EquipmentQRModal({ equipo, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    if (!equipo) { setDataUrl(null); return; }
    api.get(`/equipos/${equipo.id_equipo}/qr`).then((res) => setDataUrl(res.data.dataUrl)).catch(() => setDataUrl(null));
  }, [equipo]);

  const handleDownload = () => {
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.download = `QR_Computador_${equipo.serial}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePrint = () => {
    if (!dataUrl) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR ${equipo.serial}</title>
      <style>
        body { font-family: monospace; display:flex; flex-direction:column; align-items:center; padding:2rem; }
        img { border: 1px solid #e5e7eb; border-radius: 8px; }
        p { margin-top: 1rem; font-size:.8rem; color:#6b7280; text-align:center; }
        h3 { color: #16a34a; margin-bottom:.5rem; }
      </style></head><body>
      <h3>CheckIT — Computador</h3>
      <img src="${dataUrl}" width="220" height="220" />
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
            <img src={dataUrl} alt={`QR ${equipo.serial}`} className="rounded-xl border border-gray-200 shadow-sm w-56 h-56" />
          ) : (
            <div className="w-56 h-56 border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 text-sm">
              Generando QR...
            </div>
          )}
          <div className="text-center text-sm">
            <strong>{equipo.nombre_marca} {equipo.modelo}</strong>
            <p className="font-mono-num text-xs text-gray-500 mt-1">{equipo.serial}</p>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-semibold py-2 rounded-xl">
              <Download size={15} /> Descargar
            </button>
            <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white text-sm font-semibold py-2 rounded-xl">
              <Printer size={15} /> Imprimir
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
