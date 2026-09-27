<?php

namespace App\Actions\Applications;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Mail\ChurchApplicationDecisionMail;
use App\Models\ChurchApplication;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class RecordApplicationDecision
{
    public function handle(ChurchApplication $application): void
    {
        if (config('queue.connections.database.driver') !== 'database'
            || (config('queue.connections.database.connection') ?? config('database.default')) !== DB::getDefaultConnection()) {
            throw new \LogicException('Application decisions require the primary database queue.');
        }
        app(AuditWriter::class)->record(new AuditEntry(
            'platform', 'application.'.$application->status->value, 'platform_admin', $application->decided_by,
            'application', $application->id, correlationId: $application->correlation_id,
            metadata: array_filter(['applicant_id' => (int) $application->user_id, 'decision_category' => $application->category], fn ($value) => $value !== null),
        ));
        // Database queue insertion participates in the decision transaction. The queued mail is encrypted.
        Mail::to(User::findOrFail($application->user_id)->email)->queue(new ChurchApplicationDecisionMail($application->status->value));
    }
}
