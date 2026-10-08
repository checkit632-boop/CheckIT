# Guía de contribución — CheckIT

Reglas de gestión de configuración acordadas a partir de la auditoría de
ComVibes (H-11, H-13 y H-14). Aplican a todo el equipo.

## 1. Ramas

- `main` siempre contiene la versión vigente y estable. **Nunca** se sube
  código directo a `main`.
- Cada cambio se hace en su propia rama, creada desde `main`:

| Tipo de cambio | Prefijo de rama | Ejemplo |
|---|---|---|
| Nueva funcionalidad | `feature/` | `feature/reporte-mensual` |
| Corrección de un defecto o hallazgo | `bugfix/` | `bugfix/validar-limit-registros` |
| Reorganizar código sin cambiar su comportamiento | `refactor/` | `refactor/dividir-usuarios-y-login` |
| Solo documentación | `docs/` | `docs/actualizar-modelo-de-datos-y-readme` |

- Una rama = **un** cambio. Si aparecen dos funcionalidades independientes,
  van en dos ramas (así cualquiera de ellas se puede revertir sola).
- La rama se integra a `main` por **Pull Request** y con `--no-ff`, para que
  el historial muestre qué commits pertenecen a cada cambio.

## 2. Commits (Conventional Commits)

Formato: `tipo(alcance): descripción en presente`

| Tipo | Uso |
|---|---|
| `feat` | Funcionalidad nueva |
| `fix` | Corrección de un defecto |
| `refactor` | Cambio interno sin alterar el comportamiento |
| `docs` | Documentación |
| `chore` | Configuración, dependencias, `.gitignore`, herramientas |
| `test` | Pruebas |

Ejemplos:

```
fix(registros): H-07 validar y acotar el parámetro limit
docs(readme): corregir la lista de roles
```

- Cuando el commit responde a un hallazgo de auditoría, se cita su código
  (`H-07`, `O-02`, `NC-5`) para la matriz de trazabilidad.
- No se usan los mensajes automáticos de la interfaz de GitHub
  ("Update file", "Rename X to X"): siempre se describe **qué** cambió.

## 3. Etiquetas de versión

Cada entrega estable se etiqueta sobre `main`:

```bash
git tag -a v6.1 -m "Correcciones de la auditoría de ComVibes"
git push --tags
```

## 4. Lista de verificación antes de abrir un Pull Request

- [ ] La rama hace un solo cambio y sus commits siguen Conventional Commits.
- [ ] `npm run lint` pasa sin errores en `backend/` y en `frontend/`.
- [ ] No se agregan archivos `.env`, `.db`, `.db-shm`, `.db-wal` ni
      credenciales (revisar `git status` antes de cada commit).
- [ ] Si cambió `backend/db/schema.sql`: se copió igual a
      `database/Script_checkIt.sql` y se actualizaron
      `docs/Diccionario de Datos.md` y `docs/Diagrama Entidad-Relacion.md`.
- [ ] Si cambiaron roles, rutas, variables de entorno o pasos de instalación:
      se actualizó `README.md`.
- [ ] Las decisiones no obvias quedan explicadas en comentarios (el **porqué**,
      no el qué).
