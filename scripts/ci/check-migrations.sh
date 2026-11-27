#!/usr/bin/env bash
# Aplica toda la cadena de supabase/migrations/*.sql, en orden, sobre un
# PostgreSQL limpio con los stubs de Supabase (TRY-48). Falla en el primer error
# e indica el archivo, para que un PR con una migración rota no llegue a `main`.
#
# Uso: DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres \
#        scripts/ci/check-migrations.sh
set -euo pipefail

: "${DATABASE_URL:?Define DATABASE_URL (base de datos vacía de PostgreSQL 15 o superior)}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
# Sin NOTICE de «does not exist, skipping»: solo advertencias y errores.
export PGOPTIONS="${PGOPTIONS:-} -c client_min_messages=warning"
# Los resultados de los SELECT se descartan; errores y avisos salen por stderr.
PSQL=(psql "$DATABASE_URL" --no-psqlrc --quiet -v ON_ERROR_STOP=1 --output=/dev/null)

echo "▶ Stubs de Supabase (roles, auth, storage, extensions)"
"${PSQL[@]}" -f "$ROOT/scripts/ci/supabase-stubs.sql"

shopt -s nullglob
files=("$MIGRATIONS_DIR"/*.sql)
if [ ${#files[@]} -eq 0 ]; then
  echo "No hay migraciones en $MIGRATIONS_DIR"
  exit 0
fi

applied=0
for file in "${files[@]}"; do
  name="$(basename "$file")"
  # Cada migración en su propia transacción, como `supabase db push`.
  if ! output="$("${PSQL[@]}" --single-transaction -f "$file" 2>&1)"; then
    echo "✗ Falló la migración: supabase/migrations/$name"
    echo "$output"
    if [ -n "${GITHUB_ACTIONS:-}" ]; then
      # psql reporta «psql:<ruta>:<línea>: ERROR: …»: se extrae la línea para la anotación.
      first_error="$(printf '%s\n' "$output" | grep -m1 'ERROR' || true)"
      line="$(printf '%s' "$first_error" | sed -nE 's/^psql:[^:]+:([0-9]+):.*/\1/p')"
      message="$(printf '%s' "$first_error" | sed -E 's/^psql:[^:]+:[0-9]+: //')"
      echo "::error file=supabase/migrations/$name,line=${line:-1}::${message:-La migración no se pudo aplicar}"
    fi
    exit 1
  fi
  if [ -n "$output" ]; then
    printf '%s\n' "$output" | sed "s|^|  [$name] |"
  fi
  applied=$((applied + 1))
done

echo "✓ $applied migraciones aplicadas sin errores"
