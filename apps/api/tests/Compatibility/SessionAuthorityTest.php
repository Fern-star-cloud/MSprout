<?php

use App\Models\User;
use App\Support\Auth\AuthenticatedSessionWritePermit;
use App\Support\Auth\DatabaseSessionAuthority;
use App\Support\Auth\GuardAwareDatabaseSessionHandler;
use App\Support\Auth\UserAuthorityLocks;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Support\AuthorityScenario;
use Tests\Support\PostgresTestDatabase;
use Tests\TestCase;

uses(TestCase::class);
beforeEach(function (): void {
    AuthorityScenario::guard();
    PostgresTestDatabase::refresh();
    config(['session.driver' => 'database', 'session.connection' => 'pgsql', 'session.encrypt' => false]);
    $this->actor = User::factory()->create();
    Auth::guard('web')->setUser($this->actor);
    $this->key = Auth::guard('web')->getName();
    $this->id = Str::random(40);
    $this->payload = json_encode([$this->key => $this->actor->id, 'church_mfa_user_id' => $this->actor->id]);
    DB::table('sessions')->insert([
        'id' => $this->id, 'user_id' => $this->actor->id,
        'payload' => base64_encode($this->payload), 'last_activity' => time(),
    ]);
    $this->handler = new GuardAwareDatabaseSessionHandler(DB::connection(), 'sessions', 120, app());
});

it('does not recreate revoked authentication when a delayed request regenerates its session', function (): void {
    expect($this->handler->read($this->id))->toBe($this->payload);
    DB::table('sessions')->where('id', $this->id)->delete();
    $this->handler->setExists(false);
    $new = Str::random(40);
    $this->handler->write($new, $this->payload);
    expect(DB::table('sessions')->where('user_id', $this->actor->id)->count())->toBe(0);
});

it('does not restore MFA assurance removed from the authoritative session by another request', function (): void {
    $this->handler->read($this->id);
    DB::table('sessions')->where('id', $this->id)->update([
        'payload' => base64_encode(json_encode([$this->key => $this->actor->id])),
    ]);
    $this->handler->write($this->id, $this->payload);
    $stored = json_decode(base64_decode(DB::table('sessions')->where('id', $this->id)->value('payload')), true);
    expect($stored)->not->toHaveKey('church_mfa_user_id');
});

it('retains a live authenticated session and ordinary non-security data', function (): void {
    $this->handler->read($this->id);
    $this->handler->write($this->id, json_encode([$this->key => $this->actor->id, 'church_mfa_user_id' => $this->actor->id, 'ordinary' => 'kept']));
    $stored = json_decode(base64_decode(DB::table('sessions')->where('id', $this->id)->value('payload')), true);
    expect($stored[$this->key])->toBe($this->actor->id)->and($stored['ordinary'])->toBe('kept');
});

it('lets a protected session operation finish before a waiting revocation can commit', function (): void {
    $reader = AuthorityScenario::worker(['mode' => 'hold', 'actor' => $this->actor->id, 'session' => $this->id]);
    fwrite($reader[1][0], "enter\n");
    expect(AuthorityScenario::line($reader[1][1])['phase'])->toBe('authorized');
    $delete = AuthorityScenario::worker(['mode' => 'delete', 'actor' => $this->actor->id, 'session' => $this->id]);
    fwrite($delete[1][0], "enter\n");
    AuthorityScenario::blocked($reader[2]['pid'], $delete[2]['pid']);
    expect(DB::table('sessions')->where('id', $this->id)->exists())->toBeTrue();
    fwrite($reader[1][0], "commit\n");
    expect(AuthorityScenario::line($reader[1][1])['phase'])->toBe('committed');
    expect(AuthorityScenario::line($delete[1][1])['phase'])->toBe('deleted');
    fwrite($delete[1][0], "commit\n");
    expect(AuthorityScenario::line($delete[1][1])['phase'])->toBe('committed');
    AuthorityScenario::close($reader);
    AuthorityScenario::close($delete);
    expect(DB::table('sessions')->where('id', $this->id)->exists())->toBeFalse();
});

it('refuses a pending session operation when revocation wins the User and session boundary', function (): void {
    $delete = AuthorityScenario::worker(['mode' => 'delete', 'actor' => $this->actor->id, 'session' => $this->id]);
    fwrite($delete[1][0], "enter\n");
    expect(AuthorityScenario::line($delete[1][1])['phase'])->toBe('deleted');
    $reader = AuthorityScenario::worker(['mode' => 'hold', 'actor' => $this->actor->id, 'session' => $this->id]);
    fwrite($reader[1][0], "enter\n");
    AuthorityScenario::blocked($delete[2]['pid'], $reader[2]['pid']);
    fwrite($delete[1][0], "commit\n");
    expect(AuthorityScenario::line($delete[1][1])['phase'])->toBe('committed');
    expect(AuthorityScenario::line($reader[1][1])['phase'])->toBe('denied');
    AuthorityScenario::close($delete);
    AuthorityScenario::close($reader);
    expect(DB::table('sessions')->where('id', $this->id)->exists())->toBeFalse();
});

it('does not let an ordinary response permit recreate a subsequently deleted authenticated session', function (): void {
    $request = app('request');
    $store = app('session')->driver();
    $store->setId($this->id);
    $store->start();
    $request->setLaravelSession($store);
    AuthenticatedSessionWritePermit::issue($request, $this->actor);
    DB::table('sessions')->where('id', $this->id)->delete();
    $this->handler->setExists(false);
    $this->handler->write($this->id, $this->payload);
    expect(DB::table('sessions')->where('id', $this->id)->exists())->toBeFalse();
});

it('accepts only the current supported raw or HMAC password proof', function (string $kind, bool $valid): void {
    $proof = match ($kind) {
        'raw' => $this->actor->password,
        'hmac' => Auth::guard('web')->hashPasswordForCookie($this->actor->password),
        'mismatched' => Auth::guard('web')->hashPasswordForCookie(User::factory()->create(['password' => Str::password(32)])->password),
        'invalid' => Str::random(40),
    };
    $claims = [$this->key => $this->actor->id, 'password_hash_web' => $proof];
    DB::table('sessions')->where('id', $this->id)->update(['payload' => base64_encode(json_encode($claims))]);
    $store = app('session')->driver();
    $store->setId($this->id);
    $store->replace($claims);
    $request = Request::create('http://localhost/auth/session');
    $request->setLaravelSession($store);
    $operation = fn () => app(UserAuthorityLocks::class)->run([$this->actor->id => 'read'], fn () => app(DatabaseSessionAuthority::class)->validate($request, $this->actor));
    if ($valid) {
        expect($operation()[$this->key])->toBe($this->actor->id);
    } else {
        expect($operation)->toThrow(AuthenticationException::class);
    }
})->with([['raw', true], ['hmac', true], ['mismatched', false], ['invalid', false]]);
