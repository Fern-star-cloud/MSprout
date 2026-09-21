<?php

namespace App\Actions\Applications;

use App\Models\ChurchApplication;
use App\Models\User;
use App\Support\Captcha\CaptchaVerifier;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class SubmitChurchApplication
{
    public function handle(User $user, #[\SensitiveParameter] array $input): ChurchApplication
    {
        if (! app(CaptchaVerifier::class)->verify($input['captcha_token'])) {
            throw ValidationException::withMessages(['captcha_token' => 'Complete the verification again.']);
        }
        $identity = hash('sha256', mb_strtolower($input['church_name'])."\0".mb_strtolower($input['city']));
        try {
            return DB::transaction(function () use ($user, $input, $identity) {
                $applicant = User::query()->lockForUpdate()->findOrFail($user->id);
                abort_unless($applicant->hasVerifiedEmail(), 403);
                abort_if(ChurchApplication::query()->whereIn('status', ['pending', 'approved'])
                    ->where(fn ($query) => $query->where('user_id', $user->id)->orWhere('duplicate_key', $identity))->exists(), 409);

                return ChurchApplication::create([
                    'user_id' => $user->id, 'church_name' => $input['church_name'], 'city' => $input['city'],
                    'timezone' => $input['timezone'], 'address' => $input['address'] ?? null, 'duplicate_key' => $identity, 'status' => 'pending',
                ]);
            });
        } catch (UniqueConstraintViolationException) {
            abort(409);
        }
    }
}
