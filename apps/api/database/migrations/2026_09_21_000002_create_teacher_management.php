<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $schema = Schema::connection($this->getConnection());
        $db = DB::connection($this->getConnection());
        $role = config('database.runtime_role');
        if (! is_string($role) || ! preg_match('/\A[a-z_][a-z0-9_]*\z/', $role)) {
            throw new RuntimeException('Invalid runtime role.');
        }
        $schema->table('church_memberships', fn (Blueprint $t) => $t->unique(['church_id', 'id']));
        $schema->create('ministries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('church_id')->constrained();
            $t->string('name', 120);
            $t->timestampTz('archived_at')->nullable();
            $t->timestampsTz();
            $t->unique(['church_id', 'id']);
        });
        $schema->create('invitations', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('church_id')->constrained();
            $t->string('email', 254);
            $t->string('role', 16)->default('teacher');
            $t->char('token_hash', 64)->unique();
            $t->timestampTz('expires_at');
            $t->timestampTz('accepted_at')->nullable();
            $t->timestampTz('revoked_at')->nullable();
            $t->foreignId('inviter_id')->constrained('users');
            $t->timestampsTz();
            $t->unique(['church_id', 'id']);
            $t->index(['church_id', 'email']);
        });
        $db->statement("ALTER TABLE invitations ADD CHECK (role = 'teacher'), ADD CHECK (email = lower(trim(email)))");
        $schema->create('invitation_ministries', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('church_id');
            $t->uuid('invitation_id');
            $t->uuid('ministry_id');
            $t->foreign(['church_id', 'invitation_id'])->references(['church_id', 'id'])->on('invitations');
            $t->foreign(['church_id', 'ministry_id'])->references(['church_id', 'id'])->on('ministries');
            $t->unique(['invitation_id', 'ministry_id']);
        });
        $schema->create('teacher_ministry_assignments', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->uuid('church_id');
            $t->uuid('membership_id');
            $t->uuid('ministry_id');
            $t->foreignId('assigned_by')->constrained('users');
            $t->timestampTz('revoked_at')->nullable();
            $t->timestampsTz();
            $t->foreign(['church_id', 'membership_id'])->references(['church_id', 'id'])->on('church_memberships');
            $t->foreign(['church_id', 'ministry_id'])->references(['church_id', 'id'])->on('ministries');
            $t->unique(['membership_id', 'ministry_id']);
        });
        // Only revocation storage is introduced here. Provisioning and synchronization belong to later tasks.
        foreach (['offline_authorizations', 'push_subscriptions'] as $table) {
            $schema->create($table, function (Blueprint $t) {
                $t->uuid('id')->primary();
                $t->uuid('church_id');
                $t->uuid('membership_id');
                $t->uuid('device_id');
                $t->timestampTz('expires_at');
                $t->timestampTz('revoked_at')->nullable();
                $t->foreign(['church_id', 'membership_id'])->references(['church_id', 'id'])->on('church_memberships');
                $t->unique(['membership_id', 'device_id']);
            });
        }
        $schema->create('membership_audits', function (Blueprint $t) {
            $t->uuid('id')->primary();
            $t->foreignUuid('church_id')->constrained();
            $t->foreignId('actor_id')->constrained('users');
            $t->string('action', 64);
            $t->uuid('target_id');
            $t->uuid('previous_owner_id')->nullable();
            $t->string('risk', 16)->default('normal');
            $t->string('result', 16)->default('success');
            $t->uuid('correlation_id');
            $t->timestampTz('occurred_at');
        });
        foreach (['ministries', 'invitations', 'invitation_ministries', 'teacher_ministry_assignments', 'offline_authorizations', 'push_subscriptions', 'membership_audits'] as $table) {
            $db->unprepared("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;
                ALTER TABLE {$table} FORCE ROW LEVEL SECURITY;
                CREATE POLICY {$table}_tenant ON {$table}
                USING (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid)
                WITH CHECK (church_id = NULLIF(current_setting('app.current_church_id', true), '')::uuid);
                REVOKE ALL ON {$table} FROM PUBLIC;
                GRANT SELECT, INSERT ON {$table} TO \"{$role}\";");
            if ($table !== 'membership_audits') {
                $db->unprepared("GRANT UPDATE, DELETE ON {$table} TO \"{$role}\"");
            }
        }
    }

    public function down(): void
    {
        $schema = Schema::connection($this->getConnection());
        foreach (['membership_audits', 'push_subscriptions', 'offline_authorizations', 'teacher_ministry_assignments', 'invitation_ministries', 'invitations', 'ministries'] as $table) {
            $schema->dropIfExists($table);
        }
        $schema->table('church_memberships', fn (Blueprint $t) => $t->dropUnique(['church_id', 'id']));
    }
};
