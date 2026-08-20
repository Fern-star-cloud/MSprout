<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Validation\ValidationException;

it('returns the contract health shape', function () {
    $correlationId = '824d6d37-986f-4b31-849a-1c9276ee6fbf';

    $this->withHeader('X-Correlation-Id', $correlationId)
        ->getJson('/api/health')
        ->assertOk()
        ->assertExactJson(['status' => 'ok'])
        ->assertHeader('X-Correlation-Id', $correlationId);
});

it('returns a safe error envelope for unknown API routes', function () {
    $this->getJson('/api/not-a-route')
        ->assertNotFound()
        ->assertJsonPath('code', 'not_found')
        ->assertJsonPath('message', 'Resource not found.')
        ->assertJsonStructure(['correlation_id'])
        ->assertJsonMissingPath('exception');
});

it('returns validation errors without exposing the exception', function () {
    Route::get('/api/validation-error', fn () => throw ValidationException::withMessages([
        'name' => ['The name field is required.'],
    ]));

    $this->getJson('/api/validation-error')
        ->assertUnprocessable()
        ->assertJsonPath('code', 'validation_failed')
        ->assertJsonPath('message', 'The request could not be validated.')
        ->assertJsonPath('field_errors.name.0', 'The name field is required.')
        ->assertJsonStructure(['correlation_id'])
        ->assertJsonMissingPath('exception');
});
