<?php

namespace App\Domain\Imports;

use App\Models\ImportBatch;
use App\Models\ImportRow;
use App\Models\Ministry;
use App\Models\Student;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;

final readonly class PreviewStudentImport
{
    public function __construct(
        private InspectWorkbook $inspector,
        private MapStudentRow $mapper,
    ) {}

    public function preview(UploadedFile $file, string $churchId, int $userId): ImportBatch
    {
        $batch = ImportBatch::create([
            'church_id' => $churchId,
            'uploaded_by_user_id' => $userId,
            'state' => 'uploaded',
            'file_sha256' => hash_file('sha256', $file->getRealPath()),
            'file_extension' => mb_strtolower($file->getClientOriginalExtension()),
            'expires_at' => now()->addDay(),
        ]);
        try {
            $sourceRows = $this->inspector->inspect($file);
        } catch (\RuntimeException $exception) {
            $batch->forceFill(['state' => 'failed'])->save();
            throw $exception;
        }
        $ministries = Ministry::where('church_id', $churchId)
            ->whereNull('deleted_at')->whereNull('archived_at')
            ->get(['id', 'name'])->mapWithKeys(fn ($ministry) => [mb_strtolower($ministry->name) => $ministry->id])->all();

        return DB::transaction(function () use ($batch, $churchId, $sourceRows, $ministries) {
            $seenReferences = [];
            $seenIdentities = [];
            $counts = ['valid' => 0, 'invalid' => 0, 'duplicate' => 0, 'needs_mapping' => 0];
            foreach ($sourceRows as $source) {
                $mapped = $this->mapper->map($source['values'], $ministries);
                if ($mapped['status'] !== 'invalid' && $this->isDuplicate($churchId, $mapped['data'], $seenReferences, $seenIdentities)) {
                    $mapped['status'] = 'duplicate';
                    $mapped['errors'] = ['A possible existing student requires Owner review and was not selected.'];
                }
                $counts[$mapped['status']]++;
                ImportRow::create([
                    'church_id' => $churchId,
                    'import_batch_id' => $batch->id,
                    'row_number' => $source['row_number'],
                    'status' => $mapped['status'],
                    'source_data' => $mapped['source_data'],
                    'normalized_data' => $mapped['data'],
                    'ministry_names' => $mapped['ministry_names'],
                    'ministry_ids' => $mapped['ministry_ids'],
                    'unknown_ministries' => $mapped['unknown_ministries'],
                    'errors' => $mapped['errors'],
                ]);
            }
            $batch->forceFill([
                'state' => 'previewed',
                'total_rows' => count($sourceRows),
                'valid_rows' => $counts['valid'],
                'invalid_rows' => $counts['invalid'],
                'duplicate_rows' => $counts['duplicate'],
                'needs_mapping_rows' => $counts['needs_mapping'],
            ])->save();

            return $batch->fresh('rows');
        });
    }

    private function isDuplicate(string $churchId, array $data, array &$seenReferences, array &$seenIdentities): bool
    {
        $reference = $data['external_reference'] ?? null;
        if (is_string($reference)) {
            $key = mb_strtolower($reference);
            if (isset($seenReferences[$key]) || Student::where('church_id', $churchId)->whereRaw('lower(external_reference) = ?', [$key])->exists()) {
                return true;
            }
            $seenReferences[$key] = true;
        }

        $birthdate = $data['date_of_birth'] ?? null;
        if (! is_string($birthdate)) {
            return false;
        }
        $identity = mb_strtolower($data['first_name'])."\0".mb_strtolower($data['last_name'])."\0".$birthdate;
        if (isset($seenIdentities[$identity]) || Student::where('church_id', $churchId)
            ->whereRaw('lower(first_name) = ?', [mb_strtolower($data['first_name'])])
            ->whereRaw('lower(last_name) = ?', [mb_strtolower($data['last_name'])])
            ->whereDate('date_of_birth', $birthdate)->exists()) {
            return true;
        }
        $seenIdentities[$identity] = true;

        return false;
    }
}
