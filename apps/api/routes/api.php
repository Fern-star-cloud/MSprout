<?php

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;

Route::get('/health', function (Request $request): JsonResponse {
    $correlationId = $request->header('X-Correlation-Id');
    $correlationId = Str::isUuid($correlationId) ? $correlationId : (string) Str::uuid();

    return response()
        ->json(['status' => 'ok'])
        ->header('X-Correlation-Id', $correlationId);
});
