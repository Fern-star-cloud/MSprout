<?php

use App\Http\Controllers\Auth\PlatformSessionController;
use Illuminate\Support\Facades\Route;

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
