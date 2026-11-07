#!/usr/bin/env bash
# Hook Stop: si Claude termina con cambios de código en una rama sin tarea
# (sin try-N en el nombre), le recuerda registrarlos en Linear antes de cerrar.
# Solo avisa una vez por turno y nunca interrumpe si la rama ya tiene tarea.

input=$(cat)

# Ya se avisó en este turno: dejar terminar para no crear un ciclo.
if printf '%s' "$input" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

case "$(git branch --show-current 2>/dev/null)" in
  *try-[0-9]*) exit 0 ;;
esac

# Solo cuenta código funcional: docs y configuración no generan tarea.
[ -z "$(git status --porcelain -- app server supabase netlify 2>/dev/null)" ] && exit 0

cat <<'EOF'
{"decision":"block","reason":"Hay cambios de código sin tarea de Linear: la rama actual no tiene try-N en el nombre. Aplica el protocolo de .claude/commands/linear-track.md: busca o crea la tarea, déjala con su comentario de decisión y mueve los cambios a una rama {tipo}/try-{N}-{slug}. Omítelo solo si el usuario pidió no registrar este cambio o si el conector de Linear no está disponible, y dilo en tu mensaje final."}
EOF
