<?php

use App\Http\Controllers\AttendanceReviewController;
use App\Http\Controllers\AuditController;
use App\Http\Controllers\Auth\ChurchAccountController;
use App\Http\Controllers\ChurchApplicationController;
use App\Http\Controllers\OfflineBootstrapController;
use App\Http\Controllers\RosterController;
use App\Http\Controllers\StudentImportController;
use App\Http\Controllers\SyncController;
use App\Http\Controllers\TeacherManagementController;
use App\Http\Middleware\ApplicationRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::middleware(['auth:web', 'verified', ApplicationRequest::class])->group(function () {
    Route::get('/church-applications/current', [ChurchApplicationController::class, 'current']);
    Route::post('/church-applications', [ChurchApplicationController::class, 'store'])->middleware('throttle:church-applications');
});

Route::get('/health', function (Request $request): JsonResponse {
    $correlationId = $request->header('X-Correlation-Id');
    $correlationId = Str::isUuid($correlationId) ? $correlationId : (string) Str::uuid();

    return response()
        ->json(['status' => 'ok'])
        ->header('X-Correlation-Id', $correlationId);
});

Route::get('/me', ChurchAccountController::class)
    ->middleware([
        'auth:sanctum',
        'verified',
        'tenant.resolve',
        'tenant.transaction',
        'owner.mfa',
    ]);

Route::get('/audit-events', [AuditController::class, 'church'])
    ->middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa']);

Route::get('/offline/bootstrap', OfflineBootstrapController::class)
    ->middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', 'throttle:offline-bootstrap']);

Route::middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', 'throttle:sync'])->group(function () {
    Route::post('/sync/push', [SyncController::class, 'push']);
    Route::get('/sync/pull', [SyncController::class, 'pull']);
});

Route::middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', 'throttle:sync'])->group(function () {
    Route::get('/sync-conflicts', [AttendanceReviewController::class, 'conflicts']);
    Route::get('/sync-conflicts/{id}', [AttendanceReviewController::class, 'conflict'])->whereUuid('id');
    Route::post('/sync-conflicts/{id}/resolve', [AttendanceReviewController::class, 'resolve'])->whereUuid('id');
    Route::post('/attendance-sessions/{session}/records/{record}/corrections', [AttendanceReviewController::class, 'correct'])
        ->whereUuid('session')->whereUuid('record');
    Route::get('/attendance-guests', [AttendanceReviewController::class, 'guests']);
    Route::post('/attendance-guests/{id}/{resolution}', [AttendanceReviewController::class, 'guest'])
        ->whereUuid('id')->whereIn('resolution', ['promote', 'link', 'merge']);
});

Route::post('/teacher-invitations/accept', [TeacherManagementController::class, 'accept'])
    ->middleware([ApplicationRequest::class, 'throttle:teacher-invitation']);

Route::middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', ApplicationRequest::class, 'throttle:teacher-management'])->group(function () {
    Route::get('/teachers', [TeacherManagementController::class, 'index']);
    Route::get('/teacher-invitations', [TeacherManagementController::class, 'invitations']);
    Route::post('/teacher-invitations', [TeacherManagementController::class, 'invite'])->middleware('throttle:teacher-invitation');
    Route::delete('/teacher-invitations/{id}', [TeacherManagementController::class, 'revokeInvitation'])->whereUuid('id');
    Route::put('/teachers/{id}/assignments', [TeacherManagementController::class, 'assign'])->whereUuid('id');
    Route::delete('/teachers/{id}', [TeacherManagementController::class, 'revoke'])->whereUuid('id');
    Route::post('/ownership-transfer', [TeacherManagementController::class, 'transfer'])->middleware('throttle:ownership-transfer');
    Route::get('/assigned-ministries', [TeacherManagementController::class, 'ministries']);
    Route::get('/assigned-ministries/{id}', [TeacherManagementController::class, 'ministries'])->whereUuid('id');
});

Route::middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', ApplicationRequest::class])->group(function () {
    Route::get('/ministries', [RosterController::class, 'ministries']);
    Route::post('/ministries', [RosterController::class, 'createMinistry']);
    Route::put('/ministries/{id}', [RosterController::class, 'updateMinistry'])->whereUuid('id');
    Route::post('/ministries/{id}/{status}', [RosterController::class, 'ministryStatus'])->whereUuid('id')->whereIn('status', ['archive', 'restore']);
    Route::get('/students', [RosterController::class, 'students']);
    Route::get('/students/{id}', [RosterController::class, 'showStudent'])->whereUuid('id');
    Route::post('/students', [RosterController::class, 'createStudent']);
    Route::put('/students/{id}', [RosterController::class, 'updateStudent'])->whereUuid('id');
    Route::post('/students/{id}/{status}', [RosterController::class, 'studentStatus'])->whereUuid('id')->whereIn('status', ['archive', 'restore']);
    Route::put('/students/{id}/enrollments', [RosterController::class, 'enroll'])->whereUuid('id');
});

Route::middleware(['auth:web', 'verified', 'tenant.resolve', 'tenant.transaction', 'owner.mfa', 'throttle:student-imports'])->group(function () {
    Route::post('/imports/students/preview', [StudentImportController::class, 'preview']);
    Route::post('/imports/{batch}/commit', [StudentImportController::class, 'commit'])->whereUuid('batch');
    Route::get('/imports/{batch}', [StudentImportController::class, 'show'])->whereUuid('batch');
    Route::get('/imports/template', [StudentImportController::class, 'template']);
});
