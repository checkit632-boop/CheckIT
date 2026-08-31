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
│   │   └── database.js      Conexión + semillas iniciales
│   ├── middleware/
│   │   └── auth.js          Verificación de JWT y roles
│   ├── routes/
│   │   ├── auth.js          Login / registro
│   │   ├── usuarios.js      Gestión de usuarios (solo Administrador)
│   │   ├── personas.js      Personas (aprendices/propietarios de equipos)
│   │   ├── equipos.js       Inventario de computadores + generación de QR
│   │   ├── registros.js     Entradas / salidas
│   │   └── catalogos.js     Marcas, estados, tipos de documento/movimiento
│   └── server.js
└── frontend/          Interfaz (React + Tailwind)
    └── src/
        ├── api/client.js         Cliente Axios (adjunta el JWT automáticamente)
        ├── context/               AuthContext y ToastContext
        ├── components/           Sidebar, Modal, escáner y generador de QR
        └── pages/                Login, Register, Dashboard, Equipos,
                                   EntradasSalidas, Resumen, Usuarios, GenerarQR
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
- crea un usuario **Administrador** por defecto:
  - **usuario:** `admin`
  - **contraseña:** `admin123`

El servidor queda escuchando en `http://localhost:4000`.

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

## Autenticación y roles

El sistema usa JWT. Cada usuario pertenece a uno de dos roles:

| Rol | Permisos |
|---|---|
| **Administrador** | Acceso total: inventario de equipos (crear/editar/eliminar), entradas/salidas, resumen y reportes, gestión de usuarios (crear/editar/eliminar), generación de QR. |
| **Operador de Sistema** | Solo el módulo de **Entradas/Salidas**, y puede **registrar nuevas personas y equipos** (sin poder editarlos ni eliminarlos, ni ver Resumen ni Usuarios). Puede haber más de un operador. |

- El **autoregistro** (`/register`) siempre crea usuarios con rol **Operador
  de Sistema**. Solo un Administrador puede crear otros Administradores desde
  el módulo de Usuarios.
- Las contraseñas se almacenan con `bcrypt` (nunca en texto plano).
- El backend valida el rol en cada endpoint sensible (no solo en el frontend),
  así que aunque alguien manipule la interfaz, la API rechaza operaciones no
  autorizadas con `403`.

## Funcionalidad conservada del prototipo original

- Generación de código QR por equipo (ahora generado en el servidor con la
  librería `qrcode`, y descargable/imprimible desde el frontend).
- Escáner de QR con cámara (librería `html5-qrcode`) con respaldo de ingreso
  manual del serial.
- Dashboard con estadísticas (equipos registrados, entradas/salidas del día).
- Historial de movimientos y resumen general (solo Administrador).

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
