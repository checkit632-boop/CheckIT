// Envío de correos para "olvidé mi contraseña" y el tercer factor (código de
// 6 dígitos) del login. Si no hay credenciales SMTP configuradas en el .env,
// el sistema sigue funcionando: el código se muestra en la consola del
// servidor (y, solo fuera de producción, se incluye en la respuesta de la
// API) para que el flujo se pueda probar sin depender de un proveedor de
// correo real.
const path = require('path');
const fs = require('fs');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (err) {
  nodemailer = null;
}

const SMTP_CONFIGURADO = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const EMPRESA_NOMBRE = process.env.EMPRESA_NOMBRE || 'TECNOSOFT';

// Logo embebido en el correo (referenciado por cid, no por URL pública, así
// se ve igual sin depender de que el sitio esté publicado en internet).
const LOGO_PATH = path.join(__dirname, '../assets/logo.png');
const LOGO_CID = 'checkit-logo';
const LOGO_DISPONIBLE = fs.existsSync(LOGO_PATH);

let transporter = null;
if (nodemailer && SMTP_CONFIGURADO) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      // .trim() evita fallos silenciosos por un espacio de más al copiar
      // la "Contraseña de aplicación" de Gmail.
      user: process.env.SMTP_USER.trim(),
      pass: process.env.SMTP_PASS.trim(),
    },
  });
}

async function enviarCodigo({ correo, nombre, codigo, asunto, intro, minutos = 10 }) {
  const html = `
  <div style="background:#f1f8f4; padding:32px 16px; font-family: Arial, Helvetica, sans-serif;">
    <div style="max-width:460px; margin:0 auto; background:#ffffff; border-radius:20px;
                overflow:hidden; border:1px solid #e5f0e9; box-shadow:0 4px 16px rgba(21,137,66,0.08);">

      <!-- Encabezado -->
      <div style="background:#ffffff; padding:28px 24px; text-align:center; border-bottom:1px solid #f0f0f0;">
        ${LOGO_DISPONIBLE ? `<img src="cid:${LOGO_CID}" alt="CheckIT" width="72" height="72" style="display:block; margin:0 auto 10px; border-radius:14px;" />` : ''}
        <div style="color:#111827; font-size:22px; font-weight:bold; letter-spacing:.3px;">CheckIT</div>
      </div>

      <!-- Cuerpo -->
      <div style="padding:32px 28px;">
        <p style="margin:0 0 4px; color:#111827; font-size:15px;">Hola ${nombre || ''},</p>
        <p style="margin:0 0 24px; color:#4b5563; font-size:14px; line-height:1.5;">${intro}</p>

        <div style="background:#f1f8f4; border:1px solid #b9e9cc; border-radius:14px; padding:18px 8px; text-align:center; margin-bottom:18px;">
          <div style="font-size:26px; font-weight:bold; letter-spacing:6px; color:#0d6d32; font-family: 'Courier New', monospace; white-space:nowrap;">
            ${codigo}
          </div>
        </div>

        <p style="margin:0; text-align:center; color:#6b7280; font-size:12.5px;">
          Este código vence en <strong style="color:#374151;">${minutos} minuto${minutos === 1 ? '' : 's'}</strong>.
          Si no solicitaste esta acción, puedes ignorar este correo.
        </p>
      </div>

      <!-- Pie -->
      <div style="background:#f9fafb; padding:14px 24px; text-align:center; border-top:1px solid #f0f0f0;">
        <p style="margin:0; color:#9ca3af; font-size:11px;">CheckIT · Sistema de Control de Equipos de Cómputo · ${EMPRESA_NOMBRE}</p>
      </div>

    </div>
  </div>`;

  if (transporter && correo) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || `CheckIT <no-responder@${EMPRESA_NOMBRE.toLowerCase()}.co>`,
        to: correo,
        subject: asunto,
        html,
        attachments: LOGO_DISPONIBLE
          ? [{ filename: 'logo.png', path: LOGO_PATH, cid: LOGO_CID }]
          : [],
      });
      return { enviado: true, simulado: false };
    } catch (err) {
      console.error('✖ Error enviando correo, se muestra el código en consola:', err.message);
      if (/BadCredentials|Username and Password not accepted/i.test(err.message)) {
        console.error(
          '  ↳ Gmail rechazó las credenciales SMTP. Revisa: (1) que SMTP_PASS sea una ' +
          '"Contraseña de aplicación" de 16 caracteres (no la contraseña normal de la ' +
          'cuenta), (2) que la Verificación en 2 pasos esté activa en esa cuenta de Google, ' +
          '(3) que reiniciaste el backend después de editar el .env, y (4) que no haya ' +
          'espacios de más al pegarla.'
        );
      }
    }
  }

  // Modo de respaldo (sin SMTP configurado o si el envío falló)
  console.log(`\n📧 [CheckIT] Código para ${correo || 'usuario sin correo'}: ${codigo}  (${asunto})\n`);
  return { enviado: false, simulado: true };
}

module.exports = { enviarCodigo, SMTP_CONFIGURADO, EMPRESA_NOMBRE };
