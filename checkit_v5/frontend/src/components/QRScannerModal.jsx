import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, ScanLine } from 'lucide-react';
import Modal from './Modal';

export default function QRScannerModal({ open, onClose, onResult }) {
  const readerRef = useRef(null);
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const stoppingRef = useRef(false);

  const [status, setStatus] = useState({
    type: 'scanning',
    msg: 'Apunta la cámara al código QR del equipo...'
  });

  const [manualSerial, setManualSerial] = useState('');
  const [cameraError, setCameraError] = useState(false);

  const stopCamera = async () => {
    const scanner = scannerRef.current;

    if (!scanner || stoppingRef.current) {
      return;
    }

    stoppingRef.current = true;

    try {
      const state = scanner.getState();

      // 2 = SCANNING, 3 = PAUSED
      if (state === 2 || state === 3) {
        await scanner.stop();
      }
    } catch (error) {
      // Evitamos que un error al detener la cámara rompa React
      console.warn('No fue posible detener el escáner:', error);
    } finally {
      try {
        await scanner.clear();
      } catch (error) {
        // clear puede fallar si el scanner ya fue desmontado
      }

      if (scannerRef.current === scanner) {
        scannerRef.current = null;
      }

      stoppingRef.current = false;
    }
  };

  useEffect(() => {
    if (!open) return;

    scannedRef.current = false;
    stoppingRef.current = false;

    setStatus({
      type: 'scanning',
      msg: 'Apunta la cámara al código QR del equipo...'
    });

    setManualSerial('');
    setCameraError(false);

    const id = 'qr-reader-' + Date.now();

    if (!readerRef.current) {
      return;
    }

    readerRef.current.id = id;

    console.log("Es contexto seguro:", window.isSecureContext);
    console.log("MediaDevices:", navigator.mediaDevices);
    console.log("getUserMedia:", navigator.mediaDevices?.getUserMedia);

    const scanner = new Html5Qrcode(id);
    scannerRef.current = scanner;

    scanner
  .start(
    {
      facingMode: "environment"
    },
    {
      fps: 10,
      qrbox: {
        width: 220,
        height: 220
      }
    },
    (decodedText) => {
      handleScanned(decodedText);
    },
    () => {}
  )
  .catch((error) => {
    alert("Error al iniciar la cámara:\n\n" + error);
    console.error(error);
    setCameraError(true);
  });

    return () => {
      // La limpieza también es segura.
      stopCamera();
    };
  }, [open]);

  const handleScanned = async (raw) => {
    // Evita que el mismo QR sea procesado varias veces
    if (scannedRef.current) {
      return;
    }

    scannedRef.current = true;

    let serial = raw;

    try {
      const parsed = JSON.parse(raw);

      if (parsed?.serial) {
        serial = parsed.serial;
      }
    } catch {
      // Si no es JSON, se toma el contenido como serial directo.
    }

    if (!serial || typeof serial !== 'string' || !serial.trim()) {
      scannedRef.current = false;

      setStatus({
        type: 'error',
        msg: 'El código QR no contiene un serial válido.'
      });

      return;
    }

    setStatus({
      type: 'success',
      msg: 'Código QR leído correctamente'
    });

    // Cerramos el modal.
    // La limpieza del useEffect se encargará de detener la cámara.
    onResult(serial.trim());
  };

  const applyManual = () => {
    const serial = manualSerial.trim();

    if (!serial) {
      return;
    }

    scannedRef.current = true;

    setStatus({
      type: 'success',
      msg: 'Serial ingresado manualmente'
    });

    // Igual que con el QR:
    // al cerrar el modal, el cleanup detendrá la cámara.
    onResult(serial);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        onClose();
      }}
      title="Escanear Código QR"
      maxWidth="max-w-md"
    >
      <div
        className={`flex items-center gap-2 text-sm rounded-xl px-3 py-2.5 mb-4 ${
          status.type === 'success'
            ? 'bg-brand-50 text-brand-800 border border-brand-300'
            : 'bg-brand-50 text-brand-800 border border-brand-200'
        }`}
      >
        {status.type === 'success' ? (
          <CheckCircle2 size={16} />
        ) : (
          <ScanLine size={16} className="animate-pulse" />
        )}

        {status.msg}
      </div>

      <div
        ref={readerRef}
        className="min-h-[220px] bg-gray-900 rounded-xl flex items-center justify-center overflow-hidden"
      >
        {cameraError && (
          <p className="text-gray-400 text-sm text-center px-4">
            No se pudo acceder a la cámara. Usa el ingreso manual.
          </p>
        )}
      </div>

      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 h-px bg-gray-200" />

          <span className="text-xs text-gray-400 font-semibold">
            O ingresa el serial manualmente
          </span>

          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
            placeholder="Número de serie del equipo..."
            value={manualSerial}
            onChange={(e) => setManualSerial(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyManual()}
          />

          <button
            onClick={applyManual}
            className="bg-gradient-to-r from-brand-600 to-brand-500 text-white text-sm font-semibold px-4 rounded-xl"
          >
            Aplicar
          </button>
        </div>
      </div>
    </Modal>
  );
}