<?php

namespace App\Http\Controllers;

use App\Domain\Imports\CommitStudentImport;
use App\Domain\Imports\InspectWorkbook;
use App\Domain\Imports\PreviewStudentImport;
use App\Models\ImportBatch;
use App\Policies\ChurchMembershipPolicy;
use App\Support\Tenancy\TenantContext;
use Illuminate\Http\Request;
use RuntimeException;

final class StudentImportController extends Controller
{
    private function church(): string
    {
        return app(TenantContext::class)->churchId();
    }

    private function owner(Request $request): void
    {
        abort_unless((new ChurchMembershipPolicy)->manage($request->user()), 403);
    }

    public function preview(Request $request, PreviewStudentImport $preview)
    {
        $this->owner($request);
        abort_if(array_diff(array_keys($request->all()), ['file']) !== [], 422);
        $file = $request->validate(['file' => ['required', 'file', 'max:5120']])['file'];
        try {
            $batch = $preview->preview($file, $this->church(), (int) $request->user()->id);
        } catch (RuntimeException $exception) {
            return response()->json([
                'code' => 'validation_failed',
                'message' => 'The request could not be validated.',
                'correlation_id' => $request->header('X-Correlation-Id'),
                'field_errors' => ['file' => [$exception->getMessage()]],
            ], 422);
        }

        return response()->json($this->projection($batch));
    }

    public function show(Request $request, string $batch)
    {
        $this->owner($request);
        $record = ImportBatch::where('church_id', $this->church())->with('rows')->findOrFail($batch);
        if ($record->state === 'previewed' && $record->expires_at->isPast()) {
            $record->forceFill(['state' => 'expired'])->save();
        }

        return response()->json($this->projection($record));
    }

    public function commit(Request $request, string $batch, CommitStudentImport $commit)
    {
        $this->owner($request);
        abort_if($request->allFiles() !== [] || array_diff(array_keys($request->all()), ['commit_key', 'row_ids', 'ministry_mappings']) !== [], 422);
        $data = $request->validate([
            'commit_key' => ['required', 'uuid'],
            'row_ids' => ['required', 'array', 'max:500'],
            'row_ids.*' => ['required', 'uuid', 'distinct'],
            'ministry_mappings' => ['present', 'array', 'max:500'],
            'ministry_mappings.*' => ['required', 'uuid'],
        ]);
        $result = $commit->commit(
            $batch, $this->church(), (int) $request->user()->id,
            $data['commit_key'], $data['row_ids'], $data['ministry_mappings'],
        );

        return response()->json($result, $result['state'] === 'expired' ? 410 : 200);
    }

    public function template(Request $request)
    {
        $this->owner($request);
        $headers = implode(',', InspectWorkbook::HEADERS)."\r\n";

        return response($headers, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="ministrysprout-student-import.csv"',
            'Cache-Control' => 'no-store, private',
        ]);
    }

    private function projection(ImportBatch $batch): array
    {
        $batch->loadMissing('rows');

        return [
            'id' => $batch->id,
            'state' => $batch->state,
            'expires_at' => $batch->expires_at->toIso8601String(),
            'counts' => [
                'valid' => $batch->valid_rows,
                'invalid' => $batch->invalid_rows,
                'duplicate' => $batch->duplicate_rows,
                'needs_mapping' => $batch->needs_mapping_rows,
            ],
            'rows' => $batch->rows->sortBy('row_number')->values()->map(fn ($row) => [
                'id' => $row->id,
                'row_number' => $row->row_number,
                'status' => $row->status,
                'source' => $row->source_data,
                'data' => (object) $row->normalized_data,
                'ministry_names' => $row->ministry_names,
                'ministry_ids' => $row->ministry_ids,
                'unknown_ministries' => $row->unknown_ministries,
                'errors' => $row->errors,
                'outcome' => $row->outcome,
            ])->all(),
        ];
    }
}
