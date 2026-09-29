<?php

use App\Domain\Notifications\FindBirthdayRecipients;
use Carbon\CarbonImmutable;

it('matches ordinary birthdays without exposing a full birthdate', function (): void {
    $today = CarbonImmutable::parse('2026-09-29', 'Asia/Manila');

    expect(FindBirthdayRecipients::isBirthday('2018-09-29', $today))->toBeTrue()
        ->and(FindBirthdayRecipients::isBirthday('2018-09-30', $today))->toBeFalse()
        ->and(FindBirthdayRecipients::turningAge('2018-09-29', $today))->toBe(8);
});

it('observes February 29 birthdays on February 28 only in non-leap years', function (): void {
    expect(FindBirthdayRecipients::isBirthday('2016-02-29', CarbonImmutable::parse('2026-02-28')))->toBeTrue()
        ->and(FindBirthdayRecipients::isBirthday('2016-02-29', CarbonImmutable::parse('2028-02-28')))->toBeFalse()
        ->and(FindBirthdayRecipients::isBirthday('2016-02-29', CarbonImmutable::parse('2028-02-29')))->toBeTrue();
});
