<?php

namespace App\Http\Controllers;

use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Domain\Reports\AttendanceSummary;
use App\Enums\ChurchRole;
use App\Http\Resources\AttendanceReportResource;
use App\Support\Tenancy\TenantContext;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AttendanceReportController extends Controller
{
    public function index(Request $request, AttendanceSummary $summary): JsonResource
    {
        return new AttendanceReportResource($summary->report($request->user(), $this->filters($request)));
    }

    public function export(Request $request, AttendanceSummary $summary, AuditWriter $audit): StreamedResponse
    {
        abort_unless(app(TenantContext::class)->role() === ChurchRole::Owner, 403);
        $filters = $this->filters($request);
        $rows = $summary->exportRows($request->user(), $filters);
        $audit->record(new AuditEntry(
            'church', 'attendance.report.exported', 'user', (string) $request->user()->id,
            'system', null, 'success', app(TenantContext::class)->churchId(), metadata: [
                'date_from' => $filters['date_from'],
                'date_to' => $filters['date_to'],
                'ministry_id' => $filters['ministry_id'],
                'result_count' => count($rows),
            ],
        ));
        $csv = $this->csv($rows);
        $filename = "attendance-{$filters['date_from']}-to-{$filters['date_to']}.csv";

        return response()->streamDownload(
            static function () use ($csv): void {
                echo $csv;
            },
            $filename,
            [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Cache-Control' => 'no-store, private',
                'X-Content-Type-Options' => 'nosniff',
            ],
        );
    }

    /** @return array{date_from: string, date_to: string, ministry_id: ?string} */
    private function filters(Request $request): array
    {
        abort_if(array_diff(array_keys($request->query()), ['date_from', 'date_to', 'ministry_id']) !== [], 422);
        $today = CarbonImmutable::now('UTC')->toDateString();
        $input = $request->validate([
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
            'ministry_id' => ['sometimes', 'uuid'],
        ]);
        $from = $input['date_from'] ?? CarbonImmutable::now('UTC')->subDays(30)->toDateString();
        $to = $input['date_to'] ?? $today;
        $fromDate = CarbonImmutable::parse($from);
        $toDate = CarbonImmutable::parse($to);
        abort_if($toDate->lessThan($fromDate) || $fromDate->diffInDays($toDate) > 366, 422);

        return ['date_from' => $from, 'date_to' => $to, 'ministry_id' => $input['ministry_id'] ?? null];
    }

    /** @param array<int, array<string, bool|string>> $rows */
    private function csv(array $rows): string
    {
        $stream = fopen('php://temp', 'w+b');
        if ($stream === false) {
            throw new \RuntimeException('Unable to create attendance export.');
        }
        fwrite($stream, "\xEF\xBB\xBF");
        fputcsv($stream, ['attendance_date', 'ministry', 'student', 'effective_state', 'session_status', 'corrected', 'finalized_at'], ',', '"', '', "\r\n");
        foreach ($rows as $row) {
            fputcsv($stream, [
                $row['attendance_date'], $this->safeCell($row['ministry']), $this->safeCell($row['student']),
                $row['effective_state'], $row['session_status'], $row['corrected'] ? 'yes' : 'no', $row['finalized_at'],
            ], ',', '"', '', "\r\n");
        }
        rewind($stream);
        $contents = stream_get_contents($stream);
        fclose($stream);
        if ($contents === false) {
            throw new \RuntimeException('Unable to read attendance export.');
        }

        return $contents;
    }

    private function safeCell(string $value): string
    {
        return preg_match('/\A[=+\-@]/u', $value) === 1 ? "'".$value : $value;
    }
}
