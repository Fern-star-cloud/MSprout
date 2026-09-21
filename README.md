# MinistrySprout

MinistrySprout is a secure, multi-church attendance PWA for children's ministry.

## Prerequisites

- Node.js 24 LTS and Corepack
- pnpm 10
- PHP 8.3 or later with Composer
- Docker Compose for local PostgreSQL and Mailpit

## Local development

1. Copy `.env.example` values into local environment configuration as needed.
2. Start local services with `docker compose up -d`.
3. Install JavaScript dependencies with `pnpm install`.
4. Install API dependencies with `cd apps/api && composer install`.
5. Run `pnpm verify` for the baseline quality suite.

The React PWA lives in `apps/web`, the Laravel API lives in `apps/api`, and the OpenAPI source of truth is `contracts/openapi.yaml`.

Authentication setup, the isolated platform invitation, and verification commands are documented in [Task 4 authentication](docs/security/task-4-authentication.md).

## Security

Never commit credentials, tokens, personally identifiable child data, or production configuration. The local Compose stack is development-only and binds PostgreSQL and Mailpit to loopback addresses.
