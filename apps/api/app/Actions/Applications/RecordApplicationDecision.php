<?php

namespace App\Actions\Applications;

use App\Mail\ChurchApplicationDecisionMail;
use App\Models\ChurchApplication;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

class RecordApplicationDecision
{
    public function handle(ChurchApplication $application): void
    {
        if (config('queue.connections.database.driver') !== 'database'
            || (config('queue.connections.database.connection') ?? config('database.default')) !== DB::getDefaultConnection()) {
            throw new \LogicException('Application decisions require the primary database queue.');
        }
        DB::table('platform_application_audits')->insert([
            'id' => (string) Str::uuid(), 'application_id' => $application->id, 'applicant_id' => $application->user_id,
            'actor_id' => $application->decided_by, 'action' => 'application.'.$application->status->value,
            'category' => $application->category, 'correlation_id' => $application->correlation_id, 'occurred_at' => $application->decided_at,
        ]);
        // Database queue insertion participates in the decision transaction. The queued mail is encrypted.
        Mail::to(User::findOrFail($application->user_id)->email)->queue(new ChurchApplicationDecisionMail($application->status->value));
    }
}
