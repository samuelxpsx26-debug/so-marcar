#!/usr/bin/env bash
# Bloqueia edições perigosas: segredos locais e migrations que já foram aplicadas.
file=$(jq -r '.tool_input.file_path // ""')
[ -z "$file" ] && exit 0
root=$(cd "$(dirname "$0")/../.." && pwd)
rel=${file#"$root"/}
deny() { jq -n --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; exit 0; }
case "$rel" in
  .env|.env.local|.env.*.local|.env.production)
    deny "Arquivos .env guardam segredos e não devem ser editados pelo Claude. Peça ao Widney para alterar." ;;
  supabase/migrations/*.sql)
    if git -C "$root" ls-files --error-unmatch "$rel" >/dev/null 2>&1; then
      deny "Esta migration já está no repositório (e provavelmente aplicada em produção). Não altere: crie uma migration nova com /nova-migration."
    fi ;;
esac
exit 0
