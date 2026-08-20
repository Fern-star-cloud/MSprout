<?php

use App\Http\Middleware\ResolveChurchMembership;
use App\Http\Middleware\TenantDatabaseTransaction;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'tenant.resolve' => ResolveChurchMembership::class,
            'tenant.transaction' => TenantDatabaseTransaction::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->is('api/*'),
        );

        $exceptions->render(function (Throwable $exception, Request $request) {
            if (! $request->is('api/*')) {
                return null;
            }

            $isRowSecurityViolation = $exception instanceof QueryException
                && ($exception->errorInfo[0] ?? null) === '42501';

            $status = match (true) {
                $isRowSecurityViolation => 403,
                $exception instanceof ValidationException => $exception->status,
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                default => 500,
            };

            [$code, $message] = match ($status) {
                401 => ['unauthenticated', 'Authentication is required.'],
                403 => ['forbidden', 'You are not authorized to perform this action.'],
                404 => ['not_found', 'Resource not found.'],
                422 => ['validation_failed', 'The request could not be validated.'],
                default => ['internal_error', 'An unexpected server error occurred.'],
            };

            $correlationId = $request->header('X-Correlation-Id');
            $correlationId = Str::isUuid($correlationId) ? $correlationId : (string) Str::uuid();

            $payload = [
                'code' => $code,
                'message' => $message,
                'correlation_id' => $correlationId,
            ];

            if ($exception instanceof ValidationException) {
                $payload['field_errors'] = $exception->errors();
            }

            return response()
                ->json($payload, $status)
                ->header('X-Correlation-Id', $correlationId);
        });
    })
    ->create();
