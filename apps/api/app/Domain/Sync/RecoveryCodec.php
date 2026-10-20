<?php

namespace App\Domain\Sync;

use Illuminate\Support\Facades\Crypt;
use Throwable;

/** Server canonical form only; no change to browser envelopes or original events. */
final class RecoveryCodec
{
    public const SCHEMA = 'attendance-recovery-v1';

    public const ITEMS = 100;

    public const PLAINTEXT = 1048576;

    public const ENVELOPE = 2097152;

    public static function json(mixed $value): string
    {
        return json_encode(self::canonical($value), JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
    }

    private static function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }

        return array_map(self::canonical(...), $value);
    }

    public static function digest(mixed $value): string
    {
        return hash('sha256', self::json($value));
    }

    public static function manifest(array $digests): string
    {
        return hash('sha256', implode('', $digests));
    }

    public static function encode(array $page): array
    {
        try {
            $plain = self::json($page);
            // Never accept preserved input that the authenticated reader cannot
            // subsequently decode. The caller keeps its rejected original.
            json_decode($plain, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw new RecoveryException('recovery_manifest_invalid', 422);
        }
        if (strlen($plain) > self::PLAINTEXT || count($page['items']) > self::ITEMS) {
            throw new RecoveryException('recovery_page_too_large', 422);
        }
        $cipher = Crypt::encryptString($plain);
        if (strlen($cipher) > self::ENVELOPE) {
            throw new RecoveryException('recovery_page_too_large', 422);
        }

        return ['content_digest' => hash('sha256', $plain), 'plaintext_bytes' => strlen($plain), 'item_count' => count($page['items']), 'payload_ciphertext' => $cipher];
    }

    public static function decode(object $row): array
    {
        try {
            $plain = Crypt::decryptString($row->payload_ciphertext);
            $page = json_decode($plain, true, 64, JSON_THROW_ON_ERROR);
            if (strlen($plain) !== $row->plaintext_bytes || strlen($plain) > self::PLAINTEXT
                || ! hash_equals($row->content_digest, hash('sha256', $plain))
                || ! is_array($page) || ! is_array($page['items'] ?? null)
                || ($page['schema'] ?? null) !== self::SCHEMA
                || ! array_is_list($page['items']) || count($page['items']) !== $row->item_count
                || ! is_int($page['ordinal'] ?? null) || $page['ordinal'] !== $row->ordinal
                || ! array_key_exists('previous_digest', $page)
                || ($page['previous_digest'] !== null && (! is_string($page['previous_digest']) || ! preg_match('/\A[a-f0-9]{64}\z/', $page['previous_digest'])))) {
                throw new RecoveryException;
            }

            return $page;
        } catch (Throwable $error) {
            throw new RecoveryException('recovery_integrity_failed');
        }
    }
}
