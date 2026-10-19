// Captura las lecturas de una pistola lectora de códigos (USB o Bluetooth)
// en cualquier parte de la pantalla, sin abrir la cámara ni tocar el ratón.
//
// Estas pistolas funcionan como un teclado: "escriben" el código muy rápido
// (unos pocos milisegundos entre caracteres) y terminan con Enter. Una
// persona escribe mucho más lento, así que una ráfaga rápida que termina en
// Enter se toma como lectura y se le entrega a onCodigo. Lo que se escribe a
// mano en un campo sigue funcionando igual que antes.
import { useEffect, useRef } from 'react';

// Tiempo máximo entre dos caracteres para seguir considerándolos parte de la
// misma lectura. Las pistolas suelen enviar cada carácter en 5–30 ms.
const MAX_MS_ENTRE_TECLAS = 50;
const LARGO_MINIMO = 4;

// Lógica del detector, sin React, para poder probarla por separado.
// Devuelve el manejador de keydown; `reloj` permite simular el tiempo.
export function crearDetectorLector(onCodigo, reloj = () => performance.now()) {
  let buffer = '';
  let ultimaTecla = -Infinity;

  return (e) => {
    const ahora = reloj();
    const continuaRafaga = ahora - ultimaTecla <= MAX_MS_ENTRE_TECLAS;
    ultimaTecla = ahora;

    if (e.key === 'Enter') {
      const codigo = buffer;
      buffer = '';
      if (continuaRafaga && codigo.length >= LARGO_MINIMO) {
        // Se detiene aquí (fase de captura) para que el Enter no dispare
        // también la búsqueda manual del campo que tenga el foco.
        e.preventDefault();
        e.stopPropagation();
        onCodigo(codigo);
      }
      return;
    }

    if (e.key.length !== 1 || e.ctrlKey || e.altKey || e.metaKey) return;
    buffer = continuaRafaga ? buffer + e.key : e.key;
  };
}

export default function useLectorCodigos(onCodigo, { activo = true } = {}) {
  const onCodigoRef = useRef(onCodigo);
  onCodigoRef.current = onCodigo;

  useEffect(() => {
    if (!activo) return undefined;
    const alPresionar = crearDetectorLector((codigo) => onCodigoRef.current(codigo));
    window.addEventListener('keydown', alPresionar, true);
    return () => window.removeEventListener('keydown', alPresionar, true);
  }, [activo]);
}
