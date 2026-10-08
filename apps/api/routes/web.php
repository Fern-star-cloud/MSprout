<?php

use App\Http\Controllers\Auth\ChurchSessionController;
use Illuminate\Support\Facades\Route;

Route::get('/auth/session', ChurchSessionController::class)->middleware('auth:web');

Route::get('/', function () {
    return view('welcome');
});
