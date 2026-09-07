# CheckIT — Sistema de Control de Equipos

Conversión completa del prototipo original (HTML/CSS/JS + localStorage) a una
aplicación full-stack:

- **Frontend:** React + Tailwind CSS (Vite)
- **Backend:** Node.js + Express.js (API REST)
- **Base de datos:** SQLite (archivo local, sin necesidad de servidor de BD)

## Estructura del proyecto

```
checkit/
├── backend/          API REST (Express + SQLite)
│   ├── db/
│   │   ├── schema.sql       Esquema de la base de datos
│   │   └── database.js      Conexión + migraciones + semillas iniciales
│   ├── middleware/
│   │   └── auth.js          Verificación de JWT y roles
│   ├── utils/
│   │   └── mailer.js        Envío de correos (SMTP / nodemailer)
│   ├── routes/
│   │   ├── auth.js          Login (con tercer factor), recuperar contraseña
│   │   ├── usuarios.js      Gestión de usuarios (Super Administrador / Administrador)
│   │   ├── personas.js      Personas (propietarias de equipos)
│   │   ├── equipos.js       Inventario de computadores + generación de QR
│   │   ├── registros.js     Entradas / salidas
│   │   └── catalogos.js     Marcas, estados, tipos de documento/movimiento
│   └── server.js
└── frontend/          Interfaz (React + Tailwind)
    └── src/
        ├── api/client.js         Cliente Axios (adjunta el JWT automáticamente)
        ├── context/               AuthContext, ThemeContext y ToastContext
        ├── components/           Sidebar, Modal, AuthBackground, escáner y generador de QR
        └── pages/                Login, ForgotPassword, Equipos,
                                   EntradasSalidas, Resumen, Usuarios
```

## Requisitos

- Node.js 18 o superior
- npm

## Instalación y ejecución

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # opcional: cambia el JWT_SECRET en producción
npm run dev                # o: npm start
```

Esto:
- crea el archivo `db/checkit.db` (SQLite) si no existe,
- crea las tablas del esquema,
- inserta los catálogos iniciales (roles, marcas, estados, tipos de documento/movimiento),
- migra automáticamente bases de datos creadas con versiones anteriores
  (agrega el rol Super Administrador, la columna `observaciones` en equipos,
  y el tipo/número de documento en usuarios, sin borrar nada),
- crea un usuario **Super Administrador** por defecto:
  - **usuario:** `admin`
  - **contraseña:** `admin123`
  - **correo:** `checkit632@gmail.com` (recibe ahí el PIN del tercer factor
    al iniciar sesión — ver la sección de correo SMTP más abajo)

Si tu base de datos ya existía de una versión anterior con el correo de
ejemplo `admin@checkit.co`, la migración lo reemplaza automáticamente por
`checkit632@gmail.com` la primera vez que arrancas el backend con este
código. El tipo y número de documento del usuario `admin`, en cambio, quedan
vacíos hasta que entres a **Registro de Usuarios** y edites esa cuenta una
vez para completarlos (son obligatorios para guardar cualquier edición).

El servidor queda escuchando en `http://localhost:4000`.

### 1.1 Configurar el envío real de correos (Gmail)

El PIN del tercer factor y el código de "olvidé mi contraseña" **solo llegan
a un correo real si configuras SMTP** en `backend/.env`. Sin esto, el código
solo se ve en la consola del backend (modo de prueba).

Ya dejamos `backend/.env` con los datos de `checkit632@gmail.com`
completados, **excepto la contraseña** — Gmail no permite usar la contraseña
normal de la cuenta para SMTP, hay que generar una "Contraseña de
aplicación":

1. Entra a la cuenta de Google `checkit632@gmail.com` → [myaccount.google.com/security](https://myaccount.google.com/security).
2. Activa la **Verificación en 2 pasos** si no está activada (es obligatoria para poder generar contraseñas de aplicación).
3. Ve a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), crea una nueva (nombre sugerido: "CheckIT"), y copia el código de 16 caracteres que te muestra (sin espacios).
4. Pégalo en `backend/.env`, en la línea `SMTP_PASS=`.
5. Reinicia el backend (`npm run dev`).

A partir de ahí, tanto el PIN de inicio de sesión como el código de
recuperación de contraseña se enviarán de verdad al correo registrado —
incluyendo el de cualquier Administrador u Operador de Sistema que crees
después, siempre que le registres un correo real y al que tenga acceso.

### 2. Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

Abre `http://localhost:5173`. En desarrollo, Vite redirige automáticamente las
peticiones a `/api/*` hacia el backend en el puerto 4000 (ver `vite.config.js`).

Para producción:

```bash
npm run build
```

Esto genera la carpeta `dist/` lista para servir con cualquier servidor
estático (Nginx, Apache, `serve`, etc.). Recuerda apuntar las peticiones
`/api` hacia tu backend en producción (proxy inverso o variable de entorno).

## Autenticación y roles (v6)

El sistema usa JWT. Cada usuario pertenece a uno de tres roles, con una
jerarquía de creación estricta:

| Rol | Permisos | Puede crear |
|---|---|---|
| **Super Administrador** | Acceso total a todos los módulos, código y base de datos. | Administradores y Operadores de Sistema |
| **Administrador** | Inventario de equipos (crear/editar/eliminar), entradas/salidas, resumen y reportes, gestión de usuarios. | Operadores de Sistema |
| **Operador de Sistema** | Solo el módulo de **Entradas/Salidas** y **Registro de Equipos** (crear, sin editar/eliminar). | — |

- **No existe autoregistro público.** Todas las cuentas se crean dentro del
  sistema, respetando la jerarquía: el Super Administrador crea
  Administradores, y un Administrador crea Operadores de Sistema. El backend
  valida esta jerarquía en cada petición, no solo el frontend.
- **Tipo y número de documento obligatorios:** cada Administrador u Operador
  de Sistema se registra con el mismo catálogo de tipos de documento que ya
  usaban las personas propietarias de equipos (Cédula de ciudadanía, Tarjeta
  de identidad, Cédula extranjera, Pasaporte). No se puede repetir un número
  de documento entre dos cuentas.
- **Correo obligatorio y real:** ya no es opcional. Es el canal del tercer
  factor de seguridad (PIN) y de "olvidé mi contraseña", así que el backend
  rechaza guardar un usuario sin un correo con formato válido.
- **Cuenta interna `sistema`:** se crea automáticamente (bloqueada, sin
  login posible) para autorar los cierres automáticos de equipos del
  reinicio operativo. No aparece en Registro de Usuarios ni se puede editar
  o eliminar desde ahí.
- **Inactivar (no eliminar) usuarios y equipos — solo Super Administrador:**
  pensado para cuando una persona se retira o un equipo se da de baja. Es una
  acción separada de "editar" (no se puede cambiar el estado como efecto
  secundario de una edición normal) y nunca borra el historial:
  - Un usuario inactivo no puede iniciar sesión, pero su auditoría y los
    movimientos que registró en su momento se conservan.
  - Un equipo inactivo no puede registrar nuevas entradas/salidas, pero
    conserva todo su historial. Es también la forma correcta de "eliminar"
    un equipo que ya tiene movimientos (el `DELETE` normal falla a propósito
    en ese caso, para no perder el historial, y sugiere inactivarlo).
- **Inicio de sesión con tercer factor de seguridad:** además de
  usuario + contraseña, se envía un PIN de 6 dígitos al correo de la cuenta,
  que debe confirmarse para completar el acceso.
- **Bloqueo por intentos fallidos:** 5 intentos fallidos bloquean la cuenta
  por 3 minutos.
- **"Olvidé mi contraseña"** con verificación por código de 6 dígitos enviado
  al correo registrado.
- Las contraseñas se almacenan con `bcrypt` (nunca en texto plano).
- El backend valida el rol en cada endpoint sensible (no solo en el frontend),
  así que aunque alguien manipule la interfaz, la API rechaza operaciones no
  autorizadas con `403`.
- **Envío de correos:** ver la sección "Configurar el envío real de correos
  (Gmail)" más arriba. Sin SMTP configurado, el sistema sigue funcionando en
  modo de prueba (el código solo se ve en la consola del backend), pero no
  llega a ningún correo real.

## Otras novedades de la versión 6

- **Reinicio operativo diario (11:59 p.m.):** no borra ningún dato. Además:
  - A cada equipo que sigue marcado como "Adentro" (nunca registró salida)
    se le crea automáticamente un registro de **Salida**, autorado por la
    cuenta interna `sistema` (una cuenta bloqueada, sin login posible, que
    solo existe para dejar constancia de que ese cierre no lo hizo una
    persona). Así "Equipos Dentro" arranca cada día en 0 y no queda un
    movimiento sin cerrar en el historial.
  - Se registra en la auditoría cuántos equipos se cerraron así.
- **Auditoría (Dashboard del Super Administrador):** módulo exclusivo del
  Super Administrador con dos vistas — movimientos de equipos (quién
  registró cada entrada/salida, o si fue un cierre automático del sistema) e
  inicios de sesión (quién entró al sistema y cuándo) — con filtro por
  Hoy / Esta semana / Este mes. "Hoy" se reinicia solo a las 00:00, igual
  que en Control de Acceso.
- **"Movimientos Recientes" (Control de Acceso):** ahora solo muestra los
  del día actual, y cada Administrador/Operador de Sistema solo ve los que
  él mismo registró — el Super Administrador ve los de todos. La tarjeta de
  conteo respeta la misma regla.
- **Observaciones movidas a Equipos:** se registran una sola vez al crear o
  editar el equipo y se muestran automáticamente en cada entrada/salida y en
  el Historial de Movimientos, sin tener que volver a escribirlas.
- **Historial de Movimientos:** ahora incluye Responsable, tanto en pantalla
  como en las exportaciones a PDF y CSV (Observaciones se quitó de los
  reportes, pero se sigue viendo en pantalla).
- **Reportes (PDF/CSV):** pie de página con el logo de CheckIT y el nombre
  de la empresa (TECNOSOFT).
- **Código QR:** al descargar se genera una tarjeta con Marca, Modelo, Serial
  y el título "CheckIT - Computador"; al imprimir se incluye el logo y el
  nombre de CheckIT.
- **Modo claro/oscuro** disponible desde la barra lateral. En modo claro las
  tarjetas usan un blanco suavizado (`surface`), no blanco puro.
- **Colores del sistema:** se eliminaron los degradados en los botones,
  reemplazados por un tono verde sólido más profesional.
- **Clima con temperatura (°C)** según la ubicación, visible en Control de
  Acceso.
- **Fondo del login/recuperar contraseña:** carrusel de imágenes (o video)
  en `frontend/public/login-bg/`, configurable desde `AuthBackground.jsx`.

## Funcionalidad conservada del prototipo original

- Generación de código QR por equipo (ahora generado en el servidor con la
  librería `qrcode`, y descargable/imprimible desde el frontend).
- Escáner de QR con cámara (librería `html5-qrcode`) con respaldo de ingreso
  manual del serial.
- Historial de movimientos y resumen general (Administrador y Super Administrador).

## Notas sobre el script de base de datos original

El script que compartiste (`CREATE DATABASE checkIt; ... MySQL`) fue adaptado
a SQLite en `backend/db/schema.sql`:
- `AUTO_INCREMENT` → `INTEGER PRIMARY KEY AUTOINCREMENT`
- `ENUM(...)` → `TEXT CHECK (columna IN (...))`
- Se eliminaron `CREATE DATABASE` / `USE`, ya que SQLite usa un solo archivo.

Si en el futuro prefieres migrar a MySQL/PostgreSQL en producción, la
estructura de tablas y relaciones es la misma; solo habría que cambiar el
driver (`better-sqlite3` → `mysql2` o `pg`) y las consultas con parámetros
posicionales (`?`) siguen siendo compatibles con MySQL.
