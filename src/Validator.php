<?php

declare(strict_types=1);

namespace App;

use DateTimeImmutable;

/** Server-side validation. Mirrors web/src/validators.js: never trust the client. */
final class Validator
{
    public const MAX_IMPORT_ROWS = 5000;

    public static function email(mixed $value): bool
    {
        return is_string($value) && strlen($value) <= 254
            && filter_var($value, FILTER_VALIDATE_EMAIL) !== false;
    }

    /** @return list<string> */
    public static function password(mixed $value): array
    {
        $errors = [];
        if (!is_string($value) || strlen($value) < 8) {
            $errors[] = 'Password must be at least 8 characters';
        }
        if (!is_string($value) || !preg_match('/[A-Za-z]/', $value) || !preg_match('/\d/', $value)) {
            $errors[] = 'Password must contain a letter and a digit';
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, string>
     */
    public static function registration(array $data): array
    {
        $errors = [];
        $name = $data['name'] ?? null;
        if (!is_string($name) || trim($name) === '' || mb_strlen($name) > 100) {
            $errors['name'] = 'Name is required (max 100 characters)';
        }
        if (!self::email($data['email'] ?? null)) {
            $errors['email'] = 'Enter a valid email address';
        }
        $passwordErrors = self::password($data['password'] ?? null);
        if ($passwordErrors !== []) {
            $errors['password'] = $passwordErrors[0];
        }

        return $errors;
    }

    /**
     * @param array<string, mixed> $row
     * @return list<string>
     */
    public static function record(array $row): array
    {
        $errors = [];

        $customer = $row['customer'] ?? null;
        if (!is_string($customer) || trim($customer) === '' || mb_strlen($customer) > 120) {
            $errors[] = 'customer is required (max 120 characters)';
        }
        if (!self::email($row['email'] ?? null)) {
            $errors[] = 'email is invalid';
        }
        $amount = $row['amount'] ?? null;
        if (!is_int($amount) && !is_float($amount) || $amount < 0 || $amount > 1_000_000_000) {
            $errors[] = 'amount must be a number between 0 and 1,000,000,000';
        }
        $date = $row['date'] ?? null;
        $parsed = is_string($date) ? DateTimeImmutable::createFromFormat('!Y-m-d', $date) : false;
        if ($parsed === false || $parsed->format('Y-m-d') !== $date) {
            $errors[] = 'date must be a real date formatted YYYY-MM-DD';
        }

        return $errors;
    }
}
