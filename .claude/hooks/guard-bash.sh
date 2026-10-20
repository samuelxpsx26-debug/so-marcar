#!/usr/bin/env bash
# Pede confirmação antes de publicar na branch main (o que vai para main entra no site).
cmd=$(jq -r '.tool_input.command // ""')
branch=$(git -C "${CLAUDE_PROJECT_DIR:-.}" branch --show-current 2>/dev/null)
if echo "$cmd" | grep -Eq 'git[[:space:]]+push' && { echo "$cmd" | grep -Eq '(^|[[:space:]:])main([[:space:]]|$)|--all|--mirror' || [ "$branch" = main ]; }; then
  jq -n '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"ask",permissionDecisionReason:"Isto publica no site (branch main). O Widney aprovou esta mudança?"}}'
fi
exit 0
