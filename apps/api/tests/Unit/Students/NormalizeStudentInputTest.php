<?php

use App\Actions\Students\NormalizeStudentInput;
use App\Enums\Gender;

it('normalizes safe values without changing intended capitalization', function () {
    $data = NormalizeStudentInput::handle([
        'first_name' => '  McKayla  ',
        'last_name' => "\u{00A0}de   la Cruz ",
        'gender' => '',
        'date_of_birth' => '2018-08-20',
    ]);

    expect($data->firstName)->toBe('McKayla')
        ->and($data->lastName)->toBe('de la Cruz')
        ->and($data->gender)->toBe(Gender::Unspecified)
        ->and($data->dateOfBirth->format('Y-m-d'))->toBe('2018-08-20');
});

it('rejects future, implausible, and ambiguous birthdates', function (string $date) {
    expect(fn () => NormalizeStudentInput::handle([
        'first_name' => 'Ari', 'last_name' => 'Sprout', 'date_of_birth' => $date,
    ]))->toThrow(InvalidArgumentException::class);
})->with(['2099-01-01', '1899-12-31', '01/02/2018']);

it('normalizes accepted gender aliases and uses neutral for unspecified', function () {
    expect(NormalizeStudentInput::handle(['first_name' => 'A', 'last_name' => 'B', 'gender' => ' girl '])->gender)->toBe(Gender::Female)
        ->and(NormalizeStudentInput::handle(['first_name' => 'A', 'last_name' => 'B', 'gender' => 'unknown'])->gender)->toBe(Gender::Unspecified);
});
