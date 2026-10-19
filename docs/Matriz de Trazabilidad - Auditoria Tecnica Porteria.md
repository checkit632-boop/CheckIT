# Matriz de trazabilidad — Auditoría técnica de portería

Auditoría técnica de CheckIT orientada a la operación en la portería del
SENA La Plata (rendimiento en horas pico, seguridad, base de datos, Habeas
Data y hardware de portería). **Se realizó sobre la versión anterior a
v6.2**; por eso varios puntos ya estaban corregidos cuando se recibió. Cada
corrección nueva está en su propia rama, integrada a `main` con `--no-ff`.

- Versión auditada: anterior a `v6.2` · Versión que cierra la auditoría: `v6.3`
- Estados: **Corregido** (con evidencia) · **Ya corregido en v6.2** ·
  **Corregido, con ajuste** (se aplicó lo que el punto busca, cambiando la
  solución propuesta por la razón indicada).

## 1. Cuellos de botella y rendimiento

| Punto | Hallazgo | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|---|
| 1.1 | Consulta N+1 en `/registros/stats/hoy` | Una sola consulta con `MAX(id_registro)` por equipo sobre índice (55 → 2 ms con 1.000 equipos). Equivale a la propuesta con `ROW_NUMBER()`. | `perf/stats-hoy-una-consulta` | 473e366 | 254429d | Ya corregido en v6.2 |
| 1.2 | 6 peticiones en cascada por escaneo y pausas de 800 ms y 2 s | `POST /registros/escanear` (un viaje, decide entrada/salida en una transacción, ignora la lectura repetida durante 8 s); sin espera mínima de 800 ms; la cámara se reabre a los 0,6 s. | `feature/escaneo-rapido-porteria` | 8d480f7, 81080a9 | 6c31527 | Corregido |
| 1.3 | Resumen sin paginación, recargando con cada tecla | Historial por período (30 días por defecto), sin recarga por tecla, 100 ciclos por página; exportaciones piden su rango. | `feature/historial-por-periodo` | 9dd0bb1, e2317ff | 67238a2 | Ya corregido en v6.2 |
| 1.3 | Equipos sin paginación ni *debounce* | `GET /equipos?pagina&por_pagina&q` (25 por página), búsqueda en el servidor con `useDebounce` (300 ms) y buscador de propietarios con `GET /personas?q&limit=8`. | `feature/paginacion-equipos` | dec824c, 5576791 | 0259390 | Corregido |
| 1.4 | Reinicio nocturno fila por fila, fuera de transacción | Un `INSERT … SELECT` y su auditoría en una sola transacción (todo o nada). 500 equipos: 347 → 48 ms, mismos equipos cerrados. | `perf/reinicio-en-transaccion` | 5b371cc | 85a6e05 | Corregido |

## 2. Seguridad y control de acceso

| Hallazgo | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|
| Sin límite de peticiones en `/login`, `/login/reenviar`, `/forgot-password` | `express-rate-limit` en las 5 rutas de autenticación: límite estricto por IP + cuenta (5 correos por cuenta cada 10 min) y amplio por IP. IP real vía `X-Forwarded-For` solo desde proxy de confianza (`TRUST_PROXY`). | `bugfix/limitar-peticiones-autenticacion` | a6b8ef7 | 9b76d99 | Corregido |
| JWT sin verificar si la cuenta sigue activa | `authRequired` consulta la cuenta en cada petición: inactivar o eliminar corta el acceso en la siguiente petición y un cambio de rol se aplica de inmediato. | `bugfix/verificar-usuario-activo` | f9c0e31 | d1f32b2 | Corregido |
| CORS abierto a cualquier origen | Lista de orígenes permitidos (`CORS_ORIGINS`). | `bugfix/restringir-cors` | 83a5f15 | 8a989a4 | Corregido |
| Condición de carrera al validar el código 2FA | Lectura, conteo (`intentos = intentos + 1 … RETURNING`) y marca de usado en una transacción `IMMEDIATE`. Nota: con un solo proceso de Node la carrera no era posible (better-sqlite3 es síncrono); se blinda igual por si el backend llega a correr en varios procesos. | `bugfix/validar-codigo-en-transaccion` | 07f8ca6 | 118df54 | Corregido |
| `alert()` bloqueante en el escáner | Aviso en rojo dentro de la ventana del escáner y paso al ingreso manual del serial. | `feature/escaneo-rapido-porteria` | 6850000 | 6c31527 | Corregido |

## 3. Base de datos

| Punto | Hallazgo | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|---|
| 3.1 | Índices faltantes | `idx_registros_equipo`, `idx_registros_fecha`, `idx_registros_usuario` e `idx_auditoria_accion_fecha` (v6.2) y ahora `idx_equipos_persona`. No se crean `idx_registros_equipo_id`, `idx_registros_fecha_hora` ni `idx_equipos_serial_activo` del script propuesto: duplicarían índices existentes o el de la restricción `UNIQUE` de `serial`, ocupando espacio y haciendo más lentas las escrituras. | `feature/indices-base-de-datos` · `feature/indice-equipos-persona` | 465cc55 · 8f2b2f5 | 166d83b · 80cfc66 | Corregido, con ajuste |
| 3.2 | Fechas en dos zonas horarias | Todas las fechas se guardan en UTC y la API las entrega en hora de Colombia (desfase fijo UTC-5, sin depender de la zona del servidor). Migración única de las bases existentes con copia previa: solo se convierten los movimientos manuales desde v5 (2026-08-31), porque v2–v4 y los cierres automáticos ya estaban en UTC. Se verificó que las respuestas de la API quedan idénticas tras migrar y que Dashboard y Control de Acceso ahora cuentan igual los movimientos de madrugada. | `bugfix/fechas-en-utc` | efb4433 | ca5f9f9 | Corregido |

## 4. Minimización de datos (Habeas Data, Ley 1581 de 2012)

| Hallazgo | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|
| Correo y celular no deben exigirse | Ya eran opcionales en el backend (solo se exigen documento y nombre); el formulario ahora los marca como "(opcional)". | `feature/aviso-privacidad-habeas-data` | dde5b86 | 9d19d17 | Corregido |
| Aviso de privacidad visible en portería | Aviso breve en Control de Accesos y en el registro del propietario; aviso completo para imprimir en `docs/Aviso de Privacidad.md` (borrador para validar con el área jurídica). | `feature/aviso-privacidad-habeas-data` | dde5b86 | 9d19d17 | Corregido (falta completar los datos oficiales del responsable) |

## 5. Experiencia de usuario y hardware de portería

| Punto | Hallazgo | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|---|
| 5.1 | Sin soporte nativo para pistolas lectoras USB/Bluetooth | `useLectorCodigos`: reconoce la ráfaga de teclado de la pistola (≤50 ms entre teclas, terminada en Enter) en cualquier parte de la pantalla y registra sin abrir la cámara ni usar el ratón; la escritura manual no se ve afectada (6/6 casos de prueba). El backend acepta el serial o el QR aunque la distribución del teclado cambie las comillas. | `feature/escaneo-rapido-porteria` | 54c352e, 8d480f7 | 6c31527 | Corregido |
| 5.2 | QR generado en el servidor | Se genera en el navegador con la misma librería y opciones (imagen idéntica byte a byte); se elimina `GET /equipos/:id/qr` y la dependencia del backend. | `perf/qr-en-el-cliente` | 188ff04 | 8d22676 | Corregido |

## Mantenimiento y buenas prácticas

| Recomendación | Acción | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|
| Documentar la política de copias de seguridad | Sección "Política de copias de seguridad" en el README: destinos, frecuencia, retención, verificación semanal, prueba de restauración mensual y pasos para restaurar. | `docs/politica-copias-de-seguridad` | 63b94c4 | 37f1a2c | Corregido |
| Mantener las consultas parametrizadas | Todo lo nuevo usa parámetros preparados (`?`), incluidos `LIMIT`/`OFFSET` y las búsquedas `LIKE` (con comodines escapados en `utils/busqueda.js`). | — | — | — | Cumple |

## Evidencia de rendimiento

Misma base (1.000 equipos, ~100.000 movimientos) y misma carga en las tres
mediciones:

| Medición | Versión auditada | v6.2 | v6.3 |
|---|---|---|---|
| Peticiones por segundo, 20 usuarios | 12 | 105 | **147** |
| Tiempo de respuesta (mediana), 20 usuarios | 1.530 ms | 124 ms | **93 ms** |
| `stats/hoy` | 268 ms | 13 ms | **9 ms** |
| Tiempo de red de un escaneo en portería | 6 peticiones (con v6.2: 47 ms) | 47 ms | **12 ms** |
| Pausas fijas de la interfaz por escaneo | 800 ms + 2 s | 800 ms + 2 s | **0 ms** (la cámara se reabre a 0,6 s; con pistola, inmediato) |
