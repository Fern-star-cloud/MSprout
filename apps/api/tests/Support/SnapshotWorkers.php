<?php

namespace Tests\Support;

final class SnapshotWorkers
{
    private static array $workers = [];

    public static function start(array $fixture, string $path, array $body, string $method = 'POST'): array
    {
        IntegrationScenario::guard();
        $process = proc_open([PHP_BINARY, base_path('tests/Support/snapshot-worker.php')], [['pipe', 'r'], ['pipe', 'w'], ['pipe', 'w']], $pipes, base_path());
        if (! is_resource($process)) {
            throw new \RuntimeException('Snapshot worker unavailable.');
        }
        fwrite($pipes[0], json_encode(['church' => $fixture['church']->id, 'cookies' => $fixture['cookies'], 'path' => $path, 'body' => $body, 'method' => $method], JSON_THROW_ON_ERROR)."\n");
        $worker = [$process, $pipes, AuthorityScenario::line($pipes[1])];
        self::$workers[] = $worker;

        return $worker;
    }

    public static function enter(array $worker): void
    {
        fwrite($worker[1][0], "enter\n");
    }

    public static function cleanup(): void
    {
        foreach (self::$workers as $worker) {
            if (is_resource($worker[0])) {
                fclose($worker[1][0]);
                fclose($worker[1][1]);
                $error = stream_get_contents($worker[1][2]);
                fclose($worker[1][2]);
                if ($error !== '') {
                    file_put_contents('/evidence/snapshot-worker-error-'.bin2hex(random_bytes(5)).'.log', $error);
                }
                proc_close($worker[0]);
            }
        }
        self::$workers = [];
    }
}
