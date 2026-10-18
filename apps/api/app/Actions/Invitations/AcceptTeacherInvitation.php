<?php

namespace App\Actions\Invitations;

use App\Actions\Memberships\ManageTeachers;
use App\Actions\Memberships\RecordMembershipAudit;
use App\Domain\Sync\SignedInvitationCoordination;
use App\Models\ChurchMembership;
use App\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AcceptTeacherInvitation
{
    public function handle(#[\SensitiveParameter] array $input): string
    {
        $authority = VerifiedInvitationAuthority::verify($input);
        try {
            return app(SignedInvitationCoordination::class)->run(request(), $authority, function ($invitation, $user) use ($input, $authority): string {
                if ($user === null) {
                    abort_if(User::whereRaw('lower(btrim(email)) = ?', [$authority->email()])->exists(), 422);
                    abort_unless(isset($input['name'], $input['password']), 422);
                    $user = User::create(['name' => trim($input['name']), 'email' => $authority->email(), 'password' => $input['password']]);
                    $user->forceFill(['email_verified_at' => now()])->save();
                }
                $membership = ChurchMembership::where('church_id', $invitation->church_id)->where('user_id', $user->id)->lockForUpdate()->first();
                abort_if($membership !== null, 410);
                $ids = DB::table('invitation_ministries')->where('church_id', $invitation->church_id)->where('invitation_id', $invitation->id)->pluck('ministry_id')->all();
                $membership = ChurchMembership::create(['church_id' => $invitation->church_id, 'user_id' => $user->id, 'role' => 'teacher', 'status' => 'active']);
                app(ManageTeachers::class)->assign($membership, $ids, $invitation->inviter_id);
                $invitation->forceFill(['accepted_at' => now()])->save();
                app(RecordMembershipAudit::class)->handle($invitation->church_id, $user->id, 'invitation.accepted', $invitation->id);

                return $invitation->church_id;
            });
        } catch (UniqueConstraintViolationException $exception) {
            if (! str_contains($exception->getMessage(), 'users_normalized_email_unique') && ! str_contains($exception->getMessage(), 'users_email_unique')) {
                throw $exception;
            }
            // The owning invitation transaction has already rolled back, including scope.
            throw ValidationException::withMessages(['email' => 'Sign in to the existing account before accepting this invitation.']);
        }
    }
}
