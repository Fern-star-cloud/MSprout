<?php

use App\Logging\RedactContext;
use Monolog\Level;
use Monolog\LogRecord;

it('redacts entire sensitive containers and naming variants recursively', function () {
    $keys = ['password', 'PasswordConfirmation', 'access-token', 'AUTHORIZATION', 'Set.Cookie', 'child', 'children', 'childName', 'date_of_birth', 'GuardianDetails', 'request.body', 'pushEndpoint', 'recovery_codes', 'mfaCode', 'invitationProof', 'email'];
    foreach ($keys as $key) {
        expect(RedactContext::apply(['outer' => [[$key => ['name' => 'private-marker', 'value' => 'private-marker']]]]))
            ->toBe(['outer' => [[$key => '[REDACTED]']]]);
    }
    expect(RedactContext::apply(['count' => 2, 'object' => (object) ['PASSWORD' => 'private-marker'], 'exception' => new RuntimeException('private-marker')]))
        ->toBe(['count' => 2, 'object' => '[REDACTED]', 'exception' => '[REDACTED]']);
});

it('keeps arbitrary strings exceptions requests and interpolated messages out of actual log records', function () {
    $record = new LogRecord(new DateTimeImmutable, 'test', Level::Error, 'private-marker {password}',
        ['password' => 'private-marker', 'unknown' => 'private-marker', 'request' => new stdClass], ['exception' => new RuntimeException('private-marker')]);
    $safe = (new RedactContext)($record);
    expect(json_encode($safe))->not->toContain('private-marker');
});
