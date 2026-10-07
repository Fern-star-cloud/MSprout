<?php

namespace App\Providers;

use App\Domain\Audit\CorrelationContext;
use App\Support\Auth\GuardAwareDatabaseSessionHandler;
use App\Support\Captcha\CaptchaVerifier;
use App\Support\Captcha\TurnstileVerifier;
use App\Support\Notifications\PushSender;
use App\Support\Notifications\WebPushSender;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(CorrelationContext::class);
        $this->app->singleton(TenantContext::class);
        $this->app->bind(CaptchaVerifier::class, TurnstileVerifier::class);
        $this->app->bind(PushSender::class, WebPushSender::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->app->make('session')->extend('database', fn ($app) => new GuardAwareDatabaseSessionHandler(
            $app->make('db')->connection($app['config']->get('session.connection')),
            $app['config']->get('session.table'),
            $app['config']->get('session.lifetime'),
            $app,
        ));
        Event::listen(PasswordReset::class, function ($event) {
            request()->attributes->set('audit.auth_actor', $event->user->getAuthIdentifier());
        });
        Queue::createPayloadUsing(fn () => ['correlation_id' => app(CorrelationContext::class)->id()]);
        Queue::before(function ($event) {
            app(CorrelationContext::class)->start($event->job->payload()['correlation_id'] ?? null);
        });
        Queue::after(fn () => app(CorrelationContext::class)->clear());
        Queue::exceptionOccurred(fn () => app(CorrelationContext::class)->clear());
        RateLimiter::for('teacher-management', fn (Request $request) => Limit::perMinute(60)->by('teachers:'.$request->user('web')?->id));
        RateLimiter::for('teacher-invitation', fn (Request $request) => Limit::perMinute(10)->by('invitation:'.($request->user('web')?->id ?? $request->ip())));
        RateLimiter::for('ownership-transfer', fn (Request $request) => Limit::perMinute(5)->by('transfer:'.$request->user('web')?->id));
        RateLimiter::for('student-imports', fn (Request $request) => Limit::perMinute(10)->by('imports:'.$request->user('web')?->id));
        RateLimiter::for('offline-bootstrap', fn (Request $request) => Limit::perMinute(10)->by('offline-bootstrap:'.$request->user('web')?->id));
        RateLimiter::for('sync', fn (Request $request) => Limit::perMinute(120)->by('sync:'.$request->user('web')?->id));
        RateLimiter::for('notifications', fn (Request $request) => Limit::perMinute(10)->by('notifications:'.$request->user('web')?->id));
        RateLimiter::for('church-applications', fn (Request $request) => [
            Limit::perMinute(5)->by('applicant:'.$request->user('web')->id),
            Limit::perMinute(10)->by('application-ip:'.$request->ip()),
        ]);
    }
}
