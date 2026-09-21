<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/auth/session', function (Request $request) {
    return response()->json(['email_verified' => $request->user('web')->hasVerifiedEmail(), 'mfa_confirmed' => $request->user('web')->hasEnabledTwoFactorAuthentication()]);
})->middleware('auth:web');

Route::get('/', function () {
    return view('welcome');
});
