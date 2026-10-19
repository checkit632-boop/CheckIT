// Límites de peticiones para las rutas de autenticación (auditoría: "falta
// de rate limiting en endpoints sensibles").
//
// El bloqueo de login_intentos protege cada cuenta, pero no impedía que
// desde un mismo equipo se probara una contraseña en muchas cuentas, ni que
// se usaran /login/reenviar y /forgot-password para llenar de correos a un
// usuario o agotar la cuota diaria de Gmail.
//
// Cada ruta tiene dos límites:
// - uno estricto por IP + cuenta (usuario, correo o id), para la cuenta
//   atacada;
// - uno amplio solo por IP, para quien prueba muchas cuentas. Es amplio a
//   propósito: varias porterías pueden salir a la red con la misma IP.
// La IP real se toma de X-Forwarded-For solo si la petición viene de un
// proxy de confianza (ver 'trust proxy' en server.js).
const rateLimit = require('express-rate-limit');

const MINUTO = 60 * 1000;

function crearLimite({ ventanaMin, maximo, mensaje, porCuenta }) {
  return rateLimit({
    windowMs: ventanaMin * MINUTO,
    limit: maximo,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: porCuenta
      ? (req) => `${req.ip}|${String(porCuenta(req) ?? '').trim().toLowerCase()}`
      : (req) => req.ip,
    handler: (req, res, _next, opciones) => {
      const minutos = Math.ceil(opciones.windowMs / MINUTO);
      res.status(429).json({ error: `${mensaje} Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.` });
    },
  });
}

const cuentaLogin = (req) => req.body?.usuario;
const cuentaCodigo = (req) => req.body?.id_usuario;
const cuentaRecuperacion = (req) => req.body?.identificador;

// Inicio de sesión y validación del código (el bloqueo por cuenta ya existe;
// esto frena el ataque desde un mismo equipo contra muchas cuentas).
const limiteLogin = [
  crearLimite({ ventanaMin: 15, maximo: 100, mensaje: 'Demasiados intentos de inicio de sesión desde este equipo.' }),
  crearLimite({ ventanaMin: 15, maximo: 20, porCuenta: cuentaLogin, mensaje: 'Demasiados intentos de inicio de sesión para esta cuenta.' }),
];
const limiteCodigo = [
  crearLimite({ ventanaMin: 15, maximo: 100, mensaje: 'Demasiados códigos enviados desde este equipo.' }),
  crearLimite({ ventanaMin: 15, maximo: 20, porCuenta: cuentaCodigo, mensaje: 'Demasiados códigos enviados para esta cuenta.' }),
];

// Rutas que envían un correo: más estrictas, cada petición gasta cuota SMTP.
const limiteReenvio = [
  crearLimite({ ventanaMin: 10, maximo: 30, mensaje: 'Se pidieron demasiados correos desde este equipo.' }),
  crearLimite({ ventanaMin: 10, maximo: 5, porCuenta: cuentaCodigo, mensaje: 'Se pidieron demasiados códigos para esta cuenta.' }),
];
const limiteRecuperacion = [
  crearLimite({ ventanaMin: 10, maximo: 30, mensaje: 'Se pidieron demasiadas recuperaciones desde este equipo.' }),
  crearLimite({ ventanaMin: 10, maximo: 5, porCuenta: cuentaRecuperacion, mensaje: 'Se pidieron demasiadas recuperaciones para esta cuenta.' }),
];

// Restablecer no envía correo, pero valida el código: más margen por cuenta
// para quien se equivoca al escribirlo (el código ya se invalida a los 5
// intentos fallidos, O-02).
const limiteRestablecer = [
  crearLimite({ ventanaMin: 10, maximo: 30, mensaje: 'Demasiados intentos de restablecer contraseña desde este equipo.' }),
  crearLimite({ ventanaMin: 10, maximo: 10, porCuenta: cuentaRecuperacion, mensaje: 'Demasiados intentos de restablecer la contraseña de esta cuenta.' }),
];

module.exports = { limiteLogin, limiteCodigo, limiteReenvio, limiteRecuperacion, limiteRestablecer };
