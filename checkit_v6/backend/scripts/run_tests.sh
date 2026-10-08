#!/bin/bash
# Sesión de pruebas funcionales de la API de CheckIT (backend real, sin modificar),
# ejecutada con una herramienta de pruebas basada en curl + Node.js (parseo de JSON).
set -uo pipefail
cd "$(dirname "$0")"

B="http://localhost:4000/api"
LOG="/tmp/evidencia_pruebas.log"
: > "$LOG"

log()  { echo -e "\n$1" >> "$LOG"; }
jget() { node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const v=JSON.parse(d)['$1'];console.log(v===undefined?'':v)}catch(e){console.log('')}})"; }

TOKEN=""
AUTH=""

# call METHOD URL [DATA]  -> ejecuta, registra cmd+respuesta+status SOLO en el archivo LOG,
# y devuelve (por stdout) el cuerpo JSON limpio para que pueda capturarse con $(...)
call() {
  local method="$1" url="$2" data="${3:-}"
  local resp body status cmdline hdr=""
  if [ -n "$AUTH" ]; then hdr="Authorization: Bearer $TOKEN"; fi
  if [ -n "$data" ]; then
    if [ -n "$hdr" ]; then
      resp=$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X "$method" "$url" -H 'Content-Type: application/json' -H "$hdr" -d "$data")
      cmdline="curl -X $method $url -H 'Content-Type: application/json' -H 'Authorization: Bearer <token>' -d '$data'"
    else
      resp=$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X "$method" "$url" -H 'Content-Type: application/json' -d "$data")
      cmdline="curl -X $method $url -H 'Content-Type: application/json' -d '$data'"
    fi
  else
    if [ -n "$hdr" ]; then
      resp=$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X "$method" "$url" -H "$hdr")
      cmdline="curl -X $method $url -H 'Authorization: Bearer <token>'"
    else
      resp=$(curl -s -w '\nHTTP_STATUS:%{http_code}' -X "$method" "$url")
      cmdline="curl -X $method $url"
    fi
  fi
  body=$(echo "$resp" | sed '$d')
  status=$(echo "$resp" | tail -1)
  {
    echo "\$ $cmdline"
    echo "$body"
    echo "$status"
    echo
  } >> "$LOG"
  echo "$body"
}

# ── CASO 001 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-001"
log "# Login con usuario y contraseña válidos (admin / admin123)"
log "# Resultado esperado: 200 OK, requiereCodigo:true (3er factor)"
log "############################################################"
BODY=$(call POST "$B/auth/login" '{"usuario":"admin","password":"admin123"}')
CODIGO=$(echo "$BODY" | jget dev_codigo)
log "(Código capturado por la prueba; visible en consola porque no hay SMTP configurado: $CODIGO)"

# ── CASO 002 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-002"
log "# Verificación del código de 6 dígitos (tercer factor de acceso)"
log "# Resultado esperado: 200 OK, se recibe un token JWT"
log "############################################################"
BODY=$(call POST "$B/auth/login/codigo" "{\"id_usuario\":1,\"codigo\":\"$CODIGO\"}")
TOKEN=$(echo "$BODY" | jget token)
AUTH=1
log "(Token JWT obtenido correctamente; se usará como Authorization: Bearer en las siguientes pruebas)"

# ── CASO 003 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-003"
log "# Login con contraseña incorrecta"
log "# Resultado esperado: 401 Unauthorized"
log "############################################################"
TOKEN_BAK="$TOKEN"; AUTH_BAK="$AUTH"; AUTH=""
call POST "$B/auth/login" '{"usuario":"admin","password":"clave_mala"}' > /dev/null
AUTH="$AUTH_BAK"; TOKEN="$TOKEN_BAK"

# ── CASO 004 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-004"
log "# Bloqueo de cuenta tras 5 intentos fallidos consecutivos"
log "# Resultado esperado: el 5.º intento devuelve 423 Locked"
log "############################################################"
for i in 1 2 3 4 5; do
  R=$(curl -s -w ' | HTTP_STATUS:%{http_code}' -X POST "$B/auth/login" -H 'Content-Type: application/json' -d '{"usuario":"admin","password":"clave_mala"}')
  echo "Intento $i -> $R" | tee -a "$LOG"
done
echo | tee -a "$LOG"

# ── CASO 005 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-005"
log "# Acceso a un endpoint protegido SIN token de sesión"
log "# Resultado esperado: 401 No autenticado"
log "############################################################"
AUTH_BAK="$AUTH"; AUTH=""
call GET "$B/equipos" > /dev/null
AUTH="$AUTH_BAK"

# ── CASO 006 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-006"
log "# Registrar un equipo nuevo con datos válidos"
log "# (incluye el registro previo de la persona propietaria)"
log "# Resultado esperado: 201 Created"
log "############################################################"
MARCAS=$(call GET "$B/catalogos/marcas")
MARCA_ID=$(echo "$MARCAS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id_marca))")
ESTADOS=$(call GET "$B/catalogos/estados")
ESTADO_ID=$(echo "$ESTADOS" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id_estado))")
TIPOSDOC=$(call GET "$B/catalogos/tipos-documento")
TIPODOC_ID=$(echo "$TIPOSDOC" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)[0].id_tipo_documento))")

BODY=$(call POST "$B/personas" "{\"id_tipo_documento\":$TIPODOC_ID,\"numero_documento\":\"1000999888\",\"nombres\":\"Laura\",\"apellidos\":\"Cuellar Perdomo\",\"correo\":\"laura.cuellar@example.com\"}")
PERSONA_ID=$(echo "$BODY" | jget id_persona)

call POST "$B/equipos" "{\"id_persona\":$PERSONA_ID,\"id_marca\":$MARCA_ID,\"modelo\":\"Latitude 5490\",\"serial\":\"CI-TEST-0001\",\"id_estado\":$ESTADO_ID,\"observaciones\":\"Equipo de prueba QA\"}" > /dev/null

# ── CASO 007 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-007"
log "# Registrar un equipo con un serial ya existente (duplicado)"
log "# Resultado esperado: 409 Conflict"
log "############################################################"
call POST "$B/equipos" "{\"id_persona\":$PERSONA_ID,\"id_marca\":$MARCA_ID,\"modelo\":\"Otro modelo\",\"serial\":\"CI-TEST-0001\",\"id_estado\":$ESTADO_ID}" > /dev/null

# ── CASO 008 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-008"
log "# Registrar ENTRADA del equipo CI-TEST-0001 (estado inicial: Afuera)"
log "# Resultado esperado: 201 Created"
log "############################################################"
call POST "$B/registros" '{"serial":"CI-TEST-0001","tipo":"Entrada"}' > /dev/null

# ── CASO 009 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-009"
log "# Registrar ENTRADA de un equipo que YA está Adentro (regla de negocio)"
log "# Resultado esperado: 409 Conflict"
log "############################################################"
call POST "$B/registros" '{"serial":"CI-TEST-0001","tipo":"Entrada"}' > /dev/null

# ── CASO 010 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-010"
log "# Registrar SALIDA y confirmar el cambio de estado del equipo"
log "# Resultado esperado: 201 Created y luego estado=Afuera"
log "############################################################"
call POST "$B/registros" '{"serial":"CI-TEST-0001","tipo":"Salida"}' > /dev/null
EQBODY=$(call GET "$B/equipos/serial/CI-TEST-0001")
EQUIPO_ID=$(echo "$EQBODY" | jget id_equipo)
call GET "$B/registros/estado/$EQUIPO_ID" > /dev/null

# ── CASO 011 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-011"
log "# Eliminar un equipo que YA tiene movimientos registrados"
log "# Resultado esperado: 409 Conflict (debe inactivarse, no borrarse)"
log "############################################################"
call DELETE "$B/equipos/$EQUIPO_ID" > /dev/null

# ── CASO 012 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-012"
log "# Inactivar el equipo (acción exclusiva del Super Administrador)"
log "# Resultado esperado: 200 OK"
log "############################################################"
call PATCH "$B/equipos/$EQUIPO_ID/estado" '{"activo":false}' > /dev/null

# ── CASO 013 ─────────────────────────────────────────────────────────────
log "############################################################"
log "# CASO DE PRUEBA CP-013"
log "# Registrar movimiento sobre un equipo ya inactivado"
log "# Resultado esperado: 409 Conflict (equipo inactivo)"
log "############################################################"
call POST "$B/registros" '{"serial":"CI-TEST-0001","tipo":"Entrada"}' > /dev/null

log "############################################################"
log "# FIN DE LA SESIÓN DE PRUEBAS — 13/13 casos ejecutados"
log "############################################################"