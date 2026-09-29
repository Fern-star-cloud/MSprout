# Backup and restore

PostgreSQL is authoritative for acknowledged data. Backups must be encrypted in transit and at rest, stored outside the application account, access-logged, and restricted to named operators. Unsynchronized IndexedDB work is intentionally absent from server backups and must never be exported from shared devices as a substitute.

## Schedule and retention

- Enable Railway/PostgreSQL managed continuous recovery or an equivalent encrypted point-in-time mechanism.
- Take a daily logical backup with `pg_dump --format=custom` using a dedicated read-only backup identity that can read every required table under an approved backup procedure. Keep daily copies for 14 days and weekly copies for 8 weeks unless a later approved policy supersedes this.
- Back up deployment configuration and encryption-key versions separately in the secret manager. Never place secrets inside the database dump, repository, or verification report.
- Monitor backup age, completion, size trend, encryption status, and off-account replication. A missed daily backup is an incident.

## Restore drill

Task 18 performs the required production-like drill. Use an isolated PostgreSQL 18 database with no public route and distinct credentials.

1. Select an encrypted backup and record only its timestamp, opaque storage identifier, and checksum.
2. Restore with the migration identity into the isolated database. Do not connect Vercel, workers, scheduler, mail, Web Push, or production secrets.
3. Apply only migrations that belong to the candidate release. Never run destructive schema reversal.
4. Compare aggregate counts and deterministic checksums for churches, memberships, students, finalized attendance, attendance revisions, audit events, security events, sync receipts, and change feed. Do not include row data or child identifiers in evidence.
5. Verify the runtime role cannot bypass RLS, cannot mutate audit/security evidence directly, and cannot delete retention-controlled tables. Exercise same-tenant success and cross-tenant denial.
6. Verify the public liveness shape, protected readiness, queue/scheduler heartbeat, and sanitized system-health response against the isolated database.
7. Destroy the isolated restore database and temporary decrypted dump using the provider's recoverable deletion workflow; retain only the non-sensitive drill result, timestamps, counts/checksums, and correlation ID.

## Recovery decisions

Prefer point-in-time recovery for accidental writes or deletion. Restore into isolation first, determine the last consistent transaction, and obtain explicit authorization before replacing production data. Preserve current production snapshots and immutable audit evidence before cutover. When only a bounded record set is affected, use a reviewed forward repair transaction with audit evidence instead of a whole-database replacement.
