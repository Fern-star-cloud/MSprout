<?php

use App\Http\Controllers\Platform\SystemHealthController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Route;

Route::get('/health/live', fn (): JsonResponse => response()->json(['status' => 'ok']));
Route::get('/health/ready', [SystemHealthController::class, 'readiness'])->middleware('throttle:60,1');
