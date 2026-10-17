#!/usr/bin/env bash
# Recria um banco de teste, aplica as migrations e roda os testes do banco.
# Use PGHOST/PGPORT/PGUSER para apontar para o seu Postgres local.
set -euo pipefail
cd "$(dirname "$0")/.."
DB=${TEST_DB:-so_marcar_test}
psql -q -v ON_ERROR_STOP=1 -d postgres -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/supabase_stub.sql
for f in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/db_test.sql 2>&1 | grep -E "ok:|FALHOU|ERROR|PASSARAM"
