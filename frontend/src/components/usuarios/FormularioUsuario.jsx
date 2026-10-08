import Modal from '../Modal';

const inputCls = 'mt-1 w-full border border-gray-200 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500';
const labelCls = 'text-sm font-semibold text-gray-700 dark:text-gray-300';
const ayudaCls = 'text-[11px] text-gray-400 dark:text-gray-500 mt-1';

function CampoTexto({ etiqueta, valor, onChange, ...props }) {
  return (
    <div>
      <label className={labelCls}>{etiqueta}</label>
      <input className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)} {...props} />
    </div>
  );
}

// Modal de creación/edición. Es un componente controlado: el estado del
// formulario vive en la página y aquí solo se muestra y se actualiza.
export default function FormularioUsuario({ abierto, esEdicion, form, setForm, roles, tiposDocumento, onCerrar, onGuardar }) {
  const campo = (nombre) => (valor) => setForm((f) => ({ ...f, [nombre]: valor }));

  return (
    <Modal open={abierto} onClose={onCerrar} title={esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'}>
      <form onSubmit={onGuardar} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <CampoTexto etiqueta="Nombre" valor={form.nombre} onChange={campo('nombre')} required />
          <CampoTexto etiqueta="Apellidos" valor={form.apellidos} onChange={campo('apellidos')} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Tipo de documento</label>
            <select className={inputCls} value={form.id_tipo_documento} onChange={(e) => campo('id_tipo_documento')(Number(e.target.value))} required>
              <option value="">Seleccione...</option>
              {tiposDocumento.map((td) => <option key={td.id_tipo_documento} value={td.id_tipo_documento}>{td.nombre_documento}</option>)}
            </select>
          </div>
          <CampoTexto etiqueta="Número de documento" valor={form.numero_documento} onChange={campo('numero_documento')} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* El correo es obligatorio porque es el canal del PIN de inicio de sesión y de la recuperación de contraseña. */}
          <div>
            <label className={labelCls}>Correo <span className="text-red-500">*</span></label>
            <input type="email" className={inputCls} value={form.correo} onChange={(e) => campo('correo')(e.target.value)} placeholder="correo@real.com" required />
            <p className={ayudaCls}>Debe ser un correo real y al que la persona tenga acceso: ahí le llegará el PIN de 6 dígitos para iniciar sesión.</p>
          </div>
          <CampoTexto etiqueta="Celular" valor={form.celular} onChange={campo('celular')} />
        </div>
        <CampoTexto etiqueta="Usuario" valor={form.usuario} onChange={campo('usuario')} required />
        <div>
          <label className={labelCls}>Contraseña {esEdicion && <span className="text-gray-400 dark:text-gray-500 font-normal">(dejar en blanco para no cambiar)</span>}</label>
          <input type="password" className={inputCls} value={form.password} onChange={(e) => campo('password')(e.target.value)} />
          <p className={ayudaCls}>Mínimo 8 caracteres, con mayúscula, minúscula y número.</p>
        </div>
        <div>
          <label className={labelCls}>Rol</label>
          <select className={inputCls} value={form.id_rol} onChange={(e) => campo('id_rol')(Number(e.target.value))}>
            {roles.map((r) => <option key={r.id_rol} value={r.id_rol}>{r.nombre_rol}</option>)}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onCerrar} className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold text-sm py-2.5 rounded-xl">Cancelar</button>
          <button type="submit" className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">Guardar Usuario</button>
        </div>
      </form>
    </Modal>
  );
}
