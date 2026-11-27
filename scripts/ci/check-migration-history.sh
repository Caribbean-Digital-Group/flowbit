#!/usr/bin/env bash
# Revisa que un PR respete el historial de migraciones (TRY-48):
#   1. No modifica, borra ni renombra migraciones que ya están en la rama base
#      (regla de CLAUDE.md: «nunca editar migraciones pasadas»).
#   2. Las migraciones nuevas tienen un timestamp posterior a la última de la base.
#      `supabase db push` rechaza migraciones con fecha anterior a la última aplicada.
#
# Uso: scripts/ci/check-migration-history.sh origin/develop
set -euo pipefail

BASE_REF="${1:?Indica la rama base, por ejemplo origin/develop}"
DIR="supabase/migrations"
status=0

annotate() {
  local file="$1" message="$2"
  echo "✗ $file: $message"
  if [ -n "${GITHUB_ACTIONS:-}" ]; then
    echo "::error file=$file::$message"
  fi
}

merge_base="$(git merge-base "$BASE_REF" HEAD)"

# 1. Migraciones existentes modificadas, borradas o renombradas
while IFS=$'\t' read -r change file _; do
  [ -z "${change:-}" ] && continue
  annotate "$file" "No se editan migraciones que ya existen en la base (cambio: $change). Crea una migración nueva con npm run db:migration:new."
  status=1
done < <(git diff --name-status --diff-filter=MDR "$merge_base" HEAD -- "$DIR")

# 2. Timestamps de las migraciones nuevas
latest_base="$(git ls-tree --name-only "$BASE_REF" -- "$DIR/" | xargs -r -n1 basename | grep -E '^[0-9]{14}_' | sort | tail -n1 || true)"
latest_ts="${latest_base%%_*}"

while read -r file; do
  [ -z "$file" ] && continue
  name="$(basename "$file")"
  if ! [[ "$name" =~ ^[0-9]{14}_[a-z0-9_]+\.sql$ ]]; then
    annotate "$file" "El nombre debe ser AAAAMMDDHHMMSS_nombre_en_snake_case.sql (usa npm run db:migration:new)."
    status=1
    continue
  fi
  ts="${name%%_*}"
  if [ -n "$latest_ts" ] && [ "$ts" -le "$latest_ts" ]; then
    annotate "$file" "Su timestamp ($ts) no es posterior a la última migración de la base ($latest_base). Renómbrala con una fecha más reciente."
    status=1
  fi
done < <(git diff --name-only --diff-filter=A "$merge_base" HEAD -- "$DIR")

if [ "$status" -eq 0 ]; then
  echo "✓ Historial de migraciones en orden respecto a $BASE_REF"
fi
exit "$status"
