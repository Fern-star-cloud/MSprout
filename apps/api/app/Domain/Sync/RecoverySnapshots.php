<?php

namespace App\Domain\Sync;

use App\Domain\Attendance\AttendanceCompatibility;
use App\Domain\Audit\AuditEntry;
use App\Domain\Audit\AuditWriter;
use App\Models\ChurchMembership;
use Carbon\CarbonImmutable;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

final class RecoverySnapshots
{
    public function __construct(private readonly RecoveryProjection $projection) {}

    private function authorize(Request $request, string $device): ChurchMembership
    {
        abort_unless(config('recovery.enabled') === true && app()->environment('testing'), 404);
        app(ChurchCoordination::class)->assertMemberAuthority();
        app(AttendanceCompatibility::class)->declaration($request);
        $member = app(SyncAuthorization::class)->membership($request, $device);
        if (! app(PublicationMode::class)->coordinated()) {
            throw new RecoveryException('recovery_cut_unqualified');
        }

        return $member;
    }

    private function progress(string $church): object
    {
        $progress = DB::table('sync_recovery_progress')->where('church_id', $church)->first();
        if ($progress === null || $progress->history_baselined_at === null || $progress->coverage_epoch === null) {
            throw new RecoveryException('recovery_cut_unqualified');
        }

        return $progress;
    }

    public function begin(Request $request, array $input): array
    {
        $member = $this->authorize($request, $input['device_id']);
        $progress = $this->progress($member->church_id);
        $scope = $this->projection->scope($member);
        $requestDigest = RecoveryCodec::digest($input);
        $device = DB::table('device_cursors')->where('church_id', $member->church_id)->where('membership_id', $member->id)
            ->where('device_id', $input['device_id'])->lockForUpdate()->first();
        if ($device === null) {
            throw new RecoveryException('recovery_device_unavailable');
        }
        $old = DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('membership_id', $member->id)
            ->where('device_id', $input['device_id'])->where('request_id', $input['request_id'])->first();
        if ($old !== null) {
            if ($old->request_digest !== $requestDigest) {
                throw new RecoveryException('recovery_request_mismatch');
            }
            $run = $this->run($member, $input['device_id'], $old->id, $old->generation, $scope);

            return $this->metadata($run, $scope);
        }
        if ($device->active_recovery_id !== null) {
            $active = DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('id', $device->active_recovery_id)->first();
            if ($active !== null && in_array($active->state, ['collecting', 'ready', 'client_confirmed'], true)) {
                $this->transition($active, ['state' => 'superseded']);
            }
        }
        $lifetime = config('recovery.lifetime_seconds');
        if (! is_int($lifetime) || $lifetime < 1 || $lifetime > 14400) {
            throw new RecoveryException('recovery_limits_unqualified');
        }
        $clock = CarbonImmutable::parse(DB::scalar('SELECT clock_timestamp()'));
        if (DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('schema_version', RecoveryCodec::SCHEMA)
            ->whereNull('pages_purged_at')->count() >= 128
            || DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('membership_id', $member->id)->where('device_id', $input['device_id'])
                ->where('schema_version', RecoveryCodec::SCHEMA)->whereNull('pages_purged_at')->count() >= 8) {
            throw new RecoveryException('recovery_capacity_exceeded');
        }
        $id = (string) Str::uuid();
        $limits = [];
        foreach (['max_input_pages' => 1000, 'max_output_pages' => 10000, 'max_items' => 2000000, 'max_stored_bytes' => 536870912] as $key => $maximum) {
            $value = config('recovery.'.$key);
            if (! is_int($value) || $value < 1 || $value > $maximum) {
                throw new RecoveryException('recovery_limits_unqualified');
            }
            $limits[$key] = $value;
        }
        DB::table('offline_recovery_runs')->insert([
            'id' => $id, 'church_id' => $member->church_id, 'actor_id' => $member->user_id, 'membership_id' => $member->id,
            'device_id' => $input['device_id'], 'request_id' => $input['request_id'], 'local_generation_id' => $input['local_generation_id'],
            'generation' => (string) Str::uuid(), 'coverage_epoch' => $progress->coverage_epoch, 'schema_version' => RecoveryCodec::SCHEMA,
            'request_digest' => $requestDigest, 'authority_digest' => $scope['digest'], ...$limits,
            'created_at' => $clock, 'expires_at' => $clock->addSeconds($lifetime),
        ]);
        DB::table('device_cursors')->where('id', $device->id)->update(['active_recovery_id' => $id, 'full_resync_required' => true]);
        $run = DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('id', $id)->first();
        $this->audit($run, 'begun');

        return $this->metadata($run, $scope);
    }

    private function run(ChurchMembership $member, string $device, string $id, string $generation, array $scope): object
    {
        $run = DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('membership_id', $member->id)
            ->where('actor_id', $member->user_id)->where('device_id', $device)->where('id', $id)->where('generation', $generation)
            ->where('schema_version', RecoveryCodec::SCHEMA)->first();
        abort_unless($run, 404);
        $active = DB::table('device_cursors')->where('church_id', $member->church_id)->where('membership_id', $member->id)
            ->where('device_id', $device)->value('active_recovery_id');
        if ($active !== $run->id || ! in_array($run->state, ['collecting', 'ready'], true)
            || ! DB::scalar('SELECT ?::timestamptz > clock_timestamp()', [$run->expires_at])) {
            throw new RecoveryException('recovery_generation_unavailable');
        }
        if ($run->authority_digest !== $scope['digest']) {
            throw new RecoveryException('recovery_scope_changed');
        }
        if ($this->progress($member->church_id)->coverage_epoch !== $run->coverage_epoch) {
            throw new RecoveryException('recovery_cut_unqualified');
        }

        return $run;
    }

    public function upload(Request $request, array $input): array
    {
        $member = $this->authorize($request, $input['device_id']);
        $scope = $this->projection->scope($member);
        $run = $this->run($member, $input['device_id'], $input['recovery_id'], $input['generation'], $scope);
        $this->validateItems($input['items']);
        $page = ['schema' => RecoveryCodec::SCHEMA, 'ordinal' => $input['ordinal'], 'previous_digest' => $input['previous_digest'], 'items' => $input['items']];
        $encoded = RecoveryCodec::encode($page);
        $existing = $this->pages($run, 'input')->where('ordinal', $input['ordinal'])->first();
        if ($existing !== null) {
            if (! hash_equals($existing->content_digest, $encoded['content_digest'])) {
                throw new RecoveryException('recovery_page_mismatch');
            }
            RecoveryCodec::decode($existing);
            $this->projection->assertCurrent($scope);

            return ['ordinal' => $input['ordinal'], 'page_digest' => $existing->content_digest, 'events_settled' => false];
        }
        if ($run->state !== 'collecting' || $input['ordinal'] !== $run->input_page_count) {
            throw new RecoveryException('recovery_page_order');
        }
        $previous = $input['ordinal'] === 0 ? null : $this->pages($run, 'input')->where('ordinal', $input['ordinal'] - 1)->value('content_digest');
        if ($input['previous_digest'] !== $previous) {
            throw new RecoveryException('recovery_integrity_failed');
        }
        $this->store($run, 'input', $input['ordinal'], $encoded);
        $this->projection->assertCurrent($scope);

        return ['ordinal' => $input['ordinal'], 'page_digest' => $encoded['content_digest'], 'events_settled' => false];
    }

    private function validateItems(array $items): void
    {
        foreach ($items as $item) {
            if (! is_array($item)) {
                throw new RecoveryException('recovery_manifest_invalid', 422);
            }
            $rules = ($item['type'] ?? null) === 'reference'
                ? ['type' => ['required', 'in:reference'], 'session_id' => ['required', 'uuid']]
                : ['type' => ['required', 'in:event'], 'event' => ['required', 'array:client_event_id,entity_id,action,base_version,occurred_at,payload'],
                    'event.client_event_id' => ['required', 'uuid'], 'event.entity_id' => ['required', 'uuid'], 'event.action' => ['required', 'string', 'max:64'],
                    'event.base_version' => ['required', 'integer', 'min:0', 'max:2147483647'], 'event.occurred_at' => ['required', 'date'], 'event.payload' => ['present', 'array']];
            if (array_diff(array_keys($item), ($item['type'] ?? null) === 'reference' ? ['type', 'session_id'] : ['type', 'event']) || Validator::make($item, $rules)->fails()) {
                throw new RecoveryException('recovery_manifest_invalid', 422);
            }
            if ($item['type'] === 'event' && ! is_int($item['event']['base_version'])) {
                throw new RecoveryException('recovery_manifest_invalid', 422);
            }
        }
    }

    public function seal(Request $request, array $input): array
    {
        $member = $this->authorize($request, $input['device_id']);
        $scope = $this->projection->scope($member);
        $run = $this->run($member, $input['device_id'], $input['recovery_id'], $input['generation'], $scope);
        $references = $seen = $digests = [];
        $total = 0;
        foreach ($this->pages($run, 'input')->orderBy('ordinal')->get() as $row) {
            $page = RecoveryCodec::decode($row);
            if ($page['ordinal'] !== count($digests) || $page['previous_digest'] !== ($digests === [] ? null : end($digests))) {
                throw new RecoveryException('recovery_integrity_failed');
            }
            $this->validateItems($page['items']);
            foreach ($page['items'] as $item) {
                $identity = $item['type'].':'.strtolower($item['session_id'] ?? $item['event']['client_event_id']);
                if (isset($seen[$identity])) {
                    throw new RecoveryException('recovery_duplicate_identity');
                }
                $seen[$identity] = true;
                $references[strtolower($item['session_id'] ?? $item['event']['entity_id'])] = true;
                $total++;
            }
            $digests[] = $row->content_digest;
        }
        if (count($references) > 10000 || count($digests) === 0 || $total !== $input['input_item_count'] || $total !== $run->input_item_count
            || count($digests) !== $input['input_page_count'] || count($digests) !== $run->input_page_count
            || ! hash_equals(RecoveryCodec::manifest($digests), $input['input_manifest_digest'])) {
            throw new RecoveryException('recovery_manifest_incomplete');
        }
        if ($run->state === 'ready') {
            if ($run->input_manifest_digest !== $input['input_manifest_digest']) {
                throw new RecoveryException('recovery_request_mismatch');
            }

            return $this->metadata($run, $scope);
        }
        $progress = $this->progress($member->church_id);
        $cut = (string) max($progress->feed_head, $progress->baseline_sequence_floor);
        $window = $this->projection->window($scope);
        $header = ['schema' => RecoveryCodec::SCHEMA, 'generation' => $run->generation, 'coverage_epoch' => $run->coverage_epoch,
            'snapshot_cursor' => $cut, 'scope_digest' => $scope['digest'], 'window_start' => $window[0], 'window_end' => $window[1], 'timezone' => $scope['timezone']];
        $output = $items = $outputSeen = [];
        $storageBudget = (int) DB::table('offline_recovery_runs')->where('church_id', $run->church_id)->whereNull('pages_purged_at')->sum('stored_bytes');
        $bytes = strlen(RecoveryCodec::json($header)) + 256;
        foreach ($this->projection->items($member->church_id, $scope, $references, $window) as $item) {
            foreach ($item as $key => $value) {
                if (str_ends_with($key, '_at') && $value !== null) {
                    $item[$key] = CarbonImmutable::parse($value)->toISOString();
                }
            }
            $identity = $item['type'].':'.$item['id'];
            if (isset($outputSeen[$identity])) {
                throw new RecoveryException('recovery_duplicate_identity');
            }
            $outputSeen[$identity] = true;
            $size = strlen(RecoveryCodec::json($item)) + 1;
            if (count($items) === RecoveryCodec::ITEMS || ($items !== [] && $bytes + $size > RecoveryCodec::PLAINTEXT)) {
                $this->output($run, $header, $items, $output, $storageBudget);
                $items = [];
                $bytes = strlen(RecoveryCodec::json($header)) + 256;
            }
            $items[] = $item;
            $bytes += $size;
        }
        if ($items !== []) {
            $this->output($run, $header, $items, $output, $storageBudget);
        }
        $this->transition($run, ['state' => 'ready', 'input_manifest_digest' => $input['input_manifest_digest'], 'snapshot_manifest_digest' => RecoveryCodec::manifest($output),
            'scope_digest' => $scope['digest'], 'snapshot_cursor' => $cut, 'window_start' => $window[0], 'window_end' => $window[1], 'timezone' => $scope['timezone']]);
        $run = DB::table('offline_recovery_runs')->where('church_id', $member->church_id)->where('id', $run->id)->first();
        $this->audit($run, 'sealed');

        return $this->metadata($run, $scope);
    }

    private function output(object $run, array $header, array $items, array &$digests, int &$storageBudget): void
    {
        $ordinal = count($digests);
        $page = [...$header, 'ordinal' => $ordinal, 'previous_digest' => $ordinal === 0 ? null : $digests[$ordinal - 1], 'items' => $items];
        $encoded = RecoveryCodec::encode($page);
        $this->store($run, 'output', $ordinal, $encoded, $storageBudget);
        $digests[] = $encoded['content_digest'];
    }

    private function store(object $run, string $kind, int $ordinal, array $encoded, ?int &$storageBudget = null): void
    {
        $current = $run;
        if ($ordinal >= ($kind === 'input' ? $current->max_input_pages : $current->max_output_pages)
            || $current->input_item_count + $current->output_item_count + $encoded['item_count'] > $current->max_items
            || $current->stored_bytes + strlen($encoded['payload_ciphertext']) > $current->max_stored_bytes) {
            throw new RecoveryException('recovery_capacity_exceeded');
        }
        $storageBudget ??= (int) DB::table('offline_recovery_runs')->where('church_id', $run->church_id)->whereNull('pages_purged_at')->sum('stored_bytes');
        if ($storageBudget + strlen($encoded['payload_ciphertext']) > 536870912) {
            throw new RecoveryException('recovery_capacity_exceeded');
        }
        DB::table('offline_recovery_pages')->insert(['church_id' => $run->church_id, 'run_id' => $run->id, 'kind' => $kind, 'ordinal' => $ordinal, ...$encoded, 'created_at' => now('UTC')]);
        $storageBudget += strlen($encoded['payload_ciphertext']);
        $run->stored_bytes += strlen($encoded['payload_ciphertext']);
        if ($kind === 'input') {
            $run->input_page_count++;
            $run->input_item_count += $encoded['item_count'];
        } else {
            $run->output_page_count++;
            $run->output_item_count += $encoded['item_count'];
        }
    }

    private function pages(object $run, string $kind): Builder
    {
        return DB::table('offline_recovery_pages')->where('church_id', $run->church_id)->where('run_id', $run->id)->where('kind', $kind);
    }

    private function transition(object $run, array $patch): void
    {
        DB::select('SELECT public.transition_recovery_run(?,?,?::jsonb)', [$run->id, $run->state, RecoveryCodec::json($patch)]);
    }

    public function page(Request $request, array $input): array
    {
        $member = $this->authorize($request, $input['device_id']);
        $scope = $this->projection->scope($member);
        $run = $this->run($member, $input['device_id'], $input['recovery_id'], $input['generation'], $scope);
        if ($run->state !== 'ready') {
            throw new RecoveryException('recovery_not_ready');
        }
        $row = $this->pages($run, 'output')->where('ordinal', $input['page'])->first();
        abort_unless($row, 404);
        $page = RecoveryCodec::decode($row);
        foreach (['generation' => $run->generation, 'coverage_epoch' => $run->coverage_epoch, 'snapshot_cursor' => (string) $run->snapshot_cursor,
            'scope_digest' => $run->scope_digest, 'window_start' => $run->window_start, 'window_end' => $run->window_end, 'timezone' => $run->timezone] as $key => $expected) {
            if (($page[$key] ?? null) !== $expected) {
                throw new RecoveryException('recovery_integrity_failed');
            }
        }
        $digests = $this->pages($run, 'output')->orderBy('ordinal')->pluck('content_digest')->all();
        if (count($digests) !== $run->output_page_count || ! hash_equals($run->snapshot_manifest_digest, RecoveryCodec::manifest($digests))
            || $page['previous_digest'] !== ($input['page'] === 0 ? null : ($digests[$input['page'] - 1] ?? null))) {
            throw new RecoveryException('recovery_integrity_failed');
        }

        $this->projection->assertCurrent($scope);

        return ['recovery_id' => $run->id, 'page_digest' => $row->content_digest, 'manifest_digest' => $run->snapshot_manifest_digest,
            'page_count' => $run->output_page_count, 'client_recovered' => false, 'page' => $page];
    }

    private function metadata(object $run, array $scope): array
    {
        $metadata = ['schema' => RecoveryCodec::SCHEMA, 'recovery_id' => $run->id, 'generation' => $run->generation, 'state' => $run->state,
            'expires_at' => CarbonImmutable::parse($run->expires_at)->toISOString(), 'client_recovered' => false,
            'input_page_count' => $run->input_page_count, 'input_item_count' => $run->input_item_count,
            'output_page_count' => $run->output_page_count, 'output_item_count' => $run->output_item_count,
            'page_item_limit' => RecoveryCodec::ITEMS, 'page_byte_limit' => RecoveryCodec::PLAINTEXT,
            'limits' => ['input_pages' => $run->max_input_pages, 'output_pages' => $run->max_output_pages, 'total_items' => $run->max_items,
                'stored_bytes' => $run->max_stored_bytes, 'referenced_sessions' => 10000],
            'input_manifest_digest' => $run->input_manifest_digest, 'manifest_digest' => $run->snapshot_manifest_digest,
            'page_digests' => $run->state === 'ready' ? $this->pages($run, 'output')->orderBy('ordinal')->pluck('content_digest')->all() : [],
            'snapshot_cursor' => $run->snapshot_cursor === null ? null : (string) $run->snapshot_cursor,
            'coverage_epoch' => $run->coverage_epoch, 'window_start' => $run->window_start, 'window_end' => $run->window_end, 'timezone' => $run->timezone];
        // Recheck after all reads and required audits, inside the existing mutation savepoint.
        $this->projection->assertCurrent($scope);

        return $metadata;
    }

    private function audit(object $run, string $operation): void
    {
        app(AuditWriter::class)->record(new AuditEntry('church', 'offline.recovery.'.$operation, 'user', (string) $run->actor_id, 'system', $run->id,
            churchId: $run->church_id, deviceId: $run->device_id, metadata: ['count' => $run->output_item_count]));
    }
}
