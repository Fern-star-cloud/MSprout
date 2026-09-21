<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Session\SessionManager;
use Symfony\Component\HttpFoundation\Response;

final class UsePlatformSessionCookie
{
    public function __construct(private SessionManager $sessions) {}

    public function handle(Request $request, Closure $next): Response
    {
        $originalCookie = config('session.cookie');
        $originalPath = config('session.path');
        $session = $this->sessions->driver();
        $originalName = $session->getName();

        config([
            'session.cookie' => config('auth.platform_session_cookie'),
            'session.path' => '/platform',
        ]);
        $session->setName(config('auth.platform_session_cookie'));

        try {
            return $next($request);
        } finally {
            $session->setName($originalName);
            config([
                'session.cookie' => $originalCookie,
                'session.path' => $originalPath,
            ]);
        }
    }
}
