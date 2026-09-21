<?php

namespace App\Actions\Invitations;

use App\Actions\Memberships\ManageTeachers;
use App\Actions\Memberships\RecordMembershipAudit;
use App\Mail\TeacherInvitationMail;
use App\Models\Invitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

final class InviteTeacher
{
    public function handle(string $email, array $ministryIds): Invitation
    {
        $this->requirePrivateTransport((string) config('mail.default'));

        return DB::transaction(function () use ($email, $ministryIds) {
            $manage = app(ManageTeachers::class);
            $owner = $manage->owner();
            $manage->validateMinistries($ministryIds, $owner->church_id);
            $email = Str::lower(trim($email));
            Invitation::where('church_id', $owner->church_id)->where('email', $email)->whereNull('accepted_at')->whereNull('revoked_at')->update(['revoked_at' => now()]);
            $token = bin2hex(random_bytes(32));
            $invitation = Invitation::create([
                'church_id' => $owner->church_id, 'email' => $email, 'role' => 'teacher',
                'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDays(7), 'inviter_id' => $owner->user_id,
            ]);
            foreach ($ministryIds as $id) {
                DB::table('invitation_ministries')->insert(['id' => (string) Str::uuid(), 'church_id' => $owner->church_id, 'invitation_id' => $invitation->id, 'ministry_id' => $id]);
            }
            app(RecordMembershipAudit::class)->handle($owner->church_id, $owner->user_id, 'teacher.invited', $invitation->id);
            $proof = ['church_id' => $owner->church_id, 'invitation_id' => $invitation->id, 'token' => $token, 'expires' => $invitation->expires_at->timestamp];
            $proof['signature'] = app(InvitationProof::class)->sign($proof);
            // Synchronous delivery: no serialized raw token in jobs, failed_jobs or logs.
            Mail::to($email)->send(new TeacherInvitationMail($proof));

            return $invitation;
        });
    }

    private function requirePrivateTransport(string $mailer, array $visited = []): void
    {
        abort_if(in_array($mailer, $visited, true), 503);
        $settings = config('mail.mailers.'.$mailer, []);
        $transport = $settings['transport'] ?? null;
        if (in_array($transport, ['failover', 'roundrobin'], true)) {
            abort_if(empty($settings['mailers']), 503);
            foreach ($settings['mailers'] as $child) {
                $this->requirePrivateTransport($child, [...$visited, $mailer]);
            }

            return;
        }
        abort_unless(in_array($transport, ['smtp', 'sendmail', 'ses', 'ses-v2', 'postmark', 'resend', 'mailgun'], true)
            || ($transport === 'array' && app()->environment('testing')), 503);
    }
}
