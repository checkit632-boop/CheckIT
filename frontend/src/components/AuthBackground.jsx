import { useState, useEffect } from 'react';

// Imágenes de fondo compartidas por las pantallas de autenticación
// (Login y Recuperar contraseña). Coloca los archivos en
// /frontend/public/login-bg/ con estos mismos nombres, o cambia la lista.
// Acepta entre 3 y 5 imágenes sin tocar nada más de este componente.
const FONDOS = [
  '/login-bg/login-1.jpg',
  '/login-bg/login-2.jpg',
  '/login-bg/login-3.jpg',
  // '/login-bg/login-4.jpg',
  // '/login-bg/login-5.jpg',
];

const DURACION_MS = 3000; // tiempo que se muestra cada imagen antes de rotar

// Fondo con carrusel de imágenes + capa oscura, para usar en pantallas
// tipo "tarjeta centrada" (Login, ForgotPassword). El contenedor padre debe
// tener `relative overflow-hidden`, y el contenido (la tarjeta) debe llevar
// `relative z-10` para quedar por encima de este fondo.
export default function AuthBackground() {
  const [indiceFondo, setIndiceFondo] = useState(0);

  useEffect(() => {
    if (FONDOS.length <= 1) return;
    const timer = setInterval(() => {
      setIndiceFondo((i) => (i + 1) % FONDOS.length);
    }, DURACION_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {FONDOS.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden="true"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
            i === indiceFondo ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}

      {/* Capa oscura para mantener el contraste del formulario sobre cualquier foto */}
      <div className="absolute inset-0 bg-gradient-to-b from-brand-950/60 via-brand-950/40 to-brand-950/70" />

      {FONDOS.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {FONDOS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === indiceFondo ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
              }`}
            />
          ))}
        </div>
      )}
    </>
  );
}