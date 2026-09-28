<?php

use App\Domain\Audit\AuditWriter;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PhpOffice\PhpSpreadsheet\Shared\Date;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\Support\ChurchScenario;
use Tests\Support\MembershipScenario;
use Tests\Support\PostgresTestDatabase;

beforeEach(function () {
    PostgresTestDatabase::refresh();
    [$this->owner, $this->church] = MembershipScenario::owner($this);
});

function studentCsv(string $rows): UploadedFile
{
    return UploadedFile::fake()->createWithContent(
        'students.csv',
        "first_name,last_name,birthdate,gender,ministries,external_reference\n{$rows}",
    );
}

function studentXlsx(?callable $configure = null, string $extension = 'xlsx'): UploadedFile
{
    $book = new Spreadsheet;
    $sheet = $book->getActiveSheet();
    $sheet->fromArray(['first_name', 'last_name', 'birthdate', 'gender', 'ministries', 'external_reference'], null, 'A1');
    $sheet->fromArray(['Ari', 'Sprout', null, 'female', null, 'xlsx-1'], null, 'A2');
    if ($configure !== null) {
        $configure($book);
    }
    $path = tempnam(sys_get_temp_dir(), 'msprout-xlsx-');
    (new Xlsx($book))->save($path);
    $book->disconnectWorksheets();
    $contents = file_get_contents($path);
    unlink($path);

    return UploadedFile::fake()->createWithContent("students.{$extension}", $contents);
}

function rawXlsx(array $entries): UploadedFile
{
    $path = tempnam(sys_get_temp_dir(), 'msprout-raw-xlsx-');
    $zip = new ZipArchive;
    $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
    foreach ($entries as $name => $contents) {
        $zip->addFromString($name, $contents);
    }
    $zip->close();
    $contents = file_get_contents($path);
    unlink($path);

    return UploadedFile::fake()->createWithContent('students.xlsx', $contents);
}

it('previews without writing students then commits approved rows exactly once', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => 'Primary Kids'])->assertCreated()->json('id');
    $preview = $this->post('/api/imports/students/preview', [
        'file' => studentCsv(" Ari , Sprout ,2018-08-20,Female,Primary Kids,Member-7\nNoah,Green,,male,,"),
    ], ['Accept' => 'application/json'])->assertOk()
        ->assertJsonPath('state', 'previewed')
        ->assertJsonPath('counts.valid', 2)
        ->assertJsonCount(2, 'rows');

    expect(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(0);

    $batch = $preview->json('id');
    $rows = collect($preview->json('rows'))->pluck('id')->all();
    $key = (string) Str::uuid();
    $result = $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => $key,
        'row_ids' => $rows,
        'ministry_mappings' => [],
    ])->assertOk()->assertJsonPath('state', 'completed')->assertJsonPath('counts.committed', 2)->json();

    $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => $key,
        'row_ids' => $rows,
        'ministry_mappings' => [],
    ])->assertOk()->assertExactJson($result);
    $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => (string) Str::uuid(), 'row_ids' => $rows, 'ministry_mappings' => [],
    ])->assertConflict();

    expect(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(2)
        ->and(DB::connection('pgsql_migration')->table('enrollments')->where('ministry_id', $ministry)->count())->toBe(1)
        ->and(DB::connection('pgsql_migration')->table('audit_events')->where('action', 'student_import.completed')->where('target_id', $batch)->count())->toBe(1);
});

it('classifies invalid duplicate and unknown-ministry rows without leaking them into audit metadata', function () {
    $this->postJson('/api/students', [
        'first_name' => 'Existing', 'last_name' => 'Child', 'date_of_birth' => '2017-03-14', 'external_reference' => 'known-1',
    ])->assertCreated();

    $response = $this->post('/api/imports/students/preview', [
        'file' => studentCsv("Bad,Date,01/02/2018,,,\nFuture,Child,2099-01-01,,,\nAncient,Child,1800-01-01,,,\nExisting,Child,2017-03-14,,,known-1\nMap,Me,2019-01-01,,Unknown Group,"),
    ], ['Accept' => 'application/json'])->assertOk();

    expect($response->json('counts'))->toMatchArray(['invalid' => 3, 'duplicate' => 1, 'needs_mapping' => 1])
        ->and(json_encode(DB::connection('pgsql_migration')->table('audit_events')->pluck('metadata_json')))->not->toContain('Existing')
        ->and(json_encode(DB::connection('pgsql_migration')->table('audit_events')->pluck('metadata_json')))->not->toContain('2017-03-14');
});

it('rejects executable CSV content and files over the row limit', function () {
    $this->post('/api/imports/students/preview', [
        'file' => studentCsv('=HYPERLINK("https://example.test"),Child,,,,'),
    ], ['Accept' => 'application/json'])->assertUnprocessable();
    expect(DB::connection('pgsql_migration')->table('import_batches')->where('church_id', $this->church->id)->where('state', 'failed')->count())->toBe(1);
    foreach (['+SUM(1)', '-1', '@cmd'] as $dangerous) {
        $this->post('/api/imports/students/preview', [
            'file' => studentCsv("Ari,Sprout,,,{$dangerous},"),
        ], ['Accept' => 'application/json'])->assertUnprocessable();
    }

    $rows = implode("\n", array_fill(0, 501, 'Ari,Sprout,,,,'));
    $this->post('/api/imports/students/preview', ['file' => studentCsv($rows)], ['Accept' => 'application/json'])
        ->assertUnprocessable();
    $this->post('/api/imports/students/preview', [
        'file' => UploadedFile::fake()->create('students.csv', 5121, 'text/csv'),
    ], ['Accept' => 'application/json'])->assertUnprocessable();
});

it('downloads only the approved import template headers', function () {
    $response = $this->get('/api/imports/template')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    expect($response->getContent())->toBe("first_name,last_name,middle_name,preferred_name,suffix,birthdate,gender,ministries,external_reference\r\n");
});

it('accepts a safe XLSX with a genuine Excel date cell', function () {
    $file = studentXlsx(function (Spreadsheet $book) {
        $cell = $book->getActiveSheet()->getCell('C2');
        $cell->setValue(Date::PHPToExcel(new DateTimeImmutable('2018-08-20')));
        $cell->getStyle()->getNumberFormat()->setFormatCode('yyyy-mm-dd');
    });

    $this->post('/api/imports/students/preview', ['file' => $file], ['Accept' => 'application/json'])
        ->assertOk()->assertJsonPath('counts.valid', 1)->assertJsonPath('rows.0.data.date_of_birth', '2018-08-20');
});

it('rejects spoofed types macros formulas and unexpected worksheets', function () {
    $this->post('/api/imports/students/preview', [
        'file' => UploadedFile::fake()->createWithContent('students.xlsx', "first_name,last_name\nAri,Sprout"),
    ], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post('/api/imports/students/preview', ['file' => studentXlsx(null, 'xlsm')], ['Accept' => 'application/json'])
        ->assertUnprocessable();
    $this->post('/api/imports/students/preview', [
        'file' => studentXlsx(fn (Spreadsheet $book) => $book->getActiveSheet()->setCellValue('D2', '=1+1')),
    ], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post('/api/imports/students/preview', [
        'file' => studentXlsx(fn (Spreadsheet $book) => $book->createSheet()->setTitle('Unexpected')),
    ], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post('/api/imports/students/preview', ['file' => rawXlsx([
        '[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => '<workbook><broken>',
    ])], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post('/api/imports/students/preview', ['file' => rawXlsx([
        '[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => '<workbook/>',
        'xl/externalLinks/externalLink1.xml' => '<externalLink/>',
    ])], ['Accept' => 'application/json'])->assertUnprocessable();
    $this->post('/api/imports/students/preview', ['file' => rawXlsx([
        '[Content_Types].xml' => '<Types/>', 'xl/workbook.xml' => '<workbook/>', 'xl/bomb.txt' => str_repeat('A', 1024 * 1024),
    ])], ['Accept' => 'application/json'])->assertUnprocessable();
});

it('hides cross-church batches', function () {
    $this->post('/api/imports/students/preview', [
        'file' => studentCsv('Ari,Sprout,2018-08-20,,,'),
    ], ['Accept' => 'application/json'])->assertOk();

    [, $otherChurch] = ChurchScenario::owner();
    $foreignBatch = (string) Str::uuid();
    DB::connection('pgsql_migration')->table('import_batches')->insert([
        'id' => $foreignBatch, 'church_id' => $otherChurch->id, 'uploaded_by_user_id' => $this->owner->id,
        'state' => 'previewed', 'file_sha256' => str_repeat('a', 64), 'file_extension' => 'csv',
        'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now(),
    ]);
    $this->getJson("/api/imports/{$foreignBatch}")->assertNotFound();

    $visible = app(TenantContext::class)->run(
        $this->church->id,
        fn () => DB::table('import_batches')->where('id', $foreignBatch)->exists(),
    );
    expect($visible)->toBeFalse();
    expect(fn () => app(TenantContext::class)->run($this->church->id, fn () => DB::table('import_batches')->insert([
        'id' => (string) Str::uuid(), 'church_id' => $otherChurch->id, 'uploaded_by_user_id' => $this->owner->id,
        'state' => 'previewed', 'file_sha256' => str_repeat('b', 64), 'file_extension' => 'csv',
        'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now(),
    ])))->toThrow(QueryException::class);
});

it('denies Teachers all import capabilities', function () {
    $batch = $this->post('/api/imports/students/preview', [
        'file' => studentCsv('Ari,Sprout,2018-08-20,,,'),
    ], ['Accept' => 'application/json'])->assertOk()->json('id');
    [$teacher] = ChurchScenario::teacher($this->church);
    $teacher = User::findOrFail($teacher->id);
    $this->actingAs($teacher, 'web')->withSession(['password_hash_web' => $teacher->getAuthPassword()]);
    $this->getJson("/api/imports/{$batch}")->assertForbidden();
    $this->getJson('/api/imports/template')->assertForbidden();
    $this->post('/api/imports/students/preview', ['file' => studentCsv('No,Access,,,,')], ['Accept' => 'application/json'])
        ->assertForbidden();
});

it('requires same-church ministry mappings before committing unknown ministries', function () {
    $ministry = $this->postJson('/api/ministries', ['name' => 'Primary Kids'])->assertCreated()->json('id');
    [, $otherChurch] = ChurchScenario::owner();
    $foreignMinistry = MembershipScenario::ministry($otherChurch->id);
    $preview = $this->post('/api/imports/students/preview', [
        'file' => studentCsv('Ari,Sprout,2018-08-20,,Unknown Group,map-1'),
    ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('counts.needs_mapping', 1);
    $batch = $preview->json('id');
    $row = $preview->json('rows.0.id');
    $key = (string) Str::uuid();

    $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => $key, 'row_ids' => [$row], 'ministry_mappings' => ['Unknown Group' => $foreignMinistry],
    ])->assertUnprocessable();
    $this->getJson("/api/imports/{$batch}")->assertOk()->assertJsonPath('state', 'previewed');
    $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => $key, 'row_ids' => [$row], 'ministry_mappings' => ['Unknown Group' => $ministry],
    ])->assertOk()->assertJsonPath('counts.committed', 1);
    expect(DB::connection('pgsql_migration')->table('enrollments')->where('ministry_id', $ministry)->count())->toBe(1);
});

it('expires stale previews without creating students', function () {
    $preview = $this->post('/api/imports/students/preview', [
        'file' => studentCsv('Ari,Sprout,2018-08-20,,,expire-1'),
    ], ['Accept' => 'application/json'])->assertOk();
    $batch = $preview->json('id');
    DB::connection('pgsql_migration')->table('import_batches')->where('id', $batch)->update(['expires_at' => now()->subMinute()]);

    $this->getJson("/api/imports/{$batch}")->assertOk()->assertJsonPath('state', 'expired');
    $this->postJson("/api/imports/{$batch}/commit", [
        'commit_key' => (string) Str::uuid(), 'row_ids' => [$preview->json('rows.0.id')], 'ministry_mappings' => [],
    ])->assertStatus(410)->assertJsonPath('state', 'expired');
    expect(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(0);
});

it('rolls back imported students when the required batch audit cannot persist', function () {
    $preview = $this->post('/api/imports/students/preview', [
        'file' => studentCsv('Ari,Sprout,2018-08-20,,,audit-rollback'),
    ], ['Accept' => 'application/json'])->assertOk();
    $this->mock(AuditWriter::class, function ($mock) {
        $mock->shouldReceive('record')->once()->andThrow(new RuntimeException('private child detail'));
    });

    $response = $this->postJson('/api/imports/'.$preview->json('id').'/commit', [
        'commit_key' => (string) Str::uuid(), 'row_ids' => [$preview->json('rows.0.id')], 'ministry_mappings' => [],
    ])->assertStatus(500)->assertJsonPath('code', 'internal_error');
    expect(json_encode($response->json()))->not->toContain('private child detail')
        ->and(DB::connection('pgsql_migration')->table('students')->where('church_id', $this->church->id)->count())->toBe(0)
        ->and(DB::connection('pgsql_migration')->table('import_batches')->where('id', $preview->json('id'))->value('state'))->toBe('previewed');
});
