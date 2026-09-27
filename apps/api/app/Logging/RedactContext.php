<?php

namespace App\Logging;

use App\Domain\Audit\CorrelationContext;
use Illuminate\Support\Str;
use Monolog\LogRecord;

final class RedactContext
{
    public static function apply(array $context, int $depth = 0): array
    {
        $safe = [];
        foreach ($context as $key => $value) {
            $normalized = strtolower(preg_replace('/[^a-z0-9]/i', '', (string) $key));
            $sensitive = preg_match('/password|passwd|token|authorization|cookie|child|birth|guardian|request|response|push|endpoint|secret|recovery|mfa|totp|code|proof|signature|email|name|address|credential|session|header|exception/i', $normalized);
            $safe[$key] = match (true) {
                $sensitive === 1, is_object($value), is_resource($value), $depth > 12 => '[REDACTED]',
                is_array($value) => self::apply($value, $depth + 1),
                $normalized === 'correlationid' && is_string($value) && Str::isUuid($value) => $value,
                is_string($value) => '[REDACTED]',
                default => $value,
            };
        }

        return $safe;
    }

    public function __invoke(LogRecord $record): LogRecord
    {
        $context = self::apply($record->context);
        if (function_exists('app') && app()->bound(CorrelationContext::class)) {
            $context['correlation_id'] = app(CorrelationContext::class)->id();
        }
        // Messages and exception traces can contain interpolated credentials or SQL bindings.
        $message = in_array($record->message, ['Church application operation failed.', 'Application operation failed.', 'Queue operation failed.'], true) ? $record->message : 'Application log event.';

        return $record->with(message: $message, context: $context, extra: self::apply($record->extra));
    }
}
