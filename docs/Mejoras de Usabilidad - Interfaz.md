# Mejoras de usabilidad de la interfaz (v6.4)

Revisión de la interfaz de CheckIT a partir de capturas de todas las
pantallas, con el objetivo de que el sistema sea coherente y el usuario no
se confunda al usarlo. Cada mejora está en su propia rama, integrada a
`main` con `--no-ff`. El contraste se midió con la fórmula de WCAG 2.1
(mínimo recomendado 4,5 para texto normal).

| # | Problema observado | Corrección | Rama | Commit | Merge |
|---|---|---|---|---|---|
| 1 | El botón de Control de Accesos decía "Registrar Salida" sin ningún equipo buscado. | Sin equipo dice "Escanea o busca un equipo para registrar". | `fix/claridad-control-accesos` | 895c182 | 937ed82 |
| 2 | La fecha aparecía como "Jueves, 22 De Octubre De 2026". | Mayúscula solo al inicio: "Jueves, 22 de octubre de 2026". | `fix/claridad-control-accesos` | 895c182 | 937ed82 |
| 3 | "Equipos Dentro" con texto blanco sobre verde claro (contraste 2,99). | Verde oscuro de la paleta (6,46). Avatar del menú también más oscuro. | `fix/claridad-control-accesos` | 895c182 | 937ed82 |
| 4 | El botón "Escanear QR" titila continuamente. | **Se mantiene a propósito**: es lo primero que debe ver el vigilante. Se había quitado y se restauró por decisión del equipo; se detiene al pasar el mouse. | `fix/restaurar-titileo-escanear-qr` | e31239c | (este merge) |
| 5 | "Estado del sistema" mostraba etiquetas fijas ("Conectada") que se repetían en bucle aunque el servidor fallara. | Muestra el estado real del servidor y de la base de datos, consultado cada 30 s; `/api/health` comprueba la base. | `fix/estado-real-del-sistema` | c70970d | ca969ad |
| 5b | Al corregir el punto 5 la franja dejó de moverse; el equipo prefiere que se mueva. | Vuelve a desplazarse (pausa al pasar el mouse) con los estados reales, sin mostrar copias repetidas. | `fix/restaurar-movimiento-estado-sistema` | 2a28e2a | (este merge) |
| 6 | En el Historial, la tarjeta contaba todo el historial (11) mientras la tabla mostraba 30 días (1). | La tarjeta cuenta el mismo período de la tabla y lo indica. | `fix/coherencia-historial` | 3853367 | 8733a8c |
| 7 | El título decía "Resumen General" y el menú "Historial de Movimientos". | Mismo nombre en ambos. | `fix/coherencia-historial` | 3853367 | 8733a8c |
| 8 | "1 registros encontrados". | Plural correcto: "1 registro encontrado". | `fix/coherencia-historial` | 3853367 | 8733a8c |
| 9 | Íconos de las tarjetas de Auditoría cortados en la esquina. | Íconos completos dentro de la tarjeta. | `fix/legibilidad-auditoria` | 59e51e8 | b66251d |
| 10 | "Entradas" e "Inicios de sesión" eran dos verdes casi iguales. | Colores alineados con Control de Acceso (entrada verde, salida gris pizarra, ámbar solo para el sistema). | `fix/legibilidad-auditoria` | 59e51e8 | b66251d |
| 11 | Pestaña inactiva y nota de Auditoría en gris claro (contraste 2,4). | Gris oscuro (7,2) y texto de 12 px. | `fix/legibilidad-auditoria` | 59e51e8 | b66251d |
| 12 | Eliminar e inactivar usaban la ventana `confirm()` del navegador, sin explicar consecuencias. | Diálogo propio del sistema, botón rojo en acciones destructivas y mensaje explicativo. | `fix/acciones-claras` | bd4a19e | 1fe12e7 |
| 13 | Botones de acción solo con ícono, sin indicar qué hacen. | Texto al pasar el mouse y `aria-label` en editar, activar/inactivar y eliminar. | `fix/acciones-claras` | bd4a19e | 1fe12e7 |
| 14 | Insignia "Operador de Sistema" y total en azul, fuera de la paleta. | Gris y verde de la paleta. | `fix/acciones-claras` · `fix/coherencia-historial` | bd4a19e · 3853367 | 1fe12e7 · 8733a8c |
| 15 | 21 textos de 9-10 px y 16 textos gris claro difíciles de leer a distancia. | Mínimo 11 px; gris medio (contraste 4,6). | `fix/legibilidad-y-modo-oscuro` | 5eacdfd | b32808e |
| 16 | Modo oscuro incompleto en Registro de Equipos (bloques claros). | Tabla, buscador, formulario e insignias con versión oscura. | `fix/legibilidad-y-modo-oscuro` | 5eacdfd | b32808e |
| 17 | Las fuentes se descargaban de Google Fonts; sin internet el diseño cambiaba. | Fuentes incluidas en la aplicación. | `fix/fuentes-locales` | 55f61db | 871e17b |

## Funciones nuevas

| Función | Descripción | Rama | Commits |
|---|---|---|---|
| Detalle de "Equipos Dentro" | Al pulsar la tarjeta "Equipos Dentro" de Control de Accesos se abre la lista de equipos que están adentro, con marca, modelo, serial, propietario (nombre, documento y celular si lo tiene), hora de entrada y quién la registró, con buscador. La lista usa la misma condición que el contador, así el número y la lista siempre coinciden. | `feature/detalle-equipos-dentro` | a192896 (backend), ab4ba16 (interfaz) |
| Alerta de equipos que quedaron dentro | Cuando un equipo no registra salida (p. ej. un funcionario lo deja en el centro varios días), el reinicio de las 11:59 p. m. le registra una salida automática. Al iniciar sesión, el vigilante (y todos los roles) ve una ventana con esos equipos, su propietario, cuándo entraron y quién lo registró, para saber que en realidad no salieron por la portería. Solo muestra los del último cierre; si esa noche no quedó nada, no aparece. | `feature/alerta-cierres-automaticos` | 3d06d9d (backend), 85f3956 (interfaz) |
| Accesorios al registrar la entrada | Por sugerencia de coordinación. Al registrar una entrada se abre una ventana con la lista desplegable de accesorios (Mouse, Cargador, Teclado, Pantalla), de selección múltiple. Se puede aceptar sin elegir ninguno si la persona solo trae el computador. Los accesorios aparecen en el Historial de Movimientos y en sus reportes CSV, Excel y PDF. | `feature/accesorios-en-entrada` | d1662d1 |
| Interfaz servida por la API en un solo equipo | Para instalar CheckIT en un único PC. Si existe `frontend/dist`, el backend entrega la interfaz en su mismo puerto (`http://localhost:4000`), sin servidor web aparte. Con `HOST=127.0.0.1` solo responde en ese equipo; desde la red se rechaza la conexión. Una ruta `/api` inexistente responde 404 en JSON. | `feature/servir-interfaz-local` | — |
| Etiqueta QR de 48 × 48 mm | Para la impresora térmica del centro (Jaltech 838L, controlador 4Barcode 3B-365B, rollo adhesivo de 48 × 48 mm). **Imprimir** ya no sale en formato de página: genera una etiqueta del tamaño exacto, en blanco y negro, con el QR de 32 mm en alta resolución, el serial completo (la letra se reduce si es largo) y la marca y el modelo. Los datos se escapan antes de insertarlos en la página de impresión. Probado imprimiendo a PDF con Chrome (página de 48 × 48 mm) y leyendo el QR simulado a 203 ppp. | `feature/etiqueta-qr-48mm` | — |
| Mejoras antes de implantar (v6.11) | Análisis general del proyecto. **Seguridad:** 0 alertas en la API (express 4.22.3, nodemailer 10.4, probado con un envío SMTP real); en la interfaz se quitó `xlsx`, que no se usaba y tenía una alerta sin corrección, y se actualizaron axios, dompurify y react-router 6.30 (quedan 4 moderadas que no aplican: redirecciones con texto del usuario y renderizado en servidor de react-router, y un parámetro de uuid que exceljs no usa); una cuenta inactivada entre la contraseña y el código ya no recibe sesión; encabezados `nosniff`, `X-Frame-Options` y `Referrer-Policy`. **Operación en un solo PC:** cierre y respaldo recuperados al arrancar si el PC estuvo apagado, hora calculada con `ZONA_HORARIA_OFFSET`, revisión de integridad de cada copia, aviso por correo si falla un respaldo, un destino o el cierre, cierre ordenado de la base y código de acceso de contingencia (`npm run codigo`). **Calidad:** `npm test` con 13 pruebas sobre la API real y una base temporal. **Rendimiento:** pantallas de administración y librerías de PDF/Excel cargadas al usarse (interfaz inicial de 2.093 KB a 632 KB); el logo se reduce antes de incrustarlo (PDF de una página de 6,3 MB a 26 KB, Excel de 556 KB a 28 KB). | `feature/mejoras-antes-de-implantar` | — |
| Accesorios al registrar la salida | Se agregan Base refrigerante y Diademas al catálogo; las bases existentes los reciben al arrancar el backend. Al registrar una salida se abre una ventana con los accesorios registrados en la entrada, o el aviso de que ingresó solo con el computador, para que el vigilante los compruebe. Al pulsar **Aceptar** se registra la salida; **Cancelar** no registra nada. | `feature/accesorios-en-salida` | — |

## Pendiente de verificar

- Revisar Control de Accesos en un monitor de 1366 × 768 (resolución
  habitual en portería): tiene medidas fijas y puede quedar apretada.
- Probar en el navegador la ventana de "Equipos Dentro", la alerta de equipos que quedaron dentro (requiere que haya corrido el reinicio de las 11:59 p. m. con algún equipo adentro), el diálogo de confirmación, la barra de estado del
  sistema (apagando el backend debe mostrar "Sin conexión") y el modo
  oscuro de Registro de Equipos.
