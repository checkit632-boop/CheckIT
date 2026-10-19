# Mejoras de rendimiento antes de la implantación

Cinco mejoras aplicadas a CheckIT v6.1 a partir de las pruebas de
capacidad. Cada una está en su propia rama, integrada a `main` con
`--no-ff`.

## Cómo se midió

- **Datos:** 1.000 personas, 1.000 equipos y 99.500 movimientos repartidos en
  300 días, en ciclos entrada → salida (equivale a ~1 año de una sede con
  ~330 equipos diarios).
- **Mismo procedimiento antes y después:** copia aislada del backend sobre la
  misma base, sesión completa con tercer factor, 5 llamadas por ruta, y
  carga de 5 y 20 usuarios simultáneos sobre las rutas de Control de Acceso
  y el Dashboard.
- **Antes:** commit `f7a0b07` · **Después:** commit `6ad1909`.
- **Equipo:** portátil de desarrollo, Windows 11, Node.js 22.2.0.

## Resultados

| Medición | Antes | Después | Cambio |
|---|---|---|---|
| Peticiones por segundo, 5 usuarios | 14 | 101 | ×7 |
| Peticiones por segundo, 20 usuarios | 12 | 105 | ×9 |
| Tiempo de respuesta (mediana), 20 usuarios | 1.530 ms | 124 ms | −92 % |
| Tiempo de respuesta (p95), 20 usuarios | 2.780 ms | 373 ms | −87 % |
| `GET /registros/stats/hoy` | 268 ms | 13 ms | −95 % |
| `GET /dashboard/resumen` | 94 ms | 8 ms | −92 % |
| Historial de Resumen (últimos 30 días) | 43,8 MB · 2,4 s (descargaba todo) | 60 KB · 0,28 s | −99,9 % de datos |
| Historial completo (100.000 movimientos) | 43,8 MB | 0,5 MB (gzip) | −99 % de datos |
| Tamaño de la base | 4,8 MB | 8,9 MB | +4,1 MB por los índices |

## Mejoras

| # | Mejora | Rama | Commits | Merge |
|---|---|---|---|---|
| 1 | Índices en `registros` (equipo, fecha, usuario) y `auditoria` (acción + fecha). Las bases existentes los reciben al arrancar. | `feature/indices-base-de-datos` | 465cc55 | 166d83b |
| 2 | Filtros de día, semana y mes escritos como rangos de fechas (`utils/periodos.js`) para que usen los índices. Se comprobó que dan el mismo resultado que las condiciones anteriores en 1.037.340 casos. | `perf/consultas-por-rango-de-fechas` | efa5970 | 1093efd |
| 3 | "Equipos adentro" de `stats/hoy` en una sola consulta en vez de una por equipo (55 → 2 ms con 1.000 equipos). | `perf/stats-hoy-una-consulta` | 473e366 | 254429d |
| 4 | Historial por período: `GET /registros?desde&hasta` (con la entrada previa de cada ciclo). Resumen carga los últimos 30 días (selector 7/30/90/365), ya no recarga con cada tecla del buscador, pagina de a 100 ciclos y las exportaciones piden su propio rango. La agrupación en ciclos se verificó idéntica a la anterior. | `feature/historial-por-periodo` | 9dd0bb1, e2317ff | 67238a2 |
| 5 | Compresión gzip de las respuestas (`compression`). | `perf/compresion-respuestas` | c52c6ba | 6ad1909 |

También se limpió el README, que tras el merge con el repositorio anterior
arrastraba el README viejo con información desactualizada
(`docs/limpiar-readme-tras-merge`, commit 4bd04d2, merge f7a0b07).

## Observaciones pendientes

- **Zona horaria mixta en `registros.fecha_hora`.** Los movimientos manuales
  se guardan en hora de Bogotá, pero los cierres automáticos de las
  11:59 p. m. (`utils/reinicio.js`) se guardan en UTC (`CURRENT_TIMESTAMP`),
  así que aparecen como del día siguiente a las 4:59 a. m. Además, el
  Dashboard trata la columna como UTC y Control de Acceso como hora local:
  los movimientos manuales de 12:00 a. m. a 4:59 a. m. aparecen en el
  Dashboard como del día anterior. Se dejó sin cambiar para no alterar
  resultados; corregirlo requiere unificar la zona horaria y migrar los
  registros existentes.
- **RAM.** El backend usa 55–69 MB en reposo. Tras la prueba de carga llegó a
  ~300 MB, sobre todo porque la prueba también pide una vez el historial
  completo (100.000 movimientos). Con el uso normal de Resumen (30 días) ese
  pico no se produce.
