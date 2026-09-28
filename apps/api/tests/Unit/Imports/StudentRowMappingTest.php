<?php

use App\Domain\Imports\MapStudentRow;
use Illuminate\Support\Str;

it('maps approved columns through the canonical student normalizer', function () {
    $ministryId = (string) Str::uuid();
    $result = (new MapStudentRow)->map([
        'first_name' => '  Ari  ',
        'last_name' => ' de   la Cruz ',
        'birthdate' => '2018-08-20',
        'gender' => ' girl ',
        'ministries' => ' Primary Kids ',
        'external_reference' => ' Member-7 ',
    ], ['primary kids' => $ministryId]);

    expect($result['status'])->toBe('valid')
        ->and($result['data']['first_name'])->toBe('Ari')
        ->and($result['data']['last_name'])->toBe('de la Cruz')
        ->and($result['data']['date_of_birth'])->toBe('2018-08-20')
        ->and($result['data']['gender'])->toBe('female')
        ->and($result['ministry_ids'])->toBe([$ministryId]);
});

it('never guesses ambiguous numeric dates', function () {
    $result = (new MapStudentRow)->map([
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'birthdate' => '01/02/2018',
    ], []);

    expect($result['status'])->toBe('invalid')
        ->and($result['errors'])->toContain('Birthdate must use YYYY-MM-DD or a genuine Excel date cell.');
});

it('requires Owner mapping for unknown ministries', function () {
    $result = (new MapStudentRow)->map([
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'ministries' => 'Primary; New Group; PRIMARY',
    ], ['primary' => (string) Str::uuid()]);

    expect($result['status'])->toBe('needs_mapping')
        ->and($result['unknown_ministries'])->toBe(['New Group']);
});
