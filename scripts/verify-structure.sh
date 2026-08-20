#!/usr/bin/env bash
set -euo pipefail

test -f apps/web/package.json
test -f apps/api/artisan
test -f contracts/openapi.yaml
test -f docs/superpowers/specs/2026-08-20-ministry-sprout-design.md
