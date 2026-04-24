CREATE DATABASE checkIt;
USE checkIt;


-- TABLA ROLES
CREATE TABLE roles (
    id_rol INT AUTO_INCREMENT PRIMARY KEY,
    nombre_rol VARCHAR(50) NOT NULL UNIQUE
);

-- TABLA USUARIOS
CREATE TABLE usuarios (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    usuario VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_rol INT NOT NULL,
    estado TINYINT DEFAULT 1,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol)
);

-- TABLA TIPOS DE DOCUMENTO
CREATE TABLE tipos_documento (
    id_tipo_documento INT AUTO_INCREMENT PRIMARY KEY,
    nombre_documento VARCHAR(50) NOT NULL UNIQUE
);

-- TABLA PERSONAS
CREATE TABLE personas (
    id_persona INT AUTO_INCREMENT PRIMARY KEY,
    id_tipo_documento INT NOT NULL,
    numero_documento VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    correo VARCHAR(120),
    celular VARCHAR(20),
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion DATETIME NULL,
    FOREIGN KEY (id_tipo_documento) REFERENCES tipos_documento(id_tipo_documento)
);

-- TABLA MARCAS 
CREATE TABLE marcas (
    id_marca INT AUTO_INCREMENT PRIMARY KEY,
    nombre_marca VARCHAR(50) NOT NULL UNIQUE
);

-- TABLA ESTADOS (GENERAL)
CREATE TABLE estados (
    id_estado INT AUTO_INCREMENT PRIMARY KEY,
    nombre_estado VARCHAR(50) NOT NULL UNIQUE
);

-- TABLA EQUIPOS
CREATE TABLE equipos (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    id_persona INT NOT NULL,
    id_marca INT NOT NULL,
    modelo VARCHAR(80),
    serial VARCHAR(100) NOT NULL UNIQUE,
    codigo_qr VARCHAR(255),
    id_estado INT NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_persona) REFERENCES personas(id_persona),
    FOREIGN KEY (id_marca) REFERENCES marcas(id_marca),
    FOREIGN KEY (id_estado) REFERENCES estados(id_estado)
);

-- TABLA TIPOS DE MOVIMIENTO
CREATE TABLE tipos_movimiento (
    id_tipo_movimiento INT AUTO_INCREMENT PRIMARY KEY,
    nombre_movimiento VARCHAR(20) NOT NULL UNIQUE
);

-- TABLA REGISTROS (CONTROL DE ACCESOS)
CREATE TABLE registros (
    id_registro INT AUTO_INCREMENT PRIMARY KEY,
    id_equipo INT NOT NULL,
    id_usuario INT NOT NULL,
    id_tipo_movimiento INT NOT NULL,
    fecha_hora DATETIME DEFAULT CURRENT_TIMESTAMP,
    observaciones TEXT,
    FOREIGN KEY (id_equipo) REFERENCES equipos(id_equipo),
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario),
    FOREIGN KEY (id_tipo_movimiento) REFERENCES tipos_movimiento(id_tipo_movimiento)
);

-- TABLA AUDITORÍA
CREATE TABLE auditoria (
    id_auditoria INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT,
    accion ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGOUT') NOT NULL,
    tabla_afectada VARCHAR(50),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    descripcion TEXT,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
);

-- DATOS INICIALES 

-- Roles
INSERT INTO roles (nombre_rol) VALUES 
('Administrador'),
('Aprendiz');

-- Tipos de documento
INSERT INTO tipos_documento (nombre_documento) VALUES
('Cédula de ciudadanía'),
('Tarjeta de identidad'),
('Cédula extranjera'),
('Pasaporte');

-- Estados
INSERT INTO estados (nombre_estado) VALUES
('Activo'),
('Inactivo'),
('En mantenimiento'),
('Dañado');

-- Tipos de movimiento
INSERT INTO tipos_movimiento (nombre_movimiento) VALUES
('Entrada'),
('Salida');

-- Marcas 
INSERT INTO marcas (nombre_marca) VALUES
('HP'),
('Dell'),
('Lenovo'),
('Asus'),
('Acer'),
('Apple'),
('Samsung'),
('MSI'),
('Huawei'),
('Xiaomi'),
('Alienware'),
('Toshiba');