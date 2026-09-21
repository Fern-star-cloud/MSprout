<?php

use App\Http\Controllers\Auth\PlatformSessionController;
use App\Http\Controllers\Platform\ApplicationReviewController;
use App\Http\Middleware\ApplicationRequest;
use App\Http\Middleware\RequirePlatformReview;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth:platform', RequirePlatformReview::class, ApplicationRequest::class])->group(function () {
    Route::get('/applications', [ApplicationReviewController::class, 'index']);
    Route::get('/applications/{id}', [ApplicationReviewController::class, 'show'])->whereUuid('id');
    Route::post('/applications/{id}/approve', [ApplicationReviewController::class, 'approve'])->whereUuid('id');
    Route::post('/applications/{id}/reject', [ApplicationReviewController::class, 'reject'])->whereUuid('id');
});

Route::get('/csrf-token', [PlatformSessionController::class, 'csrfToken']);
Route::get('/setup/{platformAdmin}', [PlatformSessionController::class, 'setupStatus'])
    ->middleware(['signed', 'throttle:10,1'])
    ->name('platform.setup.show');
Route::get('/me', [PlatformSessionController::class, 'show'])->middleware('auth:platform');
Route::post('/setup/{platformAdmin}', [PlatformSessionController::class, 'setup'])->middleware(['signed', 'throttle:10,1']);
Route::post('/setup/{platformAdmin}/confirm', [PlatformSessionController::class, 'confirmSetup'])->middleware('throttle:5,1');
Route::post('/login', [PlatformSessionController::class, 'login'])->middleware('throttle:5,1');
Route::post('/two-factor-challenge', [PlatformSessionController::class, 'challenge'])->middleware('throttle:5,1');
Route::post('/logout', [PlatformSessionController::class, 'logout']);
