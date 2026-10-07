<?php

namespace App\Support\Auth;

use Illuminate\Session\DatabaseSessionHandler;

final class GuardAwareDatabaseSessionHandler extends DatabaseSessionHandler
{
    protected function userId(): mixed
    {
        // sessions.user_id belongs to integer church identities, never platform UUIDs.
        // Platform authentication is restored from its separate guard key in the payload.
        if ($this->container->make('request')->is('platform/*')) {
            return null;
        }

        return $this->container->make('auth')->guard('web')->id();
    }
}
