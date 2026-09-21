<?php

namespace App\Actions\Invitations;

use App\Actions\Memberships\ManageTeachers;
use App\Actions\Memberships\RecordMembershipAudit;
use App\Models\Church;
use App\Models\ChurchMembership;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class AcceptTeacherInvitation
{
    public function handle(array $input): string
    {
        app(InvitationProof::class)->verify($input);

        return DB::transaction(function () use ($input) {
            // The verified signature is the authority for this narrow pre-membership RLS scope.
            // No caller-selected header can grant invitation acceptance in another church.
            $previous = DB::selectOne("SELECT current_setting('app.current_church_id', true) AS id")->id;
            DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$input['church_id']]);
            try {
                abort_unless(Church::whereKey($input['church_id'])->where('status', 'active')->lockForUpdate()->first(), 410);
                $invitation = Invitation::where('church_id', $input['church_id'])->lockForUpdate()->find($input['invitation_id']);
                $email = Str::lower(trim($input['email']));
                abort_unless($invitation && ! $invitation->accepted_at && ! $invitation->revoked_at
                    && $invitation->expires_at->isFuture() && hash_equals($invitation->token_hash, hash('sha256', $input['token']))
                    && hash_equals($invitation->email, $email), 410);
                $user = Auth::guard('web')->user();
                if ($user) {
                    $user = User::query()->lockForUpdate()->findOrFail($user->id);
                    abort_unless($user->hasVerifiedEmail() && hash_equals(Str::lower(trim($user->email)), $email), 410);
                } else {
                    // Possession of the emailed signed proof verifies this specific address.
                    // Existing identities must sign in; never reset their credentials from an invitation.
                    abort_if(User::whereRaw('lower(email) = ?', [$email])->exists(), 422);
                    abort_unless(isset($input['name'], $input['password']), 422);
                    $user = User::create(['name' => trim($input['name']), 'email' => $email, 'password' => $input['password']]);
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
            } finally {
                DB::selectOne("SELECT set_config('app.current_church_id', ?, true)", [$previous ?? '']);
            }
        });
    }
}
