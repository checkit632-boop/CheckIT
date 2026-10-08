# Diagrama Entidad-Relación — CheckIT v6

Generado a partir de `backend/db/schema.sql`. GitHub y VS Code (con la
extensión de Mermaid) lo muestran como diagrama; para exportarlo a PNG se
puede pegar en <https://mermaid.live>.

```mermaid
erDiagram
    roles ||--o{ usuarios : "asigna"
    tipos_documento ||--o{ usuarios : "identifica"
    tipos_documento ||--o{ personas : "identifica"
    personas ||--o{ equipos : "es propietaria de"
    marcas ||--o{ equipos : "fabrica"
    estados ||--o{ equipos : "describe"
    equipos ||--o{ registros : "tiene"
    usuarios ||--o{ registros : "registra"
    tipos_movimiento ||--o{ registros : "clasifica"
    usuarios ||--o{ auditoria : "genera"
    usuarios ||--o{ codigos_verificacion : "recibe"
    usuarios ||..o| login_intentos : "por nombre de usuario"

    roles {
        INTEGER id_rol PK
        TEXT nombre_rol UK
    }
    usuarios {
        INTEGER id_usuario PK
        TEXT usuario UK
        TEXT nombre
        TEXT apellidos
        TEXT correo UK
        TEXT celular
        INTEGER id_tipo_documento FK
        TEXT numero_documento UK
        TEXT password_hash
        INTEGER id_rol FK
        INTEGER estado
        DATETIME fecha_creacion
    }
    tipos_documento {
        INTEGER id_tipo_documento PK
        TEXT nombre_documento UK
    }
    personas {
        INTEGER id_persona PK
        INTEGER id_tipo_documento FK
        TEXT numero_documento UK
        TEXT nombres
        TEXT apellidos
        TEXT correo
        TEXT celular
        DATETIME fecha_registro
        DATETIME fecha_actualizacion
    }
    marcas {
        INTEGER id_marca PK
        TEXT nombre_marca UK
    }
    estados {
        INTEGER id_estado PK
        TEXT nombre_estado UK
    }
    equipos {
        INTEGER id_equipo PK
        INTEGER id_persona FK
        INTEGER id_marca FK
        TEXT modelo
        TEXT serial UK
        TEXT codigo_qr
        INTEGER id_estado FK
        TEXT observaciones
        INTEGER activo
        DATETIME fecha_registro
    }
    tipos_movimiento {
        INTEGER id_tipo_movimiento PK
        TEXT nombre_movimiento UK
    }
    registros {
        INTEGER id_registro PK
        INTEGER id_equipo FK
        INTEGER id_usuario FK
        INTEGER id_tipo_movimiento FK
        DATETIME fecha_hora
        TEXT observaciones
    }
    auditoria {
        INTEGER id_auditoria PK
        INTEGER id_usuario FK
        TEXT accion
        TEXT tabla_afectada
        DATETIME fecha
        TEXT descripcion
    }
    login_intentos {
        TEXT usuario PK
        INTEGER intentos
        DATETIME bloqueado_hasta
    }
    codigos_verificacion {
        INTEGER id_codigo PK
        INTEGER id_usuario FK
        TEXT codigo_hash
        TEXT tipo
        DATETIME expira
        INTEGER usado
        DATETIME fecha_creacion
    }
```

`login_intentos` no tiene llave foránea a `usuarios` a propósito: registra
también intentos con nombres de usuario que no existen, para que el bloqueo
no revele qué cuentas son reales.
