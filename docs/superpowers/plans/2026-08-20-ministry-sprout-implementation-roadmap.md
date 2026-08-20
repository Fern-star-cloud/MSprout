# MinistrySprout Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build MinistrySprout, a secure, multi-church, installable attendance PWA that records attendance offline, synchronizes safely online, supports student import and birthdays, and maintains complete auditability.

**Architecture:** A new standalone monorepo contains a React/TypeScript PWA and a Laravel API. IndexedDB holds deliberately limited, per-profile offline data and an idempotent outbox; PostgreSQL is authoritative and enforces tenant isolation with both application scoping and row-level security. Vercel serves the frontend, while Railway initially runs Laravel, its queue/scheduler, and PostgreSQL.

**Tech Stack:** Node.js 24 LTS, pnpm 10, React 19.2, TypeScript 5.9, Vite 8.2, Dexie 4, Laravel 13, PHP 8.3+, PostgreSQL 18, Fortify, Sanctum, Pest, Vitest, Testing Library, and Playwright.

**Spec:** docs/superpowers/specs/2026-08-20-ministry-sprout-design.md

## Global Constraints

- Use the private GitHub repository Frierend/ministry-sprout with fresh Git history.
- Use `MinistrySprout` as the full product and manifest name, `Sprout` as the PWA short name, and `Children's ministry, ready anywhere.` as the tagline.
- Do not fork, modify, import Git history from, or deploy Frierend/kids-ministry-app.
- Keep MVP scope to approval, accounts, ministries, students, imports, birthdays, offline attendance, sync, reports, conflicts, logs, and operations.
- Exclude points, Market Day, photos, guardian/contact records, messaging, billing, and advanced analytics.
- Every tenant-owned server record carries a trusted church_id and UUID.
- PostgreSQL RLS and application authorization both protect tenant data.
- sage.dev is a separate online-only platform administrator verified through the developer's private Gmail and protected by mandatory MFA.
- Church Owner MFA is mandatory; Teachers are invite-only.
- Each church has exactly one active Owner in MVP.
- Offline authorization lasts 14 days and renews only after successful authentication/sync.
- Offline writes are limited to attendance drafts, attendance states, finalization, and temporary guests.
- Contradictory attendance never uses silent last-write-wins.
- No password, API key, bootstrap credential, token, or personal data is committed or logged.
- Student birthdate is optional; the offline cache receives only the next birthday month/day and turning age.
- Birthday pushes are privacy-safe and scheduled for 8:00 AM in the church timezone.
- XLSX/CSV import is Owner-only, online-only, create-first, previewed, audited, idempotent, and limited to 500 rows.
- Use TDD for domain behavior and commit after every task passes its stated checks.
- Every API endpoint or schema change updates contracts/openapi.yaml, regenerates apps/web/src/api/generated.ts, and passes the contract test in the same task.

---

## Execution Slices

This specification contains several independent subsystems, so implementation is divided into six review gates:

1. Foundation and access control — Tasks 1–7
2. Church roster management — Tasks 8–9
3. PWA and offline foundation — Tasks 10–11
4. Attendance and synchronization — Tasks 12–14
5. Reports, birthdays, and operations — Tasks 15–17
6. Release qualification and pilot — Task 18

Do not begin a later slice until the preceding slice passes its full test suite and review.

## Execution Preflight

Before Task 1, verify the empty private GitHub repository Frierend/ministry-sprout and place the approved design and this roadmap at their exact docs/superpowers paths in the new local repository. These two approved artifacts are the only starting files; no file or Git object is copied from Frierend/kids-ministry-app. Establish them as the initial `main` documentation baseline, then execute implementation on `feat/mvp-foundation`.

## Planned File Map

### Repository root

- README.md — developer setup, architecture summary, commands, and deployment notes
- AGENTS.md — repository-specific engineering, security, and verification rules
- package.json — root scripts only
- pnpm-workspace.yaml — frontend workspace declaration
- compose.yaml — local PostgreSQL and Mailpit services
- .env.example — non-secret local variable names
- .github/workflows/ci.yml — frontend/backend tests and builds
- .github/workflows/security.yml — dependency, secret, and static scans
- contracts/openapi.yaml — API source of truth

### React PWA

- apps/web/src/app/router.tsx — role-aware route tree
- apps/web/src/app/providers.tsx — query, auth, connectivity, and error providers
- apps/web/src/api/client.ts — typed API transport
- apps/web/src/auth/session.ts — active server-session state
- apps/web/src/offline/db.ts — Dexie schema
- apps/web/src/offline/crypto.ts — profile-key wrapping and AES-GCM helpers
- apps/web/src/offline/profile-store.ts — isolated device profiles and lease metadata
- apps/web/src/sync/outbox.ts — atomic local event creation
- apps/web/src/sync/sync-client.ts — push, pull, acknowledgement, and cursor loop
- apps/web/src/sync/conflict-store.ts — local conflict projection
- apps/web/src/features/* — bounded product modules
- apps/web/src/pwa/service-worker.ts — app-shell, update, push, and notification-click behavior
- apps/web/src/styles/* — tokens, global accessibility rules, and responsive layout

### Laravel API

- apps/api/app/Http/Middleware/ResolveChurchMembership.php — derive trusted church/role context
- apps/api/app/Http/Middleware/TenantDatabaseTransaction.php — set transaction-local PostgreSQL tenant context
- apps/api/app/Support/Tenancy/TenantContext.php — tenant execution interface for requests and jobs
- apps/api/app/Policies/* — Owner/Teacher and ministry authorization
- apps/api/app/Actions/* — single-purpose application actions
- apps/api/app/Domain/Attendance/* — attendance state machine and sync application
- apps/api/app/Domain/Audit/* — append-only audit writer and log redaction
- apps/api/app/Domain/Imports/* — workbook inspection, normalization, preview, and commit
- apps/api/app/Domain/Notifications/* — birthday selection and Web Push delivery
- apps/api/database/migrations/* — PostgreSQL schema, constraints, indexes, and RLS
- apps/api/routes/api.php — tenant API routes
- apps/api/routes/platform.php — isolated sage.dev routes
- apps/api/tests/* — Pest unit, feature, tenant-isolation, and security tests

---

### Task 1: Create the Independent Monorepo and Quality Baseline

**Files:**
- Create: README.md
- Create: AGENTS.md
- Create: package.json
- Create: pnpm-workspace.yaml
- Create: compose.yaml
- Create: .env.example
- Create: apps/web/**
- Create: apps/api/**
- Create: .github/workflows/ci.yml
- Create: .github/workflows/security.yml

**Interfaces:**
- Consumes: approved design specification only
- Produces: pnpm run verify, composer test, local PostgreSQL at port 5432, local Mailpit at ports 1025/8025

- [ ] **Step 1: Create the fresh repository and confirm isolation**

Run:

~~~bash
test "$(git branch --show-current)" = "feat/mvp-foundation"
test "$(git remote get-url origin)" = "https://github.com/Frierend/ministry-sprout.git"
test "$(git remote | wc -l | tr -d ' ')" = "1"
~~~

Expected: the isolated feature branch starts from the documentation-only `main` baseline and its only remote is the new MinistrySprout repository. Do not add the Expo repository as a remote.

- [ ] **Step 2: Write a failing repository smoke check**

Create scripts/verify-structure.sh:

~~~bash
#!/usr/bin/env bash
set -euo pipefail
test -f apps/web/package.json
test -f apps/api/artisan
test -f contracts/openapi.yaml
test -f docs/superpowers/specs/2026-08-20-ministry-sprout-design.md
~~~

Run: bash scripts/verify-structure.sh

Expected: FAIL because the application folders and copied approved spec are not present.

- [ ] **Step 3: Scaffold the pinned major versions**

Run:

~~~bash
corepack enable
corepack prepare pnpm@10 --activate
pnpm dlx create-vite@8.2 apps/web --template react-ts
composer create-project laravel/laravel:^13.0 apps/api
mkdir -p contracts docs/superpowers/specs docs/superpowers/plans
test -f docs/superpowers/specs/2026-08-20-ministry-sprout-design.md
~~~

Place the approved design and roadmap artifacts from this conversation into their exact docs/superpowers paths before running the final test command. Add the following minimal contracts/openapi.yaml; Task 2 expands it:

~~~yaml
openapi: 3.1.0
info:
  title: MinistrySprout API
  version: 1.0.0
paths: {}
~~~

Pin the generated frontend to React 19.2, TypeScript 5.9, and Vite 8.2, then install Vitest and add test, typecheck, and build scripts before creating the pnpm lockfile.

Add root package.json:

~~~json
{
  "name": "ministry-sprout",
  "private": true,
  "packageManager": "pnpm@10",
  "scripts": {
    "web:test": "pnpm --dir apps/web test",
    "web:typecheck": "pnpm --dir apps/web typecheck",
    "web:build": "pnpm --dir apps/web build",
    "api:test": "cd apps/api && php artisan test",
    "verify": "pnpm web:test && pnpm web:typecheck && pnpm web:build && pnpm api:test"
  }
}
~~~

- [ ] **Step 4: Add local services and CI**

Create compose.yaml with PostgreSQL 18 and Mailpit, health checks, named development volumes, and no production credentials. Create CI jobs for Node 24, PHP 8.3, PostgreSQL 18, pnpm lockfile install, Composer install, migrations, tests, typecheck, and build. Create a separate security workflow for Composer audit, pnpm audit, Gitleaks, and Semgrep.

Run: bash scripts/verify-structure.sh

Expected: PASS.

- [ ] **Step 5: Run the complete baseline**

Run:

~~~bash
docker compose up -d
pnpm install
cd apps/api && composer install && php artisan test
cd ../web && pnpm test --run && pnpm tsc --noEmit && pnpm build
~~~

Expected: all scaffold tests and builds pass.

- [ ] **Step 6: Commit**

~~~bash
git add -- README.md AGENTS.md package.json pnpm-workspace.yaml pnpm-lock.yaml compose.yaml .env.example scripts/verify-structure.sh contracts/openapi.yaml apps/web apps/api .github
git commit -m "chore: initialize MinistrySprout monorepo"
~~~

### Task 2: Define the API Contract and Typed Client

**Files:**
- Create: contracts/openapi.yaml
- Create: apps/web/src/api/generated.ts
- Create: apps/web/src/api/client.ts
- Create: apps/web/src/api/client.test.ts
- Modify: apps/web/package.json
- Create: apps/api/tests/Feature/Contract/HealthContractTest.php
- Modify: apps/api/routes/api.php

**Interfaces:**
- Consumes: same-origin /api URL
- Produces: ApiError, PageMeta, SyncPushRequest, SyncPushResponse, SyncPullResponse, and generated TypeScript paths

- [ ] **Step 1: Write failing contract tests**

Frontend test:

~~~ts
it('returns a typed health payload', async () => {
  server.use(http.get('/api/health', () => HttpResponse.json({ status: 'ok' })))
  await expect(api.getHealth()).resolves.toEqual({ status: 'ok' })
})
~~~

Backend test:

~~~php
it('returns the contract health shape', function () {
    $this->getJson('/api/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok']);
});
~~~

Run: pnpm --dir apps/web test --run src/api/client.test.ts && cd apps/api && php artisan test --filter=HealthContractTest

Expected: FAIL because the route, client, and generated types do not exist.

- [ ] **Step 2: Define response conventions**

In contracts/openapi.yaml define:

~~~yaml
openapi: 3.1.0
info:
  title: MinistrySprout API
  version: 1.0.0
servers:
  - url: /api
components:
  schemas:
    ApiError:
      type: object
      required: [code, message, correlation_id]
      properties:
        code: { type: string }
        message: { type: string }
        correlation_id: { type: string, format: uuid }
        field_errors:
          type: object
          additionalProperties:
            type: array
            items: { type: string }
    Health:
      type: object
      required: [status]
      properties:
        status: { type: string, enum: [ok] }
paths:
  /health:
    get:
      operationId: getHealth
      responses:
        '200':
          description: Healthy
          content:
            application/json:
              schema: { $ref: '#/components/schemas/Health' }
~~~

- [ ] **Step 3: Generate and implement the typed transport**

Install openapi-typescript, openapi-fetch, MSW, and Vitest. Generate apps/web/src/api/generated.ts from contracts/openapi.yaml. Implement one client instance with credentials set to include, CSRF initialization, correlation-ID propagation, and normalized ApiError throwing.

- [ ] **Step 4: Implement the backend route and error envelope**

Add GET /api/health. Add an exception renderer that returns code, safe message, correlation_id, and optional field_errors without stack traces or raw input.

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
pnpm --dir apps/web test --run src/api/client.test.ts
cd apps/api && php artisan test --filter=Contract
pnpm --dir apps/web typecheck
~~~

Expected: PASS.

Commit:

~~~bash
git add contracts apps/web apps/api
git commit -m "feat: establish typed api contract"
~~~

### Task 3: Build Tenant Schema and PostgreSQL RLS

**Files:**
- Create: apps/api/app/Models/Church.php
- Create: apps/api/app/Models/ChurchMembership.php
- Create: apps/api/app/Enums/ChurchRole.php
- Create: apps/api/app/Support/Tenancy/TenantContext.php
- Create: apps/api/app/Http/Middleware/ResolveChurchMembership.php
- Create: apps/api/app/Http/Middleware/TenantDatabaseTransaction.php
- Create: apps/api/database/migrations/*_create_churches_table.php
- Create: apps/api/database/migrations/*_create_church_memberships_table.php
- Create: apps/api/database/migrations/*_enable_tenant_rls.php
- Create: apps/api/tests/Feature/Tenancy/CrossChurchIsolationTest.php
- Create: apps/api/tests/Unit/Tenancy/TenantContextTest.php
- Create: apps/api/tests/Support/ChurchScenario.php

**Interfaces:**
- Produces: TenantContext::churchId(): string; TenantContext::role(): ChurchRole; TenantContext::run(string $churchId, Closure $callback): mixed
- Guarantees: no tenant query succeeds without a transaction-local app.current_church_id

- [ ] **Step 1: Write failing isolation tests**

~~~php
it('prevents one church from reading another church', function () {
    [$ownerA, $churchA] = ChurchScenario::owner();
    [$ownerB, $churchB] = ChurchScenario::owner();
    $membershipB = $ownerB->memberships()->whereBelongsTo($churchB)->firstOrFail();

    $visible = app(TenantContext::class)->run(
        $churchA->id,
        fn () => ChurchMembership::query()->whereKey($membershipB->id)->exists(),
    );

    expect($visible)->toBeFalse();
});

it('denies requests without an active membership', function () {
    [$owner, $church] = ChurchScenario::owner();
    $outsider = User::factory()->create();

    $this->actingAs($outsider)
        ->withHeader('X-Church-Id', $church->id)
        ->getJson('/api/ministries')
        ->assertForbidden();
});
~~~

Run: cd apps/api && php artisan test --filter=CrossChurchIsolationTest

Expected: FAIL because tenant schema and middleware do not exist.

- [ ] **Step 2: Add UUID tenancy tables and constraints**

Create churches with id, name, slug, timezone, status, created_at, updated_at. Create memberships with id, church_id, user_id, role, status, created_at, updated_at. Add unique church/user membership and a partial unique index that permits exactly one active owner per church.

Define:

~~~php
enum ChurchRole: string
{
    case Owner = 'owner';
    case Teacher = 'teacher';
}
~~~

- [ ] **Step 3: Implement trusted tenant resolution**

Validate the requested church identifier as a UUID, begin the tenant request transaction, and set the transaction-local church value before querying RLS-protected membership rows. Then query only an active membership whose user_id equals the authenticated user. If it does not exist, roll back and return 403 without populating application TenantContext. This lets RLS restrict the preliminary lookup to the requested church while the user_id predicate prevents an outsider from borrowing another person's membership. Execute:

~~~sql
SELECT set_config('app.current_church_id', :church_id, true);
~~~

TenantContext must reject nested execution with a different church and must clear in-memory context in a finally block.

- [ ] **Step 4: Enable and force RLS**

For every tenant table, execute:

~~~sql
ALTER TABLE ministries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministries FORCE ROW LEVEL SECURITY;
CREATE POLICY ministries_church_isolation ON ministries
USING (
  church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid
)
WITH CHECK (
  church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid
);
~~~

Use a non-owner runtime database role in production; migration credentials remain separate.

- [ ] **Step 5: Verify direct and HTTP isolation**

Run: cd apps/api && php artisan test tests/Feature/Tenancy tests/Unit/Tenancy

Expected: cross-tenant reads, writes, updates, and deletes fail; same-tenant actions pass.

- [ ] **Step 6: Commit**

~~~bash
git add apps/api
git commit -m "feat: enforce church tenant isolation"
~~~

### Task 4: Implement Church Authentication, MFA, and sage.dev

**Files:**
- Modify: apps/api/config/auth.php
- Create: apps/api/app/Models/PlatformAdmin.php
- Create: apps/api/app/Mail/PlatformAdminSetupMail.php
- Create: apps/api/database/factories/PlatformAdminFactory.php
- Create: apps/api/app/Console/Commands/BootstrapPlatformAdmin.php
- Create: apps/api/app/Http/Controllers/Auth/PlatformSessionController.php
- Create: apps/api/app/Http/Middleware/RequireConfirmedOwnerMfa.php
- Create: apps/api/routes/platform.php
- Create: apps/api/tests/Feature/Auth/ChurchAuthenticationTest.php
- Create: apps/api/tests/Feature/Auth/OwnerMfaGateTest.php
- Create: apps/api/tests/Feature/Platform/BootstrapPlatformAdminTest.php
- Create: apps/web/src/features/auth/**
- Create: apps/web/src/features/platform-auth/**

**Interfaces:**
- Produces: GET /api/me, POST /login, POST /logout, Fortify verification/MFA endpoints, isolated /platform/login and /platform/me
- sage.dev bootstrap input: verified recovery email only; no password argument

- [ ] **Step 1: Write failing authentication boundary tests**

Test that an unverified church user cannot apply, an Owner without confirmed MFA cannot enter tenant routes, a Teacher is not forced to enroll MFA, and a church user session cannot enter /platform routes.

Platform bootstrap test:

~~~php
it('creates a pending platform admin without accepting a password', function () {
    Mail::fake();

    $this->artisan('platform:bootstrap-admin', [
        '--handle' => 'sage.dev',
        '--email' => 'developer@example.com',
    ])->assertSuccessful();

    expect(PlatformAdmin::query()->where('handle', 'sage.dev')->exists())->toBeTrue();
    Mail::assertQueued(PlatformAdminSetupMail::class);
});
~~~

Run: cd apps/api && php artisan test --filter='Authentication|Mfa|PlatformAdmin'

Expected: FAIL.

- [ ] **Step 2: Install and configure Fortify and Sanctum**

Use Fortify for church user login, verification, password reset, and TOTP MFA. Use Sanctum's same-origin SPA session mode. Return only user ID, display name, verified state, memberships, assignments summary, and active-session metadata from /api/me.

- [ ] **Step 3: Create the isolated platform guard**

Add a platform session guard backed by platform_admins. Use a distinct cookie name and route group. PlatformAdmin uses modern password hashing, confirmed TOTP MFA, recovery codes, session rotation, and online-only authorization. Do not give the platform guard access to tenant child endpoints.

- [ ] **Step 4: Implement one-time sage.dev bootstrap**

The command creates only a pending platform record and sends a short-lived signed setup link to the supplied private email. Setup requires password creation, email verification, MFA confirmation, and recovery-code acknowledgement. Reject a second active sage.dev bootstrap.

- [ ] **Step 5: Build accessible login, verification, MFA, and recovery screens**

Use semantic forms, visible field errors, password-manager-compatible autocomplete values, no password logging, and rate-limit messaging that does not disclose account existence.

- [ ] **Step 6: Verify and commit**

Run:

~~~bash
cd apps/api && php artisan test tests/Feature/Auth tests/Feature/Platform
pnpm --dir apps/web test --run src/features/auth src/features/platform-auth
pnpm --dir apps/web typecheck
~~~

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add isolated secure account authentication"
~~~

### Task 5: Add Public Church Application and sage.dev Approval

**Files:**
- Create: apps/api/app/Models/ChurchApplication.php
- Create: apps/api/app/Enums/ApplicationStatus.php
- Create: apps/api/app/Actions/Applications/SubmitChurchApplication.php
- Create: apps/api/app/Actions/Applications/ApproveChurchApplication.php
- Create: apps/api/app/Actions/Applications/RejectChurchApplication.php
- Create: apps/api/app/Http/Controllers/ChurchApplicationController.php
- Create: apps/api/app/Http/Controllers/Platform/ApplicationReviewController.php
- Create: apps/api/app/Jobs/PurgeRejectedApplications.php
- Create: apps/api/tests/Feature/Applications/ChurchApplicationFlowTest.php
- Create: apps/web/src/features/applications/**
- Create: apps/web/src/features/platform/applications/**

**Interfaces:**
- Produces: POST /api/church-applications; GET /api/church-applications/current; platform list/show/approve/reject endpoints
- Approval atomically creates one church and one active Owner membership

- [ ] **Step 1: Write the complete failing lifecycle test**

~~~php
it('keeps an applicant tenantless until sage.dev approves', function () {
    $applicant = User::factory()->verified()->create();

    $this->actingAs($applicant)
        ->postJson('/api/church-applications', [
            'church_name' => 'Grace Kids Ministry',
            'timezone' => 'Asia/Manila',
            'city' => 'Davao City',
        ])->assertCreated();

    expect($applicant->memberships()->count())->toBe(0);

    $admin = PlatformAdmin::factory()->active()->create();
    $application = ChurchApplication::firstOrFail();

    $this->actingAs($admin, 'platform')
        ->postJson("/platform/applications/{$application->id}/approve")
        ->assertOk();

    expect($applicant->memberships()->where('role', 'owner')->count())->toBe(1);
});
~~~

Run: cd apps/api && php artisan test --filter=ChurchApplicationFlowTest

Expected: FAIL.

- [ ] **Step 2: Implement constrained submission**

Require verified email, CAPTCHA token, rate limit, normalized church name, valid IANA timezone, bounded city/address text, and no files. Detect duplicate active applications by user and normalized church/city combination.

- [ ] **Step 3: Implement approval and rejection transactions**

Approval locks the application row, verifies Pending state, creates church and Owner membership, marks Approved, writes platform audit, and queues approval mail. Rejection requires a bounded category and sanitized note, writes audit, and queues mail. Replays return the original result.

- [ ] **Step 4: Add 30-day privacy cleanup**

Purge rejected application PII after 30 days. Delete an applicant-only user with no active application or membership. Retain only internal IDs, decision category, actor, UTC time, and correlation ID.

- [ ] **Step 5: Build applicant and platform review screens**

Applicant screens show Email Verification, Pending, Approved/MFA Required, or Rejected. Platform screens show only application metadata needed for a decision and require a reason.

- [ ] **Step 6: Verify abuse controls and commit**

Run:

~~~bash
cd apps/api && php artisan test tests/Feature/Applications
pnpm --dir apps/web test --run src/features/applications src/features/platform/applications
~~~

Expected: approval is idempotent, pending users have no tenant, rate limits work, and purge removes PII.

Commit:

~~~bash
git add apps
git commit -m "feat: add approval-gated church registration"
~~~

### Task 6: Add Teacher Invitations, Assignments, and Ownership Transfer

**Files:**
- Create: apps/api/app/Models/Invitation.php
- Create: apps/api/app/Models/TeacherMinistryAssignment.php
- Create: apps/api/app/Actions/Invitations/InviteTeacher.php
- Create: apps/api/app/Actions/Invitations/AcceptTeacherInvitation.php
- Create: apps/api/app/Actions/Memberships/RevokeTeacher.php
- Create: apps/api/app/Actions/Memberships/TransferOwnership.php
- Create: apps/api/app/Policies/ChurchMembershipPolicy.php
- Create: apps/api/tests/Feature/Memberships/TeacherInvitationTest.php
- Create: apps/api/tests/Feature/Memberships/OwnershipTransferTest.php
- Create: apps/web/src/features/teachers/**

**Interfaces:**
- Produces: owner invitation/list/revoke/assign endpoints; public signed invitation acceptance; reauthenticated ownership-transfer endpoint
- Guarantees: exactly one active Owner and ministry-scoped Teacher access

- [ ] **Step 1: Write failing role and transfer tests**

Test that a Teacher cannot invite, self-assign, transfer ownership, or view another ministry; an Owner can invite and assign; a transfer creates one new Owner and demotes the previous Owner atomically.

- [ ] **Step 2: Create invitation and assignment schema**

Invitation fields: UUID, church_id, normalized email, intended role fixed to Teacher, token hash, expires_at, accepted_at, revoked_at, inviter_id. Assignment fields: church_id, membership_id, ministry_id, assigned_by, timestamps, unique membership/ministry.

- [ ] **Step 3: Implement invitation acceptance and revocation**

Use a single-use signed token, email match, expiry check, and transaction. Revocation invalidates active server sessions, future sync, push subscriptions, and the offline lease; it never deletes audit history.

- [ ] **Step 4: Implement secure ownership transfer**

Require current Owner password confirmation, confirmed MFA challenge, explicit target Teacher, and transaction-level row locking. Update roles and write one high-risk audit event in the same transaction.

- [ ] **Step 5: Build teacher management UI**

Provide list, invitation status, assignment editor, revoke confirmation, and ownership-transfer confirmation. Never render actions the current policy denies, while still relying on server authorization.

- [ ] **Step 6: Verify and commit**

Run: cd apps/api && php artisan test tests/Feature/Memberships && pnpm --dir apps/web test --run src/features/teachers

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add scoped teacher membership management"
~~~

### Task 7: Establish Append-Only Audit, Security, and Correlation Logging

**Files:**
- Create: apps/api/app/Domain/Audit/AuditEntry.php
- Create: apps/api/app/Models/AuditEvent.php
- Create: apps/api/database/factories/AuditEventFactory.php
- Create: apps/api/app/Domain/Audit/AuditWriter.php
- Create: apps/api/app/Domain/Audit/SecurityEventWriter.php
- Create: apps/api/app/Http/Middleware/CorrelationId.php
- Create: apps/api/app/Logging/RedactContext.php
- Create: apps/api/database/migrations/*_create_audit_events_table.php
- Create: apps/api/database/migrations/*_create_security_events_table.php
- Create: apps/api/tests/Feature/Audit/AuditIntegrityTest.php
- Create: apps/api/tests/Unit/Logging/RedactionTest.php
- Create: apps/web/src/features/audit/**

**Interfaces:**
- Produces: AuditWriter::record(AuditEntry $event): void; SecurityEventWriter::record(...): void; X-Correlation-Id response header
- Guarantees: high-risk actions fail with their transaction if audit persistence fails

- [ ] **Step 1: Write failing append-only and redaction tests**

~~~php
it('rejects normal audit updates and deletes', function () {
    $event = AuditEvent::factory()->create();
    expect(fn () => $event->update(['action' => 'changed']))->toThrow(LogicException::class);
    expect(fn () => $event->delete())->toThrow(LogicException::class);
});

it('redacts prohibited log keys recursively', function () {
    expect(RedactContext::apply([
        'token' => 'secret',
        'child' => ['name' => 'Ana', 'birthdate' => '2018-08-20'],
    ]))->toBe([
        'token' => '[REDACTED]',
        'child' => '[REDACTED]',
    ]);
});
~~~

- [ ] **Step 2: Add compact append-only tables**

Audit fields: UUID, category, church_id nullable, actor_type, actor_id, action, target_type, target_id, result, device_id nullable, sync_batch_id nullable, correlation_id, metadata_json containing allowlisted non-PII values, occurred_at UTC. Revoke UPDATE and DELETE privileges from the runtime role.

- [ ] **Step 3: Implement correlation and redaction**

Accept a valid client UUID correlation ID or generate one; attach it to response, job payload, audit event, and sanitized system log. Redact password, token, authorization, cookie, child, birthdate, guardian, request_body, and push endpoint keys recursively.

- [ ] **Step 4: Integrate all high-risk actions**

Wire application decision, ownership transfer, invitation, revocation, role/assignment, attendance finalization/correction, import commit, MFA/reset, access denial, and platform action through the writers.

- [ ] **Step 5: Add scoped audit viewers**

Build a Church Owner audit screen filtered to the active church and a platform audit screen filtered to platform events. Teachers see only their own submission/sync activity. All lists use server pagination and never expose raw metadata, child birthdates, authentication material, or another church's events.

- [ ] **Step 6: Verify and commit**

Run: cd apps/api && php artisan test tests/Feature/Audit tests/Unit/Logging && pnpm --dir ../web test --run src/features/audit

Expected: prohibited mutations fail, transaction rollback includes missing audit, and logs contain no tested PII/secrets.

Commit:

~~~bash
git add apps/api
git commit -m "feat: add immutable audit and security logging"
~~~

### Task 8: Build Ministries, Students, Birthdates, and Default Avatars

**Files:**
- Create: apps/api/app/Models/Ministry.php
- Create: apps/api/app/Models/Student.php
- Create: apps/api/app/Models/Enrollment.php
- Create: apps/api/app/Enums/Gender.php
- Create: apps/api/app/Actions/Students/NormalizeStudentInput.php
- Create: apps/api/app/Data/NormalizedStudentData.php
- Create: apps/api/app/Policies/StudentPolicy.php
- Create: apps/api/tests/Feature/Students/StudentManagementTest.php
- Create: apps/api/tests/Unit/Students/NormalizeStudentInputTest.php
- Create: apps/web/src/features/ministries/**
- Create: apps/web/src/features/students/**
- Create: apps/web/src/assets/avatars/male.svg
- Create: apps/web/src/assets/avatars/female.svg
- Create: apps/web/src/assets/avatars/neutral.svg

**Interfaces:**
- Produces: ministry/student/enrollment CRUD endpoints; NormalizedStudentData; avatarForGender(gender): SVG URL
- Student fields: first_name, middle_name, last_name, preferred_name, suffix, date_of_birth, gender, external_reference, status

- [ ] **Step 1: Write failing normalization and authorization tests**

~~~php
it('normalizes safe values without changing intended capitalization', function () {
    $data = NormalizeStudentInput::handle([
        'first_name' => '  McKayla  ',
        'last_name' => '  de   la Cruz ',
        'gender' => '',
        'date_of_birth' => '2018-08-20',
    ]);

    expect($data->firstName)->toBe('McKayla')
        ->and($data->lastName)->toBe('de la Cruz')
        ->and($data->gender)->toBe(Gender::Unspecified)
        ->and($data->dateOfBirth->format('Y-m-d'))->toBe('2018-08-20');
});
~~~

Also test future birthdate rejection, neutral fallback, Owner CRUD, Teacher assigned read, Teacher write denial, and cross-church denial.

- [ ] **Step 2: Add schema, constraints, RLS, and indexes**

Use UUIDs, church_id, version integer default 1, timestamps, and deleted_at tombstone. External reference is unique within a church when non-null. Enrollments are unique by church/student/ministry. Names are bounded Unicode strings. Gender is Male, Female, or Unspecified.

- [ ] **Step 3: Implement server-authoritative normalization**

Trim Unicode whitespace, collapse internal repeated whitespace, preserve capitalization, normalize accepted gender aliases, parse only unambiguous dates, and reject future/implausible values. Derive display name and age in response resources rather than storing age.

- [ ] **Step 4: Build responsive Owner and Teacher screens**

Owner screens support ministry and student management, enrollment, archive/restore, birthdate date picker, and default avatars. Teacher screens are read-only and limited to assignments. No image picker or upload endpoint exists.

- [ ] **Step 5: Verify and commit**

Run:

~~~bash
cd apps/api && php artisan test tests/Feature/Students tests/Unit/Students
pnpm --dir apps/web test --run src/features/ministries src/features/students
~~~

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add church ministries and student rosters"
~~~

### Task 9: Add Safe XLSX/CSV Import

**Files:**
- Create: apps/api/app/Models/ImportBatch.php
- Create: apps/api/app/Models/ImportRow.php
- Create: apps/api/app/Domain/Imports/InspectWorkbook.php
- Create: apps/api/app/Domain/Imports/MapStudentRow.php
- Create: apps/api/app/Domain/Imports/PreviewStudentImport.php
- Create: apps/api/app/Domain/Imports/CommitStudentImport.php
- Create: apps/api/app/Http/Controllers/StudentImportController.php
- Create: apps/api/tests/Feature/Imports/StudentImportFlowTest.php
- Create: apps/api/tests/Unit/Imports/StudentRowMappingTest.php
- Create: apps/web/src/features/imports/**

**Interfaces:**
- Produces: POST /api/imports/students/preview; POST /api/imports/{batch}/commit; GET /api/imports/{batch}; GET /api/imports/template
- Import state: Uploaded, Previewed, Committing, Completed, Failed, Expired

- [ ] **Step 1: Write failing malicious and valid workbook tests**

Fixtures must include valid CSV/XLSX, ambiguous dates, duplicate students, unknown ministries, spoofed MIME, 501 rows, formula cells, .xlsm, and CSV values starting with = + - @.

Expected preview assertions: valid rows normalized, ambiguous rows invalid, duplicates flagged, unknown ministries require mapping, and executable spreadsheet content rejected.

- [ ] **Step 2: Add packages and strict upload inspection**

Install phpoffice/phpspreadsheet. Accept only .csv and .xlsx, maximum 5 MiB and 500 data rows. Verify MIME and ZIP structure. Reject formulas, macros, external workbook links, hidden executable content, multiple unexpected sheets, and decompression bombs.

- [ ] **Step 3: Implement header mapping and preview**

Recognize only the approved fields. Prefer ISO YYYY-MM-DD and genuine Excel date cells. Do not guess ambiguous numeric dates. Match ministry names case-insensitively but require Owner mapping for unknown values. Use exact external_reference first; otherwise flag normalized name plus birthdate matches.

- [ ] **Step 4: Implement idempotent commit**

Lock the batch, require Previewed state and Owner policy, persist only Owner-approved valid rows, create enrollments, record row outcomes, write one batch audit event, and return the original result for a repeated commit key. Never update or merge existing students automatically.

- [ ] **Step 5: Build download/upload/preview/correction UI**

Show Valid, Invalid, Duplicate, and Needs Mapping counts. Permit ministry mapping and row exclusion. Escape dangerous prefixes when generating downloadable error CSV. Do not display raw server paths or formulas.

- [ ] **Step 6: Verify and commit**

Run: cd apps/api && php artisan test tests/Feature/Imports tests/Unit/Imports && pnpm --dir apps/web test --run src/features/imports

Expected: PASS for valid data; every unsafe fixture is rejected with a safe reason.

Commit:

~~~bash
git add apps
git commit -m "feat: add safe student spreadsheet import"
~~~

### Task 10: Build the Responsive Installable PWA Shell

**Files:**
- Modify: apps/web/vite.config.ts
- Create: apps/web/src/pwa/service-worker.ts
- Create: apps/web/src/pwa/update-controller.ts
- Create: apps/web/public/manifest.webmanifest
- Create: apps/web/public/icons/**
- Create: apps/web/src/app/router.tsx
- Create: apps/web/src/app/layouts/PhoneLayout.tsx
- Create: apps/web/src/app/layouts/WideLayout.tsx
- Create: apps/web/src/components/ConnectivityStatus.tsx
- Create: apps/web/src/styles/tokens.css
- Create: apps/web/src/styles/global.css
- Create: apps/web/src/pwa/pwa.test.ts
- Create: apps/web/e2e/install-and-offline-shell.spec.ts

**Interfaces:**
- Produces: installable manifest, cached application shell, updateAvailable signal, online/offline status
- Service worker excludes /api/** from static caching

- [ ] **Step 1: Write failing PWA and responsive tests**

Test manifest name/start URL/display/icons, service-worker registration, /api exclusion, update deferral, 44-pixel controls, phone bottom navigation, and wide sidebar.

Run: pnpm --dir apps/web test --run src/pwa && pnpm --dir apps/web playwright test e2e/install-and-offline-shell.spec.ts

Expected: FAIL.

- [ ] **Step 2: Configure injectManifest mode**

Install vite-plugin-pwa. Precache hashed application assets only. Use NetworkOnly for /api, no blind API response cache, and an offline navigation fallback to the application shell.

- [ ] **Step 3: Implement controlled updates**

When a waiting service worker exists, expose Update Available. Activate it only when there is no open attendance draft and no unsafe local write. Never force reload while attendance is active.

- [ ] **Step 4: Build semantic responsive layouts**

Phone uses compact bottom navigation; tablet uses two panes; desktop uses a persistent sidebar. Implement keyboard focus, reduced motion, high contrast, text-plus-icon states, and neutral/male/female SVG avatars.

- [ ] **Step 5: Verify Lighthouse-compatible basics and commit**

Run:

~~~bash
pnpm --dir apps/web test --run
pnpm --dir apps/web playwright test e2e/install-and-offline-shell.spec.ts
pnpm --dir apps/web build
~~~

Expected: install criteria, shell offline load, accessibility smoke, and build pass.

Commit:

~~~bash
git add apps/web
git commit -m "feat: add responsive installable pwa shell"
~~~

### Task 11: Add Isolated Local Profiles, Encryption, and Offline Lease

**Files:**
- Create: apps/web/src/offline/db.ts
- Create: apps/web/src/offline/schema.ts
- Create: apps/web/src/offline/crypto.ts
- Create: apps/web/src/offline/profile-store.ts
- Create: apps/web/src/offline/lease.ts
- Create: apps/web/src/features/device-profiles/**
- Create: apps/web/src/offline/crypto.test.ts
- Create: apps/web/src/offline/profile-store.test.ts
- Create: apps/api/app/Http/Controllers/OfflineBootstrapController.php
- Create: apps/api/app/Actions/Devices/IssueOfflineAuthorization.php
- Create: apps/api/tests/Feature/Devices/OfflineAuthorizationTest.php

**Interfaces:**
- Produces: createProfile, unlockProfile, lockProfile, switchProfile, purgeProfile, isLeaseValid; GET /api/offline/bootstrap
- OfflineBootstrap includes assigned ministries, roster projection, next birthday month/day, turning age, lease expiry, and server cursor

- [ ] **Step 1: Write failing encryption and isolation tests**

~~~ts
it('cannot decrypt one teacher profile with another profile PIN', async () => {
  const a = await createProfile({ actorId: 'a', pin: '184629' })
  const b = await createProfile({ actorId: 'b', pin: '934175' })
  await saveEncryptedRoster(a, [{ id: 'student-a', displayName: 'Ana' }])

  await expect(readEncryptedRoster(a, b.unlockKey)).rejects.toThrow()
})
~~~

Test lock clears raw key from memory, lease expiry blocks roster access, server actor mismatch blocks sync, and purging one profile leaves others intact.

- [ ] **Step 2: Implement Dexie schema**

Use stores for profiles, encrypted blobs, attendance drafts, outbox events, server cursor, conflicts, and metadata. Every key includes profile_id. Never store passwords, server cookies, guardian data, full birthdate, or raw audit logs.

- [ ] **Step 3: Implement profile encryption**

Generate a random 256-bit data key. Derive a wrapping key from a minimum six-digit local PIN with Web Crypto PBKDF2-HMAC-SHA-256, a random 16-byte salt, and 600,000 iterations. Wrap the data key and encrypt payloads with AES-256-GCM using a fresh 12-byte IV and authenticated associated data containing profile ID and schema version. Keep the unwrapped key only in memory and auto-lock after five minutes without user activity.

- [ ] **Step 4: Implement server bootstrap and 14-day lease**

Require active Teacher/Owner session. Return only assigned data and a signed lease record. Renew only after successful authenticated synchronization. Revocation invalidates the server device authorization and push subscriptions.

- [ ] **Step 5: Build profile picker, PIN unlock, auto-lock, and switching**

Switching locks the previous profile and signs out the active server session when online. If offline, record that reauthentication is required before sync. Increasing local delay follows failed PIN attempts; reset requires online login.

- [ ] **Step 6: Verify and commit**

Run: pnpm --dir apps/web test --run src/offline src/features/device-profiles && cd apps/api && php artisan test tests/Feature/Devices

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add protected offline teacher profiles"
~~~

### Task 12: Build Attendance Domain, Drafts, and Responsive Marking UI

**Files:**
- Create: apps/api/app/Models/AttendanceSession.php
- Create: apps/api/app/Models/AttendanceRecord.php
- Create: apps/api/app/Enums/AttendanceState.php
- Create: apps/api/app/Enums/AttendanceSessionStatus.php
- Create: apps/api/app/Domain/Attendance/FinalizeAttendance.php
- Create: apps/api/app/Policies/AttendancePolicy.php
- Create: apps/api/tests/Unit/Attendance/FinalizeAttendanceTest.php
- Create: apps/api/tests/Feature/Attendance/AttendanceAuthorizationTest.php
- Create: apps/web/src/features/attendance/domain.ts
- Create: apps/web/src/features/attendance/attendance-repository.ts
- Create: apps/web/src/features/attendance/AttendanceScreen.tsx
- Create: apps/web/src/features/attendance/AttendanceScreen.test.tsx

**Interfaces:**
- AttendanceState: unmarked | present | absent
- SessionStatus: draft | finalized_pending | finalized | needs_review | revised
- Produces: createDraft, markStudent, bulkMark, finalizeDraft and server attendance validation

- [ ] **Step 1: Write failing domain tests**

Test one session per church/ministry/date, assigned Teacher access, unmarked finalization rejection, all-marked success, duplicate student-record rejection, finalized Teacher edit denial, and atomic local draft/outbox save.

- [ ] **Step 2: Add attendance schema and constraints**

Use UUID, church_id, ministry_id, attendance_date, status, version, finalized_by, finalized_at, timestamps, and tombstone. Add unique church/ministry/date. Attendance records use unique session/student and the explicit state enum.

- [ ] **Step 3: Implement the server state machine**

Finalize only Draft, require all regular roster entries Present or Absent, verify assignment, preserve actor, and emit attendance.finalized audit in the same transaction.

- [ ] **Step 4: Implement local repository transactions**

markStudent and bulkMark update the draft and append one deterministic local event in one Dexie transaction. finalizeDraft verifies zero unmarked entries and stores finalized_pending.

- [ ] **Step 5: Build the attendance screen**

Include ministry/date, avatar, display name, Present/Absent controls, search, bulk mark, marked/unmarked counts, fixed Finalize bar, local-save confirmation, and text/icon connection state. Keep controls usable at phone, tablet, and desktop sizes.

- [ ] **Step 6: Verify and commit**

Run:

~~~bash
cd apps/api && php artisan test tests/Unit/Attendance tests/Feature/Attendance
pnpm --dir apps/web test --run src/features/attendance
~~~

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add offline-ready attendance workflow"
~~~

### Task 13: Implement Idempotent Push/Pull Synchronization

**Files:**
- Create: apps/api/app/Models/SyncEvent.php
- Create: apps/api/app/Models/ChangeFeedEntry.php
- Create: apps/api/app/Models/DeviceCursor.php
- Create: apps/api/app/Domain/Sync/ApplySyncBatch.php
- Create: apps/api/app/Domain/Sync/PullChanges.php
- Create: apps/api/app/Http/Controllers/SyncController.php
- Create: apps/api/tests/Feature/Sync/PushIdempotencyTest.php
- Create: apps/api/tests/Feature/Sync/PullCursorTest.php
- Create: apps/web/src/sync/outbox.ts
- Create: apps/web/src/sync/sync-client.ts
- Create: apps/web/src/sync/sync-client.test.ts

**Interfaces:**
- POST /api/sync/push with device_id, batch_id, events[]
- GET /api/sync/pull?cursor=...
- Event result: accepted | duplicate | conflict | rejected
- Client: syncProfile(profileId): Promise<SyncSummary>

- [ ] **Step 1: Write failing replay and interruption tests**

Test the same event twice returns the original acknowledgement, a batch interrupted after server commit does not duplicate on retry, another actor/device cannot claim an event, stale membership is rejected, and pull cursor returns ordered changes and tombstones.

- [ ] **Step 2: Add sync schema**

Sync event unique key is device_id plus client_event_id. Store payload hash, actor, church, result, result record/version, received_at, and correlation ID. Change feed uses monotonically increasing sequence per church plus entity UUID/version/action.

- [ ] **Step 3: Implement transactional push**

For each event: verify active session actor matches profile actor, device authorization, lease, church, assignment, payload schema, and base version. Lock the idempotency row, return prior result for exact replay, reject hash mismatch, apply domain change, write audit and change feed, then store result atomically.

- [ ] **Step 4: Implement ordered pull**

Return a bounded page after the cursor, including only authorized assigned data. When assignments change, include revocation/tombstone projections that cause the client to purge unauthorized rows. Return next_cursor and has_more.

- [ ] **Step 5: Implement the client loop**

Load only the unlocked profile. Push in stable creation order, acknowledge accepted/duplicate events, keep rejected/conflict events with reason, then pull until has_more is false. Apply pull and cursor in one Dexie transaction. Retry network/server failures with bounded exponential backoff and jitter.

- [ ] **Step 6: Verify offline/reconnect E2E and commit**

Run:

~~~bash
cd apps/api && php artisan test tests/Feature/Sync
pnpm --dir apps/web test --run src/sync
pnpm --dir apps/web playwright test e2e/offline-attendance-sync.spec.ts
~~~

Expected: one authoritative attendance outcome after retries and restart.

Commit:

~~~bash
git add apps
git commit -m "feat: add idempotent attendance synchronization"
~~~

### Task 14: Add Conflicts, Revisions, and Temporary Guests

**Files:**
- Create: apps/api/app/Models/SyncConflict.php
- Create: apps/api/app/Models/AttendanceRevision.php
- Create: apps/api/app/Models/AttendanceGuest.php
- Create: apps/api/app/Domain/Attendance/DetectAttendanceConflict.php
- Create: apps/api/app/Actions/Attendance/ResolveConflict.php
- Create: apps/api/app/Actions/Attendance/CorrectAttendance.php
- Create: apps/api/app/Actions/Guests/ResolveAttendanceGuest.php
- Create: apps/api/tests/Feature/Attendance/ConflictResolutionTest.php
- Create: apps/api/tests/Feature/Attendance/GuestResolutionTest.php
- Create: apps/web/src/features/conflicts/**
- Modify: apps/web/src/features/attendance/**

**Interfaces:**
- Produces: conflict list/show/resolve; attendance correction; guest promote/link/merge endpoints
- Guarantees: original attendance value and actor remain immutable

- [ ] **Step 1: Write failing conflict and guest tests**

Test identical values deduplicate, non-overlapping records merge, Present versus Absent creates Needs Review, Teacher cannot resolve, Owner resolution creates revision, and guest promotion links the attendance record without losing the local actor/time.

- [ ] **Step 2: Implement conflict classification**

Detect conflicts using entity ID, base version, field, existing value, incoming value, and finalization state. Store both value projections, actors, devices, correlation IDs, and status without raw request bodies.

- [ ] **Step 3: Implement immutable resolution and correction**

Owner chooses existing or incoming attendance value and supplies a bounded reason. Create AttendanceRevision with before, after, original actor, resolving actor, reason, and UTC time. Increment session version and write audit atomically.

- [ ] **Step 4: Implement temporary guest lifecycle**

Offline guest payload permits display_name and optional gender only. Server creates Pending guest scoped to the session. Owner may promote to a new Student, link to an existing Student, or merge a duplicate; preserve attendance provenance and write audit.

- [ ] **Step 5: Build Owner review screens**

Show side-by-side values, actors, device/local/server times, safe reason, and final action. Teachers see only Needs Owner Review status and cannot inspect unrelated teacher security details.

- [ ] **Step 6: Verify and commit**

Run: cd apps/api && php artisan test --filter='Conflict|Guest|Revision' && pnpm --dir apps/web test --run src/features/conflicts src/features/attendance

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: preserve attendance conflicts and revisions"
~~~

### Task 15: Add Attendance History, Reports, and Safe CSV Export

**Files:**
- Create: apps/api/app/Domain/Reports/AttendanceSummary.php
- Create: apps/api/app/Http/Controllers/AttendanceReportController.php
- Create: apps/api/app/Http/Resources/AttendanceReportResource.php
- Create: apps/api/tests/Feature/Reports/AttendanceReportTest.php
- Create: apps/web/src/features/reports/**
- Create: apps/web/src/features/history/**

**Interfaces:**
- Produces: date/ministry-filtered sessions, present/absent totals, rate, pending count, conflict count, corrections, safe CSV export

- [ ] **Step 1: Write failing report authorization and arithmetic tests**

Test attendance rate equals present divided by finalized resolved records, revisions affect current totals while preserving history, pending local-only work is not counted as finalized server attendance, Teacher sees assigned recent sessions only, and CSV cells cannot execute formulas.

- [ ] **Step 2: Implement query services**

Use indexed PostgreSQL queries scoped by church and policy. Keep report aggregation separate from mutable attendance commands. Return integer counts and a decimal rate rounded only at presentation.

- [ ] **Step 3: Implement safe export**

Export UTF-8 CSV with explicit headers and ISO dates. Prefix text values beginning with =, +, -, or @ with a single quote and quote CSV fields correctly. Audit export actor, filters, result count, and correlation ID without copying rows into logs.

- [ ] **Step 4: Build reports and history UI**

Provide date/ministry filters, summary totals, finalized sessions, pending/conflict/correction links, responsive tables/cards, and download action. No advanced analytics or child birthdate export is included.

- [ ] **Step 5: Verify and commit**

Run: cd apps/api && php artisan test tests/Feature/Reports && pnpm --dir apps/web test --run src/features/reports src/features/history

Expected: PASS.

Commit:

~~~bash
git add apps
git commit -m "feat: add basic attendance reports"
~~~

### Task 16: Add 8:00 AM Privacy-Safe Birthday Notifications

**Files:**
- Create: apps/api/app/Models/PushSubscription.php
- Create: apps/api/app/Models/BirthdayNotificationDelivery.php
- Create: apps/api/app/Domain/Notifications/FindBirthdayRecipients.php
- Create: apps/api/app/Jobs/DispatchBirthdayNotifications.php
- Create: apps/api/app/Jobs/SendBirthdayPush.php
- Create: apps/api/app/Console/Commands/DispatchDueBirthdayNotifications.php
- Modify: apps/api/routes/console.php
- Create: apps/api/tests/Unit/Notifications/BirthdaySelectionTest.php
- Create: apps/api/tests/Feature/Notifications/BirthdayDispatchTest.php
- Modify: apps/web/src/pwa/service-worker.ts
- Create: apps/web/src/features/birthdays/**
- Create: apps/web/src/features/notifications/**

**Interfaces:**
- Produces: subscription register/revoke endpoints; due-birthday command; Today's Birthdays projection
- Delivery unique key: church_id, local_date, user_id, device_id

- [ ] **Step 1: Write failing timezone, privacy, and assignment tests**

Test Asia/Manila 8:00 dispatch, another timezone not yet due, Teacher receives assigned ministry only, Owner receives church-wide count, revoked assignment receives nothing, February 29 maps to February 28 in a non-leap year, duplicate scheduler runs create one delivery, and push payload contains no names or birthdates.

- [ ] **Step 2: Add Web Push subscription lifecycle**

Store endpoint hash, encrypted endpoint/key material, user, device, permission state, last success, failure count, and revoked_at. Never log endpoint or key values. Revoke on user request, membership revocation, or permanent push failure.

- [ ] **Step 3: Implement due-church scheduler**

Run the command every minute. Select churches whose timezone-local hour/minute is 08:00 and whose local date lacks a dispatch marker. Queue recipient jobs with unique locks so worker retries cannot duplicate a notification.

- [ ] **Step 4: Send generic notification and in-app fallback**

Push title: Birthday reminder. Body: N children are celebrating today. Open the app to view. Notification click opens the authenticated birthday route. The in-app card queries authorized names and appears even if permission is denied or push is delayed.

- [ ] **Step 5: Implement deliberate permission UX**

Show Enable Birthday Notifications only after sign-in and user interaction. Detect unsupported environments. On iPhone/iPad explain that Web Push requires the Home Screen app. Never repeatedly prompt after denial.

- [ ] **Step 6: Verify and commit**

Run:

~~~bash
cd apps/api && php artisan test --filter=Birthday
pnpm --dir apps/web test --run src/features/birthdays src/features/notifications src/pwa
~~~

Expected: correct recipients, one generic delivery, and in-app fallback.

Commit:

~~~bash
git add apps
git commit -m "feat: add private birthday reminders"
~~~

### Task 17: Add Operations, Retention, Deployment, and Security Hardening

**Files:**
- Create: apps/api/app/Http/Controllers/Platform/SystemHealthController.php
- Create: apps/api/app/Console/Commands/CheckSchedulerHeartbeat.php
- Create: apps/api/app/Jobs/PruneOperationalData.php
- Create: apps/api/app/Jobs/PurgeRevokedDeviceData.php
- Create: apps/api/routes/health.php
- Create: apps/api/tests/Feature/Operations/SystemHealthTest.php
- Create: apps/api/tests/Feature/Operations/RetentionTest.php
- Create: apps/web/src/features/platform/system-health/**
- Create: apps/web/vercel.json
- Create: apps/api/Dockerfile
- Create: apps/api/railway.json
- Create: docs/operations/deployment.md
- Create: docs/operations/backup-restore.md
- Create: docs/security/threat-model.md
- Create: SECURITY.md

**Interfaces:**
- Produces: public liveness without secrets; protected readiness; sanitized sage.dev health dashboard; scheduled retention jobs

- [ ] **Step 1: Write failing health, retention, and redaction tests**

Test public health reveals only status, platform health requires platform auth, health contains no tenant/child data, technical logs prune at 30 days, security events at 180 days, sync receipts at 180 days, rejected application PII at 30 days, and active audit events remain.

- [ ] **Step 2: Implement sanitized health and heartbeats**

Track API readiness, database connectivity, queue lag, failed jobs, scheduler last run, birthday last dispatch, sync error/conflict rate, and storage growth. Return statuses and aggregate counts only.

- [ ] **Step 3: Implement retention jobs**

Use chunked deletes with explicit cutoffs and audit the job summary. Prune change feed only after active cursors pass and the 90-day window expires. Mark expired devices for full resync. Never delete tenant audit events through this job.

- [ ] **Step 4: Add deployment configuration**

Vercel serves apps/web and rewrites /api/:path* to the Railway Laravel URL. Laravel container runs PHP 8.3+, health checks, config/route/view cache, and separate API and worker commands from one image. Production uses distinct runtime and migration DB credentials.

- [ ] **Step 5: Write operations and security documentation**

Document environment variables by name without values, bootstrap/removal of sage.dev setup secret, key rotation, backup schedule, restore drill, incident correlation IDs, device revocation, log retention, CSP, rate limits, RLS runtime role, and rollback steps.

- [ ] **Step 6: Run security gates and commit**

Run:

~~~bash
pnpm verify
cd apps/api && composer audit && php artisan test
pnpm audit --audit-level high
gitleaks detect --no-banner
semgrep scan --config p/owasp-top-ten apps
~~~

Expected: no high/critical dependency issue, no secret, all tests pass, and only reviewed Semgrep findings remain.

Commit:

~~~bash
git add .
git commit -m "chore: harden operations and production deployment"
~~~

### Task 18: Qualify the MVP and Run the One-Church Pilot

**Files:**
- Create: apps/web/e2e/church-onboarding.spec.ts
- Create: apps/web/e2e/shared-device.spec.ts
- Create: apps/web/e2e/offline-restart-sync.spec.ts
- Create: apps/web/e2e/conflict-review.spec.ts
- Create: apps/web/e2e/student-import.spec.ts
- Create: apps/web/e2e/birthday-reminder.spec.ts
- Create: apps/web/e2e/tenant-isolation.spec.ts
- Create: docs/qa/browser-matrix.md
- Create: docs/qa/pilot-runbook.md
- Create: docs/qa/release-checklist.md

**Interfaces:**
- Consumes: all prior tasks
- Produces: signed pilot evidence for every acceptance criterion and a go/no-go release decision

- [ ] **Step 1: Write end-to-end acceptance scenarios**

Cover registration, email verification, pending state, sage.dev approval, Owner MFA, ministry/student setup, teacher invite/assignment, PWA installation, roster download, shared PIN profiles, deliberate offline attendance, browser close/reopen, reconnect, exactly-once sync, conflict review, correction, import preview/commit, reports, birthday fallback/push, revocation, and cross-tenant denial.

- [ ] **Step 2: Run automated browser and accessibility matrix**

Run Playwright Chromium desktop/mobile, WebKit phone/tablet, keyboard-only navigation, reduced motion, axe scans, offline toggles, service-worker update, storage-quota simulation, API outage, and worker retry scenarios.

Expected: zero critical/serious accessibility issue and no lost/duplicated attendance.

- [ ] **Step 3: Run backup and recovery drill**

Create a production-like encrypted PostgreSQL backup, restore into an isolated database, verify counts and checksums for churches, memberships, students, finalized attendance, revisions, audit events, and sync receipts, then destroy the isolated restore environment.

- [ ] **Step 4: Run the four-attendance-day pilot**

Use one approved church, at least two Teachers, and multiple profiles on one device. Include one intentionally offline day and one deliberate conflicting submission. Record sync time, pending events, errors, corrections, notification behavior, and user feedback without copying child PII into the runbook.

- [ ] **Step 5: Enforce the release checklist**

Release only if all twelve acceptance criteria in the design spec pass, no high/critical security finding remains, backup restore succeeds, queue/scheduler heartbeat is healthy, support contacts and incident steps exist, and the Owner confirms reports match manual counts.

- [ ] **Step 6: Commit pilot evidence template**

~~~bash
git add apps/web/e2e docs/qa
git commit -m "test: add mvp release qualification"
~~~

---

## MVP Completion Boundary

The MVP is complete when Tasks 1–18 and the one-church pilot pass. It is not necessary to add points, rewards, Market Day, photos, guardian contacts, messages, subscriptions, native mobile binaries, or advanced analytics before launch.

## Execution Recommendation

Execute one task at a time with a fresh review gate. Tasks 1–7 establish the security boundary and must be reviewed before any child data is introduced. Tasks 10–14 contain the highest offline/sync risk and should receive explicit domain and security review before reports or notifications are added.
