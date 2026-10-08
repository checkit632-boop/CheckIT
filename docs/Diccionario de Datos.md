# Diccionario de Datos — CheckIT v6

Fuente de verdad: `backend/db/schema.sql` (copiado tal cual en
`database/Script_checkIt.sql`; se verifica con `npm run sql:check`).
Motor: SQLite. Tipos: `INTEGER`, `TEXT`, `DATETIME` (texto ISO).
PK = llave primaria · FK = llave foránea · UQ = único · NN = obligatorio.

## roles
Jerarquía de acceso: Super Administrador > Administrador > Operador de Sistema.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_rol | INTEGER | PK, autoincremental | Identificador del rol |
| nombre_rol | TEXT | NN, UQ | `Super Administrador`, `Administrador` u `Operador de Sistema` |

## usuarios
Cuentas que inician sesión en el sistema.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_usuario | INTEGER | PK, autoincremental | Identificador |
| usuario | TEXT | NN, UQ | Nombre de inicio de sesión |
| nombre | TEXT | NN | Nombres |
| apellidos | TEXT | NN | Apellidos |
| correo | TEXT | NN, UQ | Canal del tercer factor (PIN) y de recuperación de contraseña |
| celular | TEXT | | Teléfono de contacto |
| id_tipo_documento | INTEGER | FK → tipos_documento | Tipo de documento |
| numero_documento | TEXT | UQ parcial (si no es nulo) | Número de documento |
| password_hash | TEXT | NN | Contraseña cifrada con bcrypt (nunca en texto plano) |
| id_rol | INTEGER | NN, FK → roles | Rol asignado |
| estado | INTEGER | por defecto 1 | 1 = activo, 0 = inactivo (no puede iniciar sesión) |
| fecha_creacion | DATETIME | por defecto ahora | Fecha de creación |

## tipos_documento
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_tipo_documento | INTEGER | PK, autoincremental | Identificador |
| nombre_documento | TEXT | NN, UQ | Cédula de ciudadanía, Tarjeta de identidad, Cédula extranjera, Pasaporte |

## personas
Propietarias de los equipos que entran y salen.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_persona | INTEGER | PK, autoincremental | Identificador |
| id_tipo_documento | INTEGER | NN, FK → tipos_documento | Tipo de documento |
| numero_documento | TEXT | NN, UQ | Número de documento |
| nombres | TEXT | NN | Nombres |
| apellidos | TEXT | NN | Apellidos |
| correo | TEXT | | Correo de contacto |
| celular | TEXT | | Teléfono de contacto |
| fecha_registro | DATETIME | por defecto ahora | Fecha de registro |
| fecha_actualizacion | DATETIME | | Última modificación |

## marcas
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_marca | INTEGER | PK, autoincremental | Identificador |
| nombre_marca | TEXT | NN, UQ | Nombre de la marca |

## estados
Condición física del equipo.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_estado | INTEGER | PK, autoincremental | Identificador |
| nombre_estado | TEXT | NN, UQ | Bueno, Regular, Malo |

## equipos
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_equipo | INTEGER | PK, autoincremental | Identificador |
| id_persona | INTEGER | NN, FK → personas | Propietario |
| id_marca | INTEGER | NN, FK → marcas | Marca |
| modelo | TEXT | | Modelo |
| serial | TEXT | NN, UQ | Serial del fabricante |
| codigo_qr | TEXT | | Contenido codificado en el QR |
| id_estado | INTEGER | NN, FK → estados | Condición física |
| observaciones | TEXT | | Observación vigente del equipo |
| activo | INTEGER | NN, por defecto 1 | 1 = activo, 0 = dado de baja (conserva historial) |
| fecha_registro | DATETIME | por defecto ahora | Fecha de registro |

## tipos_movimiento
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_tipo_movimiento | INTEGER | PK, autoincremental | Identificador |
| nombre_movimiento | TEXT | NN, UQ | Entrada, Salida |

## registros
Control de accesos: cada entrada o salida de un equipo.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_registro | INTEGER | PK, autoincremental | Identificador (define el orden real de los movimientos) |
| id_equipo | INTEGER | NN, FK → equipos | Equipo |
| id_usuario | INTEGER | NN, FK → usuarios | Quién registró el movimiento |
| id_tipo_movimiento | INTEGER | NN, FK → tipos_movimiento | Entrada o salida |
| fecha_hora | DATETIME | por defecto ahora | Fecha y hora (zona America/Bogota) |
| observaciones | TEXT | | Histórico; desde v6 se usa `equipos.observaciones` |

## auditoria
| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_auditoria | INTEGER | PK, autoincremental | Identificador |
| id_usuario | INTEGER | FK → usuarios | Autor de la acción |
| accion | TEXT | NN, CHECK | INSERT, UPDATE, DELETE, LOGIN, LOGOUT, LOGIN_FALLIDO, BLOQUEO, SISTEMA |
| tabla_afectada | TEXT | | Tabla sobre la que se actuó |
| fecha | DATETIME | por defecto ahora | Momento de la acción |
| descripcion | TEXT | | Detalle legible |

## login_intentos
Bloqueo por intentos fallidos de inicio de sesión: 5 intentos bloquean la
cuenta durante 3 minutos.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| usuario | TEXT | PK | Nombre de usuario intentado (exista o no, para no revelar cuáles existen) |
| intentos | INTEGER | NN, por defecto 0 | Intentos fallidos consecutivos |
| bloqueado_hasta | DATETIME | | Fin del bloqueo; nulo si no está bloqueado |

## codigos_verificacion
Códigos de 6 dígitos para el tercer factor del login (`login_2fa`) y para
"olvidé mi contraseña" (`reset_password`). Vencen a los 3 minutos.

| Campo | Tipo | Restricciones | Descripción |
|---|---|---|---|
| id_codigo | INTEGER | PK, autoincremental | Identificador |
| id_usuario | INTEGER | NN, FK → usuarios | Dueño del código |
| codigo_hash | TEXT | NN | Código cifrado con bcrypt (nunca en texto plano) |
| tipo | TEXT | NN, CHECK | `reset_password` o `login_2fa` |
| expira | DATETIME | NN | Momento de vencimiento |
| usado | INTEGER | NN, por defecto 0 | 1 = ya usado o invalidado |
| fecha_creacion | DATETIME | por defecto ahora | Fecha de emisión |
