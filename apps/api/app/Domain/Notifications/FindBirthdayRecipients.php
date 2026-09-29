<?php

namespace App\Domain\Notifications;

use App\Enums\ChurchRole;
use App\Models\ChurchMembership;
use App\Models\Student;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final class FindBirthdayRecipients
{
    public static function isBirthday(string $birthdate, CarbonImmutable $localDate): bool
    {
        $birthday = CarbonImmutable::parse($birthdate);
        if ($birthday->month === $localDate->month && $birthday->day === $localDate->day) {
            return true;
        }

        return $birthday->month === 2 && $birthday->day === 29
            && ! $localDate->isLeapYear()
            && $localDate->month === 2 && $localDate->day === 28;
    }

    public static function turningAge(string $birthdate, CarbonImmutable $localDate): int
    {
        return $localDate->year - CarbonImmutable::parse($birthdate)->year;
    }

    /** @return array<int, array{id: string, display_name: string, turning_age: int, ministry_names: array<int, string>}> */
    public function birthdays(ChurchMembership $membership, CarbonImmutable $localDate): array
    {
        $churchId = $membership->church_id;
        $assignedMinistryIds = [];
        $query = Student::query()
            ->where('students.church_id', $churchId)
            ->whereNull('students.deleted_at')
            ->whereNotNull('students.date_of_birth');

        if ($membership->role === ChurchRole::Teacher) {
            $assignedMinistryIds = DB::table('teacher_ministry_assignments')
                ->where('church_id', $churchId)
                ->where('membership_id', $membership->id)
                ->whereNull('revoked_at')
                ->pluck('ministry_id')
                ->all();
            if ($assignedMinistryIds === []) {
                return [];
            }
            $query->whereExists(function ($enrollment) use ($churchId, $assignedMinistryIds): void {
                $enrollment->selectRaw('1')->from('enrollments')
                    ->whereColumn('enrollments.student_id', 'students.id')
                    ->where('enrollments.church_id', $churchId)
                    ->whereNull('enrollments.deleted_at')
                    ->whereIn('enrollments.ministry_id', $assignedMinistryIds);
            });
        }

        $this->whereBirthday($query, $localDate);

        return $query->orderBy('students.last_name')->orderBy('students.first_name')->orderBy('students.id')
            ->get()->map(function (Student $student) use ($assignedMinistryIds, $membership, $localDate): array {
                $ministries = DB::table('enrollments')
                    ->join('ministries', function ($join): void {
                        $join->on('ministries.id', '=', 'enrollments.ministry_id')
                            ->on('ministries.church_id', '=', 'enrollments.church_id');
                    })
                    ->where('enrollments.church_id', $membership->church_id)
                    ->where('enrollments.student_id', $student->id)
                    ->whereNull('enrollments.deleted_at')
                    ->whereNull('ministries.archived_at')
                    ->whereNull('ministries.deleted_at');
                if ($membership->role === ChurchRole::Teacher) {
                    $ministries->whereIn('enrollments.ministry_id', $assignedMinistryIds);
                }

                return [
                    'id' => $student->id,
                    'display_name' => $student->preferred_name ?: trim($student->first_name.' '.($student->middle_name ? $student->middle_name.' ' : '').$student->last_name.($student->suffix ? ' '.$student->suffix : '')),
                    'turning_age' => self::turningAge($student->date_of_birth->toDateString(), $localDate),
                    'ministry_names' => $ministries->orderBy('ministries.name')->distinct()->pluck('ministries.name')->all(),
                ];
            })->all();
    }

    /** @return array<int, array{subscription_id: string, membership_id: string, user_id: int, device_id: string, birthday_count: int}> */
    public function recipients(string $churchId, CarbonImmutable $localDate): array
    {
        return DB::table('push_subscriptions')
            ->join('church_memberships', function ($join): void {
                $join->on('church_memberships.id', '=', 'push_subscriptions.membership_id')
                    ->on('church_memberships.church_id', '=', 'push_subscriptions.church_id')
                    ->on('church_memberships.user_id', '=', 'push_subscriptions.user_id');
            })
            ->where('push_subscriptions.church_id', $churchId)
            ->where('push_subscriptions.permission_state', 'granted')
            ->whereNull('push_subscriptions.revoked_at')
            ->whereNotNull('push_subscriptions.endpoint_ciphertext')
            ->where('church_memberships.status', 'active')
            ->orderBy('push_subscriptions.id')
            ->get([
                'push_subscriptions.id as subscription_id', 'push_subscriptions.membership_id',
                'push_subscriptions.user_id', 'push_subscriptions.device_id',
            ])->map(function (object $subscription) use ($localDate): ?array {
                $membership = ChurchMembership::query()->find($subscription->membership_id);
                if ($membership === null) {
                    return null;
                }
                $count = count($this->birthdays($membership, $localDate));

                return $count === 0 ? null : [
                    'subscription_id' => $subscription->subscription_id,
                    'membership_id' => $subscription->membership_id,
                    'user_id' => (int) $subscription->user_id,
                    'device_id' => $subscription->device_id,
                    'birthday_count' => $count,
                ];
            })->filter()->values()->all();
    }

    private function whereBirthday(Builder $query, CarbonImmutable $date): void
    {
        $monthDay = $date->format('m-d');
        $query->where(function (Builder $birthday) use ($date, $monthDay): void {
            $birthday->whereRaw("to_char(students.date_of_birth, 'MM-DD') = ?", [$monthDay]);
            if (! $date->isLeapYear() && $monthDay === '02-28') {
                $birthday->orWhereRaw("to_char(students.date_of_birth, 'MM-DD') = '02-29'");
            }
        });
    }
}
