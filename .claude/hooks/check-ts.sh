#!/usr/bin/env bash
# Depois de editar .ts/.tsx em src/, corrige o lint e confere os tipos. Erros voltam para o Claude.
file=$(jq -r '.tool_input.file_path // ""')
case "$file" in */src/*.ts|*/src/*.tsx) ;; *) exit 0 ;; esac
[ -f "$file" ] || exit 0
cd "$(dirname "$0")/../.." || exit 0
out=$(npx eslint --fix "$file" 2>&1) || { echo "ESLint encontrou problemas em $file:" >&2; echo "$out" | tail -20 >&2; exit 2; }
out=$(npx tsc --noEmit -p . 2>&1) || { echo "Erros de tipo (tsc):" >&2; echo "$out" | head -20 >&2; exit 2; }
exit 0
