<?php

namespace App\Domain\Imports;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Models\Enrollment;
use App\Models\ImportBatch;
use App\Models\ImportRow;
use App\Models\Ministry;
use App\Models\Student;
use Illuminate\Support\Facades\DB;

final readonly class CommitStudentImport
{
    public function commit(
        string $batchId,
        string $churchId,
        int $userId,
        string $commitKey,
        array $rowIds,
        array $ministryMappings,
    ): array {
        return DB::transaction(function () use ($batchId, $churchId, $userId, $commitKey, $rowIds, $ministryMappings) {
            $batch = ImportBatch::where('church_id', $churchId)->lockForUpdate()->findOrFail($batchId);
            if ($batch->state === 'completed') {
                abort_unless($batch->commit_key === $commitKey, 409);

                return $batch->result_json;
            }
            if ($batch->state === 'expired' || $batch->expires_at->isPast()) {
                $batch->forceFill(['state' => 'expired'])->save();

                return ['id' => $batch->id, 'state' => 'expired', 'counts' => ['committed' => 0, 'excluded' => $batch->total_rows]];
            }
            abort_unless($batch->state === 'previewed', 409);

            $rows = ImportRow::where('church_id', $churchId)->where('import_batch_id', $batch->id)
                ->orderBy('row_number')->lockForUpdate()->get();
            $selected = array_fill_keys($rowIds, true);
            abort_if(array_diff($rowIds, $rows->pluck('id')->all()) !== [], 422);

            $requiredMappings = [];
            foreach ($rows as $row) {
                if (! isset($selected[$row->id])) {
                    continue;
                }
                abort_unless(in_array($row->status, ['valid', 'needs_mapping'], true), 422);
                foreach ($row->unknown_ministries as $unknown) {
                    abort_unless(isset($ministryMappings[$unknown]), 422);
                    $requiredMappings[$unknown] = true;
                }
            }
            abort_if(array_diff(array_keys($ministryMappings), array_keys($requiredMappings)) !== [], 422);
            $mappingIds = array_values(array_unique(array_values($ministryMappings)));
            $availableMappings = Ministry::where('church_id', $churchId)->whereNull('deleted_at')->whereNull('archived_at')
                ->whereIn('id', $mappingIds)->pluck('id')->all();
            abort_if(count($availableMappings) !== count($mappingIds), 422);

            $batch->forceFill(['state' => 'committing', 'commit_key' => $commitKey])->save();
            $committed = 0;
            $duplicates = 0;
            $excluded = 0;
            foreach ($rows as $row) {
                if (! isset($selected[$row->id])) {
                    $row->forceFill(['outcome' => $row->status === 'duplicate' ? 'duplicate' : 'excluded'])->save();
                    $row->status === 'duplicate' ? $duplicates++ : $excluded++;

                    continue;
                }
                if ($this->becameDuplicate($churchId, $row->normalized_data)) {
                    $row->forceFill(['outcome' => 'duplicate'])->save();
                    $duplicates++;

                    continue;
                }

                $student = Student::create(['church_id' => $churchId, 'version' => 1] + $row->normalized_data);
                $ministryIds = $row->ministry_ids;
                foreach ($row->unknown_ministries as $unknown) {
                    $ministryIds[] = $ministryMappings[$unknown];
                }
                $ministryIds = array_values(array_unique($ministryIds));
                abort_if(count($ministryIds) !== Ministry::where('church_id', $churchId)->whereNull('deleted_at')->whereNull('archived_at')->whereIn('id', $ministryIds)->count(), 422);
                foreach ($ministryIds as $ministryId) {
                    Enrollment::create([
                        'church_id' => $churchId, 'student_id' => $student->id,
                        'ministry_id' => $ministryId, 'version' => 1,
                    ]);
                }
                $row->forceFill(['outcome' => 'committed', 'student_id' => $student->id])->save();
                $committed++;
            }

            $result = [
                'id' => $batch->id,
                'state' => 'completed',
                'counts' => ['committed' => $committed, 'excluded' => $excluded, 'duplicate' => $duplicates],
            ];
            $batch->forceFill(['state' => 'completed', 'result_json' => $result, 'committed_at' => now()])->save();
            app(AuditWriter::class)->record(new AuditEntry(
                'church', 'student_import.completed', 'user', (string) $userId,
                'import_batch', $batch->id, 'success', $churchId, metadata: ['count' => $committed],
            ));

            return $result;
        }, 3);
    }

    private function becameDuplicate(string $churchId, array $data): bool
    {
        if (is_string($data['external_reference'] ?? null)
            && Student::where('church_id', $churchId)->whereRaw('lower(external_reference) = ?', [mb_strtolower($data['external_reference'])])->exists()) {
            return true;
        }

        return is_string($data['date_of_birth'] ?? null)
            && Student::where('church_id', $churchId)
                ->whereRaw('lower(first_name) = ?', [mb_strtolower($data['first_name'])])
                ->whereRaw('lower(last_name) = ?', [mb_strtolower($data['last_name'])])
                ->whereDate('date_of_birth', $data['date_of_birth'])->exists();
    }
}
