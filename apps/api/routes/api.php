<?php

use App\Http\Controllers\Auth\ChurchAccountController;
use App\Http\Controllers\ChurchApplicationController;
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
