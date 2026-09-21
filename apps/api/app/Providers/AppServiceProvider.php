<?php

namespace App\Providers;

use App\Support\Captcha\CaptchaVerifier;
use App\Support\Captcha\TurnstileVerifier;
use App\Support\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TenantContext::class);
        $this->app->bind(CaptchaVerifier::class, TurnstileVerifier::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('teacher-management', fn (Request $request) => Limit::perMinute(60)->by('teachers:'.$request->user('web')?->id));
        RateLimiter::for('teacher-invitation', fn (Request $request) => Limit::perMinute(10)->by('invitation:'.($request->user('web')?->id ?? $request->ip())));
        RateLimiter::for('ownership-transfer', fn (Request $request) => Limit::perMinute(5)->by('transfer:'.$request->user('web')?->id));
        RateLimiter::for('church-applications', fn (Request $request) => [
            Limit::perMinute(5)->by('applicant:'.$request->user('web')->id),
            Limit::perMinute(10)->by('application-ip:'.$request->ip()),
        ]);
    }
}
