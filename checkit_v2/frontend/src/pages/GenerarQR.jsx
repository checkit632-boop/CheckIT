import { useEffect, useState } from 'react';
import { QrCode, Download, Printer } from 'lucide-react';
import api from '../api/client';

export default function GenerarQR() {
  const [equipos, setEquipos] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [dataUrl, setDataUrl] = useState(null);

  useEffect(() => {
    api.get('/equipos').then((res) => setEquipos(res.data));
  }, []);

  useEffect(() => {
    if (!selectedId) { setDataUrl(null); return; }
    api.get(`/equipos/${selectedId}/qr`).then((res) => setDataUrl(res.data.dataUrl));
  }, [selectedId]);

  const equipo = equipos.find((e) => String(e.id_equipo) === String(selectedId));

  const handleDownload = () => {
    if (!dataUrl || !equipo) return;
    const link = document.createElement('a');
    link.download = `QR_Computador_${equipo.serial}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePrint = () => {
    if (!dataUrl || !equipo) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>QR ${equipo.serial}</title>
      <style>body{font-family:monospace;display:flex;flex-direction:column;align-items:center;padding:2rem}
      img{border:1px solid #e5e7eb;border-radius:8px}
      h3{color:#16a34a;margin-bottom:.5rem}
      p{margin-top:1rem;font-size:.8rem;color:#6b7280;text-align:center}</style></head><body>
      <h3>CheckIT — Computador</h3>
      <img src="${dataUrl}" width="220" height="220"/>
      <p>${equipo.nombre_marca} ${equipo.modelo || ''}<br/>Serial: <strong>${equipo.serial}</strong></p>
      <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>`);
    win.document.close();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Generar Código QR</h1>
        <p className="text-sm text-gray-500 mt-1">Selecciona un computador para generar su código QR</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-lg">
        <label className="text-sm font-semibold text-gray-700">Seleccionar Computador por Serial</label>
        <select
          className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">-- Seleccione el computador --</option>
          {equipos.map((e) => (
            <option key={e.id_equipo} value={e.id_equipo}>{e.nombre_marca} {e.modelo || ''} — {e.serial}</option>
          ))}
        </select>

        <div className="flex flex-col items-center gap-4 mt-6">
          {dataUrl ? (
            <img src={dataUrl} alt="QR" className="w-52 h-52 rounded-xl border border-gray-200 shadow-sm" />
          ) : (
            <div className="w-52 h-52 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center text-gray-400 text-sm text-center p-4 gap-2">
              <QrCode size={28} />
              Selecciona un computador para generar su código QR
            </div>
          )}
          {dataUrl && (
            <div className="flex gap-3 w-full">
              <button onClick={handleDownload} className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-semibold py-2 rounded-xl">
                <Download size={15} /> Descargar QR
              </button>
              <button onClick={handlePrint} className="flex-1 flex items-center justify-center gap-2 bg-gray-800 text-white text-sm font-semibold py-2 rounded-xl">
                <Printer size={15} /> Imprimir
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
