<?php

namespace App\Support\Auth;

use App\Models\User;
use Illuminate\Session\DatabaseSessionHandler;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Auth;

final class GuardAwareDatabaseSessionHandler extends DatabaseSessionHandler
{
    private ?int $writingActor = null;

    public function write($sessionId, $data): bool
    {
        if ($this->container->make('request')->is('platform/*')) {
            return parent::write($sessionId, $data);
        }
        $claims = DatabaseSessionAuthority::decode($data);
        $guardKey = Auth::guard('web')->getName();
        $actorId = $claims[$guardKey] ?? null;
        if ($actorId === null) {
            return parent::write($sessionId, $data);
        }

        return $this->connection->transaction(function () use ($sessionId, $claims, $guardKey, $actorId): bool {
            // This ordering also applies after the HTTP operation's transaction commits.
            $actor = User::on($this->connection->getName())->whereKey($actorId)->sharedLock()->first();
            if ($actor === null) {
                return true;
            }
            $row = $this->getQuery()->where('id', $sessionId)->lockForUpdate()->first();
            $permit = $this->container->make('request')->attributes->get(AuthenticatedSessionWritePermit::ATTRIBUTE);
            $permitted = $permit instanceof AuthenticatedSessionWritePermit && $permit->allows($sessionId, $actor);
            $current = $row === null || $this->expired($row) ? [] : DatabaseSessionAuthority::decode(base64_decode($row->payload));
            if ($current === [] && ! ($permitted && $permit->admission)) {
                return true;
            }
            if (! $permitted && (($current[$guardKey] ?? null) !== $actor->id || (string) ($row->user_id ?? '') !== (string) $actor->id)) {
                // A delayed writer cannot resurrect a missing/revoked principal.
                return true;
            }
            $safe = $claims;
            foreach (DatabaseSessionAuthority::securityKeys() as $key) {
                Arr::forget($safe, $key);
                $authority = $permitted ? $permit->claims : $current;
                if (Arr::has($authority, $key)) {
                    Arr::set($safe, $key, Arr::get($authority, $key));
                }
            }
            $this->writingActor = (int) $actor->id;
            $this->exists = $row !== null;
            try {
                return parent::write($sessionId, DatabaseSessionAuthority::encode($safe));
            } finally {
                $this->writingActor = null;
            }
        });
    }

    protected function userId(): mixed
    {
        // sessions.user_id belongs to integer church identities, never platform UUIDs.
        // Platform authentication is restored from its separate guard key in the payload.
        if ($this->container->make('request')->is('platform/*')) {
            return null;
        }

        return $this->writingActor ?? $this->container->make('auth')->guard('web')->id();
    }
}
