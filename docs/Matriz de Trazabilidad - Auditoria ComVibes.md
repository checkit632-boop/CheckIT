# Matriz de trazabilidad — Auditoría de ComVibes

Hallazgo → acción correctiva → rama / commits → estado. Cada rama se integró
a `main` con `git merge --no-ff` (el commit de *merge* es la evidencia de
integración). Línea base auditada: etiqueta `v6.0`. Entrega corregida:
etiqueta `v6.1`.

| Hallazgo | Severidad | Acción correctiva | Rama | Commits | Merge | Estado |
|---|---|---|---|---|---|---|
| H-01 Secreto JWT con valor de respaldo | Crítico | Ya corregido por NC-6 (sin respaldo); se unificó la validación duplicada. El servidor no arranca sin `JWT_SECRET`. | `bugfix/jwt-secret-obligatorio` | 1ef368d | ef6271e | Cerrado |
| H-02 Contraseña del admin fija e impresa | Crítico | Ya corregido por NC-6 (aleatoria, solo en archivo ignorado por Git); se restringieron los permisos del archivo (0600). | `bugfix/admin-password-aleatoria` | c9f43dd | 238ec2c | Cerrado |
| H-03 Bases `.db` con cuentas reales en el historial | Crítico | `*.db`, `*.db-shm`, `*.db-wal` ignorados en todo el repo; `npm run seed` con datos ficticios. `git log --all --full-history -- '*.db'` no devuelve nada en este repositorio. | `bugfix/purgar-historial-db` | 381f200, 0244c1c | f29813f | Cerrado en este repo · **Pendiente del equipo:** rotar contraseñas expuestas y purgar el repositorio público anterior (ver nota 1) |
| H-04 Código 2FA en la respuesta de la API | Alto | Se eliminan `dev_codigo`/`dev_usuario` de las 3 respuestas; el código solo se ve en consola con `NODE_ENV=development`. | `bugfix/no-exponer-codigo-2fa` | 8e59734 | ac1313b | Cerrado |
| H-11 Versionado por carpetas | Alto | Una sola copia del proyecto en la raíz; versiones por etiquetas (`v6.0`, `v6.1`); README actualizado. | `bugfix/repo-cleanup-una-copia` | 6933051 | 0a97495 | Cerrado en este repo (ver nota 1) |
| H-13 Commits sin granularidad ni etiquetas | Medio | `CONTRIBUTING.md`: rama por cambio, Conventional Commits, PR con `--no-ff`, etiquetas por entrega. Aplicado en toda esta corrección. | `docs/guia-de-contribucion` | 88686ef | 955d922 | Cerrado (práctica de equipo) |
| H-14 Modelo de datos y README desactualizados | Alto | `database/Script_checkIt.sql` idéntico a `schema.sql` (`npm run sql:check`); diccionario y diagrama E-R con `login_intentos` y `codigos_verificacion`; paso obligatorio en la lista del PR. | `docs/actualizar-modelo-de-datos-y-readme` | 133231e, 1b7b0f6 | 32e192e | Cerrado (ver nota 2) |
| H-12 `console.log` de depuración | Medio | Se reemplazan por un aviso en la interfaz; regla `no-console` activa en el frontend. Se corrigieron además los 2 errores de ESLint previos. | `bugfix/limpiar-console-log` | 7750628, f9143cd | 258f463 | Cerrado |
| H-15 Variable sin uso | Medio | `estado` ya no se desestructura (comentado el porqué); `no-unused-vars` pasa a `error` en el backend. | `bugfix/limpiar-variable-sin-uso` | 3e0fb17 | 25def23 | Cerrado |
| H-05 Envío de correo sin `.catch()` | Alto | `enviarCodigoSeguro()` en las 3 llamadas y `process.on('unhandledRejection')` en `server.js`. Probado con SMTP forzado a fallar: la API sigue respondiendo. | `bugfix/manejar-error-envio-correo` | 3f56c02 | a65fa7f | Cerrado |
| H-06 Sin control de excepciones en rutas | Medio | `utils/asyncHandler.js` en las 17 rutas de auth, usuarios y registros; `middleware/errorHandler.js` traduce JSON inválido (400), restricciones de SQLite (409/400) y base ocupada (503). | `bugfix/manejo-de-errores-rutas` | 7e8e028, ea69ba1 | 67fb771 | Cerrado |
| H-07 `?limit` no numérico llega al SQL | Medio | Inválido o no positivo → 100; máximo 500. | `bugfix/validar-limit-registros` | f978c3e | 391d607 | Cerrado |
| O-01 `LIMIT` interpolado en el SQL | Obs. | `LIMIT ?` como parámetro preparado (mismo commit que H-07). | `bugfix/validar-limit-registros` | f978c3e | 391d607 | Cerrado |
| H-08 Sin política de contraseñas | Medio | Mín. 8 caracteres con mayúscula, minúscula y número en crear, editar y restablecer (backend), replicado en Usuarios y Olvidé mi contraseña. | `bugfix/politica-de-password` | a123ff3, 17593de | 87caf67 | Cerrado |
| O-02 Código 2FA con intentos ilimitados | Obs. | Columna `intentos` (con migración); al 5.º código incorrecto se invalida y responde 429. Script SQL, diccionario y diagrama sincronizados. | `bugfix/limitar-intentos-codigo-verificacion` | 1772e8f, 0285c7b | bbc6a40 | Cerrado |
| H-09 Componentes monolíticos | Medio | `Usuarios.jsx` 251 → 89 líneas (`useUsuarios`, `FiltroUsuarios`, `TablaUsuarios`, `FormularioUsuario`, `utils/usuarios`); `Login.jsx` 177 → 49 (`useLogin`, `CredencialesForm`, `CodigoVerificacionForm`). Ningún archivo nuevo supera 150 líneas. | `refactor/dividir-usuarios-y-login` | d8c7504, ec60201 | 5b990e2 | Cerrado |
| H-10 Módulos sin comentarios de negocio | Alto | Encabezados y comentarios del porqué en `routes/auth.js`, `routes/usuarios.js`, `middleware/auth.js`, `Usuarios.jsx` y `Login.jsx`. | `docs/comentar-reglas-de-negocio` | 148e658 | c7962e6 | Cerrado (pendiente la lectura cruzada por un compañero) |

## Notas

1. **Repositorio público anterior.** Este repositorio se inició limpio con
   la v6 en la raíz, así que aquí no existen `checkit_v1` … `checkit_v5` ni
   archivos `.db` en el historial. El repositorio que auditó ComVibes sí los
   tiene. Para cerrar H-03 y H-11 allí, el equipo debe: (a) rotar ya las
   contraseñas de las cuentas expuestas (`admin`, `EmersonAndrade`,
   `santiago`, …); (b) etiquetar las versiones viejas (`git tag -a v1 <commit>`)
   y purgar las bases con `git filter-repo --path-glob '*.db' --invert-paths`,
   coordinando el `git push --force` y que todos vuelvan a clonar; o bien
   reemplazar ese repositorio por este.
2. Los entregables de H-14 quedaron en Markdown (`docs/Diccionario de
   Datos.md`, `docs/Diagrama Entidad-Relacion.md`, en Mermaid). Si el curso
   exige el `.xlsx` y el `.png`, se exportan desde estos archivos.
3. La rama `qa/correcciones-auditoria-nc5-nc8` no existe en este
   repositorio: sus correcciones (NC-5 a NC-8) ya venían incluidas en la
   línea base `v6.0`.
