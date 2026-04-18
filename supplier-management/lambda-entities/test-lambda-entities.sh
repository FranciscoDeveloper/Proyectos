#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-lambda-entities.sh
# Prueba completa de la Lambda dairi-entities (CRUD: suppliers, products, expenses)
#
# Uso:
#   chmod +x test-lambda-entities.sh
#   cp .env.example .env   # y edita .env con tus credenciales
#   ./test-lambda-entities.sh
#
# Las credenciales se leen desde .env (o variables de entorno ya exportadas):
#   API_BASE     – URL base del API Gateway
#   TEST_EMAIL   – email para el login
#   TEST_PASSWORD– contraseña para el login
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Cargar .env si existe (sin sobreescribir variables ya exportadas)
ENV_FILE="$(dirname "$0")/.env"
if [ -f "$ENV_FILE" ]; then
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
fi

# Validar que las variables requeridas estén definidas
: "${API_BASE:?Falta API_BASE — define la variable o crea el archivo .env}"
: "${TEST_EMAIL:?Falta TEST_EMAIL — define la variable o crea el archivo .env}"
: "${TEST_PASSWORD:?Falta TEST_PASSWORD — define la variable o crea el archivo .env}"

EMAIL="$TEST_EMAIL"
PASSWORD="$TEST_PASSWORD"

# ── Colores ───────────────────────────────────────────────────────────────────
GREEN="\033[0;32m"; RED="\033[0;31m"; CYAN="\033[0;36m"
YELLOW="\033[1;33m"; BOLD="\033[1m"; RESET="\033[0m"

pass() { echo -e "${GREEN}  ✔ $1${RESET}"; }
fail() { echo -e "${RED}  ✘ $1${RESET}"; }
section() { echo -e "\n${BOLD}${CYAN}═══ $1 ═══${RESET}"; }
info() { echo -e "${YELLOW}  → $1${RESET}"; }

assert_status() {
  local label="$1" expected="$2" actual="$3" body="$4"
  if [ "$actual" -eq "$expected" ]; then
    pass "$label (HTTP $actual)"
  else
    fail "$label — esperado HTTP $expected, recibido HTTP $actual"
    echo "     Body: $body"
  fi
}

# ── 0. Login — obtener JWT ────────────────────────────────────────────────────
section "0. Login"
info "POST $API_BASE/api/auth/login"

LOGIN_RESP=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

LOGIN_BODY=$(echo "$LOGIN_RESP" | head -n -1)
LOGIN_STATUS=$(echo "$LOGIN_RESP" | tail -n1)

assert_status "Login" 200 "$LOGIN_STATUS" "$LOGIN_BODY"

TOKEN=$(echo "$LOGIN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || true)

if [ -z "$TOKEN" ]; then
  fail "No se pudo extraer el token JWT — abortando"
  exit 1
fi
info "Token obtenido: ${TOKEN:0:40}..."

AUTH="Authorization: Bearer $TOKEN"

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
BASE_ENTITIES="$API_BASE/api/entities"

crud_test() {
  local ENTITY="$1"
  local CREATE_BODY="$2"
  local UPDATE_BODY="$3"

  section "ENTITY: $ENTITY"

  # ── LIST (vacío al inicio) ──────────────────────────────────────────────
  info "GET  $BASE_ENTITIES/$ENTITY"
  R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/$ENTITY" -H "$AUTH")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "GET list" 200 "$S" "$B"
  COUNT=$(echo "$B" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
  info "Registros actuales: $COUNT"

  # ── CREATE ──────────────────────────────────────────────────────────────
  info "POST $BASE_ENTITIES/$ENTITY"
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE_ENTITIES/$ENTITY" \
    -H "$AUTH" -H "Content-Type: application/json" -d "$CREATE_BODY")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "POST create" 201 "$S" "$B"

  NEW_ID=$(echo "$B" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
  if [ -z "$NEW_ID" ]; then
    fail "No se pudo extraer el ID del registro creado"
    return
  fi
  info "Registro creado con ID=$NEW_ID"

  # ── GET by ID ───────────────────────────────────────────────────────────
  info "GET  $BASE_ENTITIES/$ENTITY/$NEW_ID"
  R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/$ENTITY/$NEW_ID" -H "$AUTH")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "GET by ID" 200 "$S" "$B"

  # ── UPDATE ──────────────────────────────────────────────────────────────
  info "PUT  $BASE_ENTITIES/$ENTITY/$NEW_ID"
  R=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_ENTITIES/$ENTITY/$NEW_ID" \
    -H "$AUTH" -H "Content-Type: application/json" -d "$UPDATE_BODY")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "PUT update" 200 "$S" "$B"

  # ── DELETE ──────────────────────────────────────────────────────────────
  info "DELETE $BASE_ENTITIES/$ENTITY/$NEW_ID"
  R=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE_ENTITIES/$ENTITY/$NEW_ID" -H "$AUTH")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "DELETE" 200 "$S" "$B"

  # ── GET deleted → 404 ───────────────────────────────────────────────────
  info "GET  $BASE_ENTITIES/$ENTITY/$NEW_ID  (debe ser 404)"
  R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/$ENTITY/$NEW_ID" -H "$AUTH")
  B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
  assert_status "GET 404 after delete" 404 "$S" "$B"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. SUPPLIERS
# ─────────────────────────────────────────────────────────────────────────────
crud_test "suppliers" \
'{
  "name":          "Proveedor Test S.A.",
  "code":          "PT-001",
  "email":         "contacto@proveedor-test.cl",
  "phone":         "+56 9 1234 5678",
  "category":      "technology",
  "status":        "active",
  "country":       "Chile",
  "city":          "Santiago",
  "address":       "Av. Providencia 1234",
  "website":       "https://proveedor-test.cl",
  "taxId":         "76.000.001-K",
  "contactPerson": "Juan Pérez",
  "rating":        4.5,
  "totalOrders":   10,
  "totalSpent":    500000,
  "notes":         "Proveedor de prueba para test",
  "tags":          ["test", "tecnología"]
}' \
'{
  "status":  "inactive",
  "rating":  3.0,
  "notes":   "Actualizado durante test"
}'

# ─────────────────────────────────────────────────────────────────────────────
# 2. PRODUCTS
# ─────────────────────────────────────────────────────────────────────────────
crud_test "products" \
'{
  "name":        "Producto Test Pro",
  "sku":         "TST-0001",
  "category":    "electronics",
  "status":      "available",
  "price":       99990,
  "stock":       50,
  "supplier":    "Proveedor Test S.A.",
  "weight":      0.5,
  "description": "Producto creado por el script de pruebas",
  "tags":        ["test", "electrónica"]
}' \
'{
  "price":  79990,
  "stock":  45,
  "status": "low_stock"
}'

# ─────────────────────────────────────────────────────────────────────────────
# 3. EXPENSES
# ─────────────────────────────────────────────────────────────────────────────
crud_test "expenses" \
'{
  "description":   "Compra insumos de prueba",
  "supplier":      "Proveedor Test S.A.",
  "date":          "2026-04-04",
  "category":      "insumos",
  "amount":        150000,
  "paymentMethod": "transferencia",
  "status":        "pagado",
  "receiptNumber": "FAC-000999",
  "notes":         "Gasto creado por el script de pruebas"
}' \
'{
  "status": "pendiente",
  "notes":  "Actualizado durante test"
}'

# ─────────────────────────────────────────────────────────────────────────────
# 4. Casos de error
# ─────────────────────────────────────────────────────────────────────────────
section "4. Casos de error"

info "GET sin token → 401"
R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/suppliers")
B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
assert_status "GET sin Authorization" 401 "$S" "$B"

info "GET token inválido → 401"
R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/suppliers" \
  -H "Authorization: Bearer token-falso")
B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
assert_status "GET token inválido" 401 "$S" "$B"

info "GET entidad inexistente → 404"
R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/unicornios" -H "$AUTH")
B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
assert_status "GET entidad inexistente" 404 "$S" "$B"

info "GET ID inexistente → 404"
R=$(curl -s -w "\n%{http_code}" "$BASE_ENTITIES/suppliers/999999" -H "$AUTH")
B=$(echo "$R" | head -n -1); S=$(echo "$R" | tail -n1)
assert_status "GET ID inexistente" 404 "$S" "$B"

section "Pruebas finalizadas"
