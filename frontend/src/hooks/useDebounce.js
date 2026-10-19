// Devuelve `valor` solo cuando deja de cambiar durante `ms` milisegundos.
// Se usa en los buscadores para no consultar al servidor con cada tecla.
import { useEffect, useState } from 'react';

export default function useDebounce(valor, ms = 300) {
  const [estable, setEstable] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setEstable(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return estable;
}
