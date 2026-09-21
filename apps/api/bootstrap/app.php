<?php

use App\Http\Middleware\AuthResponseHeaders;
use App\Http\Middleware\RequireConfirmedOwnerMfa;
use App\Http\Middleware\ResolveChurchMembership;
use App\Http\Middleware\TenantDatabaseTransaction;
use App\Http\Middleware\UsePlatformSessionCookie;
use App\Http\Middleware\ValidatePlatformCsrfToken;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        then: function (): void {
            Route::middleware('platform.web')
                ->prefix('platform')
                ->group(base_path('routes/platform.php'));
        },
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();
        $middleware->append(AuthResponseHeaders::class);

        $middleware->alias([
            'owner.mfa' => RequireConfirmedOwnerMfa::class,
            'tenant.resolve' => ResolveChurchMembership::class,
            'tenant.transaction' => TenantDatabaseTransaction::class,
        ]);

        $middleware->group('platform.web', [
            UsePlatformSessionCookie::class,
            EncryptCookies::class,
            AddQueuedCookiesToResponse::class,
            StartSession::class,
            ShareErrorsFromSession::class,
            ValidatePlatformCsrfToken::class,
            SubstituteBindings::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->report(function (Throwable $exception) {
            if (request()->is('api/church-applications', 'api/church-applications/*', 'platform/applications', 'platform/applications/*', 'api/teachers', 'api/teachers/*', 'api/teacher-invitations', 'api/teacher-invitations/*', 'api/ownership-transfer', 'api/assigned-ministries', 'api/assigned-ministries/*')) {
                $correlationId = request()->header('X-Correlation-Id');
                $correlationId = Str::isUuid($correlationId) ? $correlationId : (string) Str::uuid();
                Log::error('Church application operation failed.', ['correlation_id' => $correlationId]);

                return false;
            }

            return null;
        });

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request): bool => $request->expectsJson() || ! $request->is('/'),
        );

        $exceptions->render(function (Throwable $exception, Request $request) {
            if ($request->is('/') && ! $request->expectsJson()) {
                return null;
            }

            $isRowSecurityViolation = $exception instanceof QueryException
                && ($exception->errorInfo[0] ?? null) === '42501';

            $status = match (true) {
                $isRowSecurityViolation => 403,
                $exception instanceof AuthenticationException => 401,
                $exception instanceof ValidationException => $exception->status,
                $exception instanceof HttpExceptionInterface => $exception->getStatusCode(),
                default => 500,
            };

            [$code, $message] = match ($status) {
                401 => ['unauthenticated', 'Authentication is required.'],
                403 => ['forbidden', 'You are not authorized to perform this action.'],
                404 => ['not_found', 'Resource not found.'],
                409 => ['application_conflict', 'An active application or a different decision already exists.'],
                410 => ['expired', 'This setup invitation is no longer available.'],
                419 => ['csrf_mismatch', 'Refresh the session and try again.'],
                422 => ['validation_failed', 'The request could not be validated.'],
                429 => ['rate_limited', 'Too many requests. Please try again later.'],
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
                ->header('Cache-Control', 'no-store, private')
                ->header('X-Correlation-Id', $correlationId);
        });
    })
    ->create();
