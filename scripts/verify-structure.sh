#!/usr/bin/env bash
set -euo pipefail

test -f apps/web/package.json
test -f apps/api/artisan
test -f contracts/openapi.yaml
test -f docs/superpowers/specs/2026-08-20-ministry-sprout-design.md

grep -Fqx '      - postgres-data:/var/lib/postgresql' compose.yaml
! grep -Fq 'postgres-data:/var/lib/postgresql/data' compose.yaml
! grep -Fq 'POSTGRES_HOST_AUTH_METHOD' compose.yaml
grep -Fqx '      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-}' compose.yaml
grep -Fqx '      - "127.0.0.1:5432:5432"' compose.yaml
grep -Fqx 'POSTGRES_PASSWORD=' .env.example
grep -Fqx 'DB_USERNAME=ministrysprout_runtime' .env.example
grep -Fqx 'DB_PASSWORD=' .env.example
grep -Fqx 'DB_RUNTIME_USERNAME=ministrysprout_runtime' .env.example
grep -Fqx 'DB_MIGRATION_USERNAME=ministrysprout' .env.example
grep -Fqx 'DB_MIGRATION_PASSWORD=' .env.example
grep -Fqx 'DB_PASSWORD=' apps/api/.env.example
! grep -Fq 'dev-only-password' compose.yaml .env.example apps/api/.env.example
test "$(grep -Fc "'pgsql_migration' => [" apps/api/config/database.php)" -eq 1
test "$(grep -Fc "'runtime_role' => env('DB_RUNTIME_USERNAME')" apps/api/config/database.php)" -eq 1
! grep -R -Fq "Hash::make('test-only-password')" apps/api/tests
