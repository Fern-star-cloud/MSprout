<?php

use App\Http\Controllers\Auth\ChurchAccountController;
use App\Http\Controllers\ChurchApplicationController;
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
