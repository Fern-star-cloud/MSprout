#!/usr/bin/env bash
set -euo pipefail

test -f apps/web/package.json
test -f apps/api/artisan
test -f contracts/openapi.yaml
test -f docs/superpowers/specs/2026-08-20-ministry-sprout-design.md

grep -Fqx '      - postgres-data:/var/lib/postgresql' compose.yaml
! grep -Fq 'postgres-data:/var/lib/postgresql/data' compose.yaml
! grep -Fq 'POSTGRES_HOST_AUTH_METHOD' compose.yaml
grep -Fqx '      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ministrysprout-dev-only-password}' compose.yaml
grep -Fqx '      - "127.0.0.1:5432:5432"' compose.yaml
grep -Fqx 'POSTGRES_PASSWORD=ministrysprout-dev-only-password' .env.example
grep -Fqx 'DB_PASSWORD=ministrysprout-dev-only-password' .env.example
grep -Fqx 'DB_PASSWORD=ministrysprout-dev-only-password' apps/api/.env.example
