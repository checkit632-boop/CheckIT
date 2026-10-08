// Lógica de los dos pasos del inicio de sesión. Login.jsx solo maqueta.
//
// Paso 'credenciales': usuario + contraseña. Si la cuenta tiene correo, el
// backend responde requiereCodigo y se pasa al paso 'codigo' (tercer factor:
// PIN de 6 dígitos enviado al correo). Si la cuenta no tiene correo, el
// backend entrega el token directamente para no dejarla sin forma de entrar
// (ver backend/routes/auth.js) y se navega de una vez.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RUTA_INICIO = '/entradas-salidas';

export default function useLogin() {
  const { login, verifyLoginCode, resendLoginCode } = useAuth();
  const navigate = useNavigate();

  const [paso, setPaso] = useState('credenciales'); // 'credenciales' | 'codigo'
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [idUsuarioPendiente, setIdUsuarioPendiente] = useState(null);
  const [infoCodigo, setInfoCodigo] = useState('');
  const [ultimoUsuario, setUltimoUsuario] = useState('');

  // Ejecuta una acción mostrando el estado de carga y el error del backend
  // (o uno genérico si la respuesta no trae mensaje).
  const ejecutar = async (accion, errorPorDefecto) => {
    setError('');
    setCargando(true);
    try {
      await accion();
    } catch (err) {
      setError(err.response?.data?.error || errorPorDefecto);
    } finally {
      setCargando(false);
    }
  };

  const enviarCredenciales = (usuario, password) => ejecutar(async () => {
    setUltimoUsuario(usuario);
    const resultado = await login(usuario, password);
    if (!resultado.requiereCodigo) {
      navigate(RUTA_INICIO);
      return;
    }
    setIdUsuarioPendiente(resultado.id_usuario);
    setInfoCodigo(resultado.mensaje || 'Ingresa el código enviado a tu correo.');
    setPaso('codigo');
  }, 'Usuario o contraseña incorrectos');

  const verificarCodigo = (codigo) => ejecutar(async () => {
    await verifyLoginCode(idUsuarioPendiente, codigo);
    navigate(RUTA_INICIO);
  }, 'Código incorrecto');

  // Pedir un código nuevo invalida el anterior en el backend; también es la
  // salida cuando el código se bloquea por demasiados intentos (O-02).
  const reenviarCodigo = async () => {
    setReenviando(true);
    setError('');
    try {
      const data = await resendLoginCode(idUsuarioPendiente);
      setInfoCodigo(data.mensaje || 'Se envió un nuevo código.');
    } catch {
      setError('No se pudo reenviar el código');
    } finally {
      setReenviando(false);
    }
  };

  const volverACredenciales = () => {
    setError('');
    setPaso('credenciales');
  };

  return {
    paso, error, cargando, reenviando, infoCodigo, ultimoUsuario,
    enviarCredenciales, verificarCodigo, reenviarCodigo, volverACredenciales,
  };
}
