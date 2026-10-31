# Só Marcar

- Responda sempre em português do Brasil.
- Regra da página principal: toda vez que uma função for criada ou mudar, confira se ela vale aparecer na página inicial (lista `FEATURE_GROUPS` em `src/components/landing/landing.tsx`, FAQ e textos do mesmo arquivo). Se for útil para quem está decidindo assinar, inclua ou ajuste o texto ali no mesmo trabalho. Não anuncie o que ainda não funciona (ex.: lembretes por e-mail antes do Resend).
- Mudanças visuais no site só vão para a main depois de o Widney ver a prévia e aprovar.
- Nunca edite migrations já aplicadas: crie uma nova em `supabase/migrations/` e entregue o SQL para o Widney rodar no Supabase.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
- Se o comando `graphify` não existir na sessão, instale com `uv tool install "graphifyy[sql]"` e gere o mapa com `graphify update .` (uns 15 segundos, sem custo). A pasta graphify-out/ não vai para o git.
