<?php

use App\Domain\Notifications\FindBirthdayRecipients;
use App\Jobs\DispatchBirthdayNotifications;
use App\Jobs\SendBirthdayPush;
use App\Models\PushSubscription;
use App\Models\User;
use App\Support\Notifications\PushSender;
use App\Support\Notifications\PushSendResult;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function (): void {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church, $this->ownerMembership] = MembershipScenario::owner($this);
    $this->ministry = MembershipScenario::ministry($this->church->id);
});

function birthdayStudent(object $test, string $name, string $birthdate, ?string $ministry = null): string
{
    $id = (string) Str::uuid();
    $db = DB::connection('pgsql_migration');
    $db->table('students')->insert([
        'id' => $id, 'church_id' => $test->church->id, 'first_name' => $name,
        'last_name' => 'Child', 'date_of_birth' => $birthdate, 'gender' => 'unspecified',
        'version' => 1, 'created_at' => now(), 'updated_at' => now(),
    ]);
    if ($ministry !== null) {
        $db->table('enrollments')->insert([
            'id' => (string) Str::uuid(), 'church_id' => $test->church->id,
            'student_id' => $id, 'ministry_id' => $ministry, 'version' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);
    }

    return $id;
}

function birthdaySubscription(object $test, string $membershipId, int $userId, string $deviceId): void
{
    $endpoint = 'https://fcm.googleapis.com/fcm/send/'.$deviceId;
    DB::connection('pgsql_migration')->table('push_subscriptions')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $test->church->id,
        'membership_id' => $membershipId, 'user_id' => $userId, 'device_id' => $deviceId,
        'endpoint_hash' => hash('sha256', $endpoint),
        'endpoint_ciphertext' => Crypt::encryptString($endpoint),
        'p256dh_ciphertext' => Crypt::encryptString('public-key'),
        'auth_ciphertext' => Crypt::encryptString('auth-secret'),
        'content_encoding' => 'aes128gcm', 'permission_state' => 'granted',
        'failure_count' => 0, 'created_at' => now(), 'updated_at' => now(),
    ]);
}

it('returns church-wide Owner birthdays and assignment-scoped Teacher birthdays without full dates', function (): void {
    CarbonImmutable::setTestNow('2026-09-29 00:00:00 UTC');
    $assigned = birthdayStudent($this, 'Assigned', '2018-09-29', $this->ministry);
    $otherMinistry = MembershipScenario::ministry($this->church->id);
    birthdayStudent($this, 'Hidden', '2017-09-29', $otherMinistry);
    birthdayStudent($this, 'Tomorrow', '2019-09-30', $this->ministry);

    $this->getJson('/api/birthdays/today')->assertOk()
        ->assertJsonPath('data.count', 2)
        ->assertJsonPath('data.birthdays.0.id', $assigned)
        ->assertJsonMissingPath('data.birthdays.0.date_of_birth')
        ->assertJsonMissingPath('data.birthdays.0.birth_year');

    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $membership->id, 'ministry_id' => $this->ministry,
        'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withHeader('X-Church-Id', $this->church->id)
        ->withSession(['password_hash_web' => $teacher->getAuthPassword()]);

    $this->getJson('/api/birthdays/today')->assertOk()
        ->assertJsonPath('data.role', 'teacher')
        ->assertJsonPath('data.count', 1)
        ->assertJsonPath('data.birthdays.0.display_name', 'Assigned Child')
        ->assertJsonMissing(['Hidden Child', '2018-09-29']);
});

it('registers and revokes encrypted device subscriptions without retaining plaintext key material', function (): void {
    config(['services.webpush.public_key' => 'public-vapid-key']);
    $device = (string) Str::uuid();
    $endpoint = 'https://fcm.googleapis.com/fcm/send/private-token';

    $this->postJson('/api/push-subscriptions', [
        'device_id' => $device,
        'permission' => 'granted',
        'subscription' => [
            'endpoint' => $endpoint,
            'expirationTime' => null,
            'keys' => ['p256dh' => 'browser-public-key', 'auth' => 'browser-auth-secret'],
        ],
    ])->assertCreated()->assertJsonPath('device_id', $device);

    $stored = DB::connection('pgsql_migration')->table('push_subscriptions')->where('device_id', $device)->first();
    expect($stored->endpoint_hash)->toBe(hash('sha256', $endpoint))
        ->and($stored->endpoint_ciphertext)->not->toContain('private-token')
        ->and($stored->p256dh_ciphertext)->not->toBe('browser-public-key')
        ->and($stored->auth_ciphertext)->not->toBe('browser-auth-secret')
        ->and(Crypt::decryptString($stored->endpoint_ciphertext))->toBe($endpoint);

    $this->postJson('/api/push-subscriptions', [
        'device_id' => (string) Str::uuid(), 'permission' => 'granted',
        'subscription' => [
            'endpoint' => 'https://127.0.0.1/internal', 'expirationTime' => null,
            'keys' => ['p256dh' => 'browser-public-key', 'auth' => 'browser-auth-secret'],
        ],
    ])->assertUnprocessable();

    $this->deleteJson('/api/push-subscriptions/'.$device)->assertNoContent();
    expect(DB::connection('pgsql_migration')->table('push_subscriptions')->where('device_id', $device)->value('revoked_at'))->not->toBeNull();
});

it('dispatches only churches at local 08:00 and creates one recipient delivery across duplicate scheduler runs', function (): void {
    Queue::fake();
    CarbonImmutable::setTestNow('2026-09-29 00:00:00 UTC');
    birthdayStudent($this, 'Birthday', '2016-09-29', $this->ministry);
    $device = (string) Str::uuid();
    birthdaySubscription($this, $this->ownerMembership->id, $this->owner->id, $device);
    [, $otherChurch] = ChurchScenario::owner();
    DB::connection('pgsql_migration')->table('churches')->where('id', $otherChurch->id)->update(['timezone' => 'America/New_York']);

    Artisan::call('birthdays:dispatch-due');
    Artisan::call('birthdays:dispatch-due');

    Queue::assertPushed(DispatchBirthdayNotifications::class, 1);
    $dispatch = Queue::pushed(DispatchBirthdayNotifications::class)->first();
    expect($dispatch->churchId)->toBe($this->church->id)
        ->and($dispatch->localDate)->toBe('2026-09-29')
        ->and(DB::connection('pgsql_migration')->table('birthday_notification_dispatches')->count())->toBe(1);

    Queue::fake();
    $dispatch->handle(app(TenantContext::class), app(FindBirthdayRecipients::class));
    $dispatch->handle(app(TenantContext::class), app(FindBirthdayRecipients::class));
    Queue::assertPushed(SendBirthdayPush::class, 1);
    expect(DB::connection('pgsql_migration')->table('birthday_notification_deliveries')->count())->toBe(1);
});

it('excludes revoked assignments and emits a generic name-free push payload', function (): void {
    CarbonImmutable::setTestNow('2026-09-29 00:00:00 UTC');
    birthdayStudent($this, 'Private Name', '2014-09-29', $this->ministry);
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $membership->id, 'ministry_id' => $this->ministry,
        'assigned_by' => $this->owner->id, 'revoked_at' => now(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    birthdaySubscription($this, $membership->id, $teacher->id, (string) Str::uuid());

    $recipients = app(TenantContext::class)->run(
        $this->church->id,
        fn () => app(FindBirthdayRecipients::class)->recipients($this->church->id, CarbonImmutable::parse('2026-09-29')),
    );
    $payload = SendBirthdayPush::payload(2);

    expect($recipients)->toBeEmpty()
        ->and($payload)->toMatchArray([
            'title' => 'Birthday reminder',
            'body' => '2 children are celebrating today. Open the app to view.',
            'url' => '/account/birthdays',
        ])
        ->and(json_encode($payload))->not->toContain('Private Name')
        ->and(json_encode($payload))->not->toContain('2014-09-29');
});

it('revokes a subscription after a permanent push-service failure without recording endpoint details', function (): void {
    Queue::fake();
    CarbonImmutable::setTestNow('2026-09-29 00:00:00 UTC');
    birthdayStudent($this, 'Private Name', '2014-09-29', $this->ministry);
    $device = (string) Str::uuid();
    birthdaySubscription($this, $this->ownerMembership->id, $this->owner->id, $device);
    $dispatch = new DispatchBirthdayNotifications($this->church->id, '2026-09-29');
    $dispatch->handle(app(TenantContext::class), app(FindBirthdayRecipients::class));
    $send = Queue::pushed(SendBirthdayPush::class)->first();
    $sender = new class implements PushSender
    {
        public function send(PushSubscription $subscription, array $payload): PushSendResult
        {
            expect(json_encode($payload))->not->toContain('Private Name')
                ->and($subscription->toJson())->not->toContain('fcm.googleapis.com');

            return new PushSendResult(false, true, 'expired');
        }
    };

    $send->handle(app(TenantContext::class), $sender, app(FindBirthdayRecipients::class));

    $delivery = DB::connection('pgsql_migration')->table('birthday_notification_deliveries')->first();
    $subscription = DB::connection('pgsql_migration')->table('push_subscriptions')->where('device_id', $device)->first();
    expect($delivery->status)->toBe('revoked')
        ->and($delivery->failure_category)->toBe('expired')
        ->and($subscription->failure_count)->toBe(1)
        ->and($subscription->revoked_at)->not->toBeNull();
});

it('rechecks Teacher assignment before a queued delivery sends', function (): void {
    Queue::fake();
    CarbonImmutable::setTestNow('2026-09-29 00:00:00 UTC');
    birthdayStudent($this, 'Assigned Name', '2014-09-29', $this->ministry);
    [$teacher, $membership] = ChurchScenario::teacher($this->church);
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $this->church->id,
        'membership_id' => $membership->id, 'ministry_id' => $this->ministry,
        'assigned_by' => $this->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]);
    birthdaySubscription($this, $membership->id, $teacher->id, (string) Str::uuid());
    (new DispatchBirthdayNotifications($this->church->id, '2026-09-29'))
        ->handle(app(TenantContext::class), app(FindBirthdayRecipients::class));
    $send = Queue::pushed(SendBirthdayPush::class)->first();
    DB::connection('pgsql_migration')->table('teacher_ministry_assignments')
        ->where('membership_id', $membership->id)->update(['revoked_at' => now()]);
    $sender = new class implements PushSender
    {
        public function send(PushSubscription $subscription, array $payload): PushSendResult
        {
            throw new RuntimeException('Sender must not run after assignment revocation.');
        }
    };

    $send->handle(app(TenantContext::class), $sender, app(FindBirthdayRecipients::class));

    expect(DB::connection('pgsql_migration')->table('birthday_notification_deliveries')->value('status'))->toBe('revoked');
});

it('keeps birthday deliveries isolated by forced PostgreSQL tenant policy', function (): void {
    [, $foreignChurch, $foreignMembership] = ChurchScenario::owner();
    $foreignSubscription = (string) Str::uuid();
    $foreignDevice = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('push_subscriptions')->insert([
        'id' => $foreignSubscription, 'church_id' => $foreignChurch->id,
        'membership_id' => $foreignMembership->id, 'user_id' => $foreignMembership->user_id,
        'device_id' => $foreignDevice, 'endpoint_hash' => hash('sha256', 'https://fcm.googleapis.com/fcm/send/foreign'),
        'endpoint_ciphertext' => Crypt::encryptString('https://fcm.googleapis.com/fcm/send/foreign'),
        'p256dh_ciphertext' => Crypt::encryptString('public-key'),
        'auth_ciphertext' => Crypt::encryptString('auth-secret'),
        'permission_state' => 'granted', 'failure_count' => 0, 'created_at' => now(), 'updated_at' => now(),
    ]);
    DB::connection('pgsql_migration')->table('birthday_notification_deliveries')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $foreignChurch->id, 'local_date' => '2026-09-29',
        'user_id' => $foreignMembership->user_id, 'membership_id' => $foreignMembership->id,
        'device_id' => $foreignDevice, 'push_subscription_id' => $foreignSubscription,
        'birthday_count' => 1, 'status' => 'pending', 'attempt_count' => 0,
        'created_at' => now(), 'updated_at' => now(),
    ]);

    expect(DB::table('birthday_notification_deliveries')->count())->toBe(0)
        ->and(app(TenantContext::class)->run(
            $this->church->id,
            fn (): int => DB::table('birthday_notification_deliveries')->count(),
        ))->toBe(0);

    $this->withHeader('X-Church-Id', $foreignChurch->id)->getJson('/api/birthdays/today')->assertForbidden();
});
