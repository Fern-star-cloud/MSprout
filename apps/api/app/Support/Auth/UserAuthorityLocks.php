<?php

namespace App\Support\Auth;

use App\Models\User;
use Closure;
use Illuminate\Support\Facades\DB;
use LogicException;

final class UserAuthorityLocks
{
    private ?string $transaction = null;

    private array $held = [];

    /** @param array<int, 'read'|'write'> $participants */
    public function run(array $participants, Closure $operation): mixed
    {
        $run = function () use ($participants, $operation): mixed {
            $identity = DB::selectOne('SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS xid');
            $transaction = $identity->pid.':'.$identity->xid;
            if ($this->transaction !== $transaction) {
                $this->transaction = $transaction;
                $this->held = [];
            }
            ksort($participants, SORT_NUMERIC);
            if ($this->held === [] && DB::transactionLevel() !== 1) {
                throw new LogicException('Primary User authority locks belong to the outer transaction.');
            }
            if ($this->held !== [] && array_diff_key($participants, $this->held) !== []) {
                throw new LogicException('Declare every User participant before domain work.');
            }
            $actors = [];
            foreach ($participants as $id => $mode) {
                if (! in_array($mode, ['read', 'write'], true)) {
                    throw new LogicException('Unknown User authority lock mode.');
                }
                if (isset($this->held[$id])) {
                    if ($mode === 'write' && $this->held[$id] !== 'write') {
                        throw new LogicException('Declare the strongest User lock before domain work.');
                    }
                } elseif ($this->held !== [] && $id < max(array_keys($this->held))) {
                    throw new LogicException('Global User authority locks must be acquired in numeric order.');
                }
                $actors[$id] = User::query()->whereKey($id)->lock($mode === 'write' ? 'FOR UPDATE' : 'FOR SHARE')->first();
                $this->held[$id] = $mode === 'write' ? 'write' : ($this->held[$id] ?? 'read');
            }

            return $operation($actors);
        };

        return DB::transactionLevel() > 0 ? $run() : DB::transaction($run);
    }

    public function assertWriteHeld(int $id): void
    {
        if (DB::transactionLevel() < 1 || ($this->held[$id] ?? null) !== 'write') {
            throw new LogicException('Access revocation requires a predeclared User write lock.');
        }
        $identity = DB::selectOne('SELECT pg_backend_pid() AS pid, pg_current_xact_id()::text AS xid');
        if ($this->transaction !== $identity->pid.':'.$identity->xid) {
            throw new LogicException('User authority transaction changed.');
        }
    }
}
