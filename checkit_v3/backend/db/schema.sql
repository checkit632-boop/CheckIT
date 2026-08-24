-- ═══════════════════════════════════════════════════════════
-- CheckIT — Esquema SQLite (adaptado del script MySQL original)
-- ═══════════════════════════════════════════════════════════
PRAGMA foreign_keys = ON;

-- TABLA ROLES
CREATE TABLE IF NOT EXISTS roles (
  id_rol      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_rol  TEXT NOT NULL UNIQUE
);

-- TABLA USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
  id_usuario      INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario         TEXT NOT NULL UNIQUE,
  nombre          TEXT NOT NULL,
  apellidos       TEXT NOT NULL,
  correo          TEXT,
  celular         TEXT,
  password_hash   TEXT NOT NULL,
  id_rol          INTEGER NOT NULL,
  estado          INTEGER DEFAULT 1, -- 1 activo, 0 inactivo
  fecha_creacion  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- TABLA TIPOS DE DOCUMENTO
CREATE TABLE IF NOT EXISTS tipos_documento (
  id_tipo_documento  INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_documento   TEXT NOT NULL UNIQUE
);

-- TABLA PERSONAS
CREATE TABLE IF NOT EXISTS personas (
  id_persona           INTEGER PRIMARY KEY AUTOINCREMENT,
  id_tipo_documento    INTEGER NOT NULL,
  numero_documento     TEXT NOT NULL UNIQUE,
  nombres              TEXT NOT NULL,
  apellidos            TEXT NOT NULL,
  correo               TEXT,
  celular              TEXT,
  fecha_registro       DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion  DATETIME,
  FOREIGN KEY (id_tipo_documento) REFERENCES tipos_documento(id_tipo_documento)
);

-- TABLA MARCAS
CREATE TABLE IF NOT EXISTS marcas (
  id_marca      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_marca  TEXT NOT NULL UNIQUE
);

-- TABLA ESTADOS (GENERAL)
CREATE TABLE IF NOT EXISTS estados (
  id_estado      INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_estado  TEXT NOT NULL UNIQUE
);

-- TABLA EQUIPOS
CREATE TABLE IF NOT EXISTS equipos (
  id_equipo       INTEGER PRIMARY KEY AUTOINCREMENT,
  id_persona      INTEGER NOT NULL,
  id_marca        INTEGER NOT NULL,
  modelo          TEXT,
  serial          TEXT NOT NULL UNIQUE,
  codigo_qr       TEXT,
  id_estado       INTEGER NOT NULL,
  fecha_registro  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
  FOREIGN KEY (id_marca)   REFERENCES marcas(id_marca),
  FOREIGN KEY (id_estado)  REFERENCES estados(id_estado)
);

-- TABLA TIPOS DE MOVIMIENTO
CREATE TABLE IF NOT EXISTS tipos_movimiento (
  id_tipo_movimiento  INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre_movimiento   TEXT NOT NULL UNIQUE
);

-- TABLA REGISTROS (CONTROL DE ACCESOS)
CREATE TABLE IF NOT EXISTS registros (
  id_registro         INTEGER PRIMARY KEY AUTOINCREMENT,
  id_equipo           INTEGER NOT NULL,
  id_usuario          INTEGER NOT NULL,
  id_tipo_movimiento  INTEGER NOT NULL,
  fecha_hora          DATETIME DEFAULT CURRENT_TIMESTAMP,
  observaciones       TEXT,
  FOREIGN KEY (id_equipo)          REFERENCES equipos(id_equipo),
  FOREIGN KEY (id_usuario)         REFERENCES usuarios(id_usuario),
  FOREIGN KEY (id_tipo_movimiento) REFERENCES tipos_movimiento(id_tipo_movimiento)
);

-- TABLA AUDITORÍA
CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria     INTEGER PRIMARY KEY AUTOINCREMENT,
  id_usuario       INTEGER,
  accion           TEXT NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE','LOGIN','LOGOUT')),
  tabla_afectada   TEXT,
  fecha            DATETIME DEFAULT CURRENT_TIMESTAMP,
  descripcion      TEXT,
  FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);
