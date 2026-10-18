<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Cookie;
use Tests\Support\PersistedChurchSession;

abstract class TestCase extends BaseTestCase
{
    private bool $followChurchSessionCookies = false;

    public function useDatabaseCookieSessionBrowser(): void
    {
        config(['session.driver' => 'database', 'session.connection' => 'pgsql']);
        app('session')->forgetDrivers();
        app()->forgetInstance('session.store');
        $this->followChurchSessionCookies = true;
        $this->withCredentials();
    }

    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $response = parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
        if ($this->followChurchSessionCookies) {
            foreach ($response->headers->getCookies() as $cookie) {
                // Keep the separate platform surface's cookie paths independent.
                if ($cookie->getPath() === '/') {
                    $this->withUnencryptedCookie($cookie->getName(), $cookie->getValue());
                }
            }
        }

        return $response;
    }

    public function withPersistedSession(array $data)
    {
        return PersistedChurchSession::write($this, $data);
    }

    public function withPersistedSessionCookie(string $id): static
    {
        // Explicit fixture identity changes replace the browser's old encrypted cookie.
        unset($this->unencryptedCookies[config('session.cookie')]);

        return $this->withCookie(config('session.cookie'), $id);
    }

    public function startIndependentCookieBrowser(): void
    {
        $this->defaultCookies = [];
        $this->unencryptedCookies = [];
        foreach (Cookie::getQueuedCookies() as $cookie) {
            Cookie::unqueue($cookie->getName(), $cookie->getPath());
        }
    }
}
