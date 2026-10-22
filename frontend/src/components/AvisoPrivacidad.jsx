import { ShieldCheck } from 'lucide-react';

// Aviso de tratamiento de datos personales (Ley 1581 de 2012, auditoría
// punto 4). CheckIT solo pide lo mínimo para controlar el ingreso de equipos:
// documento y nombre del propietario, y los datos del equipo; correo y
// celular son opcionales. El texto completo para imprimir y poner en
// portería está en docs/Aviso de Privacidad.md.
export const TEXTO_AVISO =
  'Tratamiento de datos (Ley 1581 de 2012): se registran el documento y el nombre del propietario y los datos del equipo, ' +
  'solo para controlar la entrada y salida de equipos del centro de formación. El correo y el celular son opcionales. ' +
  'Puedes conocer, actualizar, rectificar o pedir la supresión de tus datos ante la administración del centro.';

// compacto: una sola línea con el texto completo al pasar el mouse.
export default function AvisoPrivacidad({ compacto = false }) {
  if (compacto) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400 min-w-0" title={TEXTO_AVISO}>
        <ShieldCheck size={12} className="shrink-0 text-brand-600 dark:text-brand-400" />
        <span className="truncate">Datos tratados según la Ley 1581 de 2012, solo para el control de equipos.</span>
      </div>
    );
  }
  return (
    <div className="flex gap-2 text-[11px] leading-snug text-gray-600 dark:text-gray-300 bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-xl px-3 py-2">
      <ShieldCheck size={14} className="shrink-0 mt-0.5 text-brand-600 dark:text-brand-400" />
      <p>{TEXTO_AVISO}</p>
    </div>
  );
}
