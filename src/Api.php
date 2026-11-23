<?php

declare(strict_types=1);

namespace App;

use PDO;
use PDOException;

/**
 * Framework-free JSON API. handle() takes plain values and returns [status, payload],
 * so it can be unit-tested without an HTTP server.
 */
final class Api
{
    /** @var array<string, mixed> */
    private array $session;

    /** @param array<string, mixed> $session Usually $_SESSION, passed by reference. */
    public function __construct(private PDO $pdo, array &$session)
    {
        $this->session = &$session;
    }

    /**
     * @param array<string, mixed> $body
     * @return array{0: int, 1: array<string, mixed>}
     */
    public function handle(string $method, string $path, array $body = []): array
    {
        return match ("$method $path") {
            'GET /api/health' => [200, ['status' => 'ok']],
            'POST /api/register' => $this->register($body),
            'POST /api/login' => $this->login($body),
            'POST /api/logout' => $this->logout(),
            'GET /api/me' => $this->requireUser(fn (array $u) => [200, ['user' => $u]]),
            'GET /api/records' => $this->requireUser(fn (array $u) => $this->listRecords($u)),
            'POST /api/records/import' => $this->requireUser(fn (array $u) => $this->import($u, $body)),
            'DELETE /api/records' => $this->requireUser(fn (array $u) => $this->clearRecords($u)),
            default => [404, ['error' => 'Not found']],
        };
    }

    /** @param array<string, mixed> $body */
    private function register(array $body): array
    {
        $errors = Validator::registration($body);
        if ($errors !== []) {
            return [422, ['error' => 'Validation failed', 'fields' => $errors]];
        }

        $email = strtolower(trim($body['email']));
        try {
            $stmt = $this->pdo->prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
            $stmt->execute([trim($body['name']), $email, password_hash($body['password'], PASSWORD_DEFAULT)]);
        } catch (PDOException $e) {
            if (str_contains($e->getMessage(), 'UNIQUE')) {
                return [409, ['error' => 'An account with this email already exists']];
            }
            throw $e;
        }

        $user = ['id' => (int) $this->pdo->lastInsertId(), 'name' => trim($body['name']), 'email' => $email];
        $this->session['user'] = $user;

        return [201, ['user' => $user]];
    }

    /** @param array<string, mixed> $body */
    private function login(array $body): array
    {
        $email = is_string($body['email'] ?? null) ? strtolower(trim($body['email'])) : '';
        $password = is_string($body['password'] ?? null) ? $body['password'] : '';

        $stmt = $this->pdo->prepare('SELECT id, name, email, password_hash FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if ($row === false || !password_verify($password, $row['password_hash'])) {
            return [401, ['error' => 'Invalid email or password']];
        }

        $user = ['id' => (int) $row['id'], 'name' => $row['name'], 'email' => $row['email']];
        $this->session['user'] = $user;

        return [200, ['user' => $user]];
    }

    private function logout(): array
    {
        $this->session = [];

        return [200, ['ok' => true]];
    }

    private function requireUser(callable $next): array
    {
        $user = $this->session['user'] ?? null;
        if (!is_array($user)) {
            return [401, ['error' => 'Authentication required']];
        }

        return $next($user);
    }

    /** @param array<string, mixed> $user */
    private function listRecords(array $user): array
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, customer, email, amount, order_date AS date FROM records WHERE user_id = ? ORDER BY order_date DESC, id DESC'
        );
        $stmt->execute([$user['id']]);
        $records = array_map(static function (array $r): array {
            $r['amount'] = (float) $r['amount'];

            return $r;
        }, $stmt->fetchAll());

        $total = array_sum(array_column($records, 'amount'));

        return [200, ['records' => $records, 'summary' => ['count' => count($records), 'total' => round($total, 2)]]];
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $body
     */
    private function import(array $user, array $body): array
    {
        $rows = $body['rows'] ?? null;
        if (!is_array($rows) || !array_is_list($rows) || $rows === []) {
            return [422, ['error' => 'rows must be a non-empty list']];
        }
        if (count($rows) > Validator::MAX_IMPORT_ROWS) {
            return [413, ['error' => 'Too many rows (max ' . Validator::MAX_IMPORT_ROWS . ')']];
        }

        $valid = [];
        $rejected = [];
        foreach ($rows as $i => $row) {
            $errors = is_array($row) ? Validator::record($row) : ['row must be an object'];
            if ($errors === []) {
                $valid[] = $row;
            } else {
                $rejected[] = ['row' => $i + 1, 'errors' => $errors];
            }
        }

        $this->pdo->beginTransaction();
        $stmt = $this->pdo->prepare(
            'INSERT INTO records (user_id, customer, email, amount, order_date) VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($valid as $row) {
            $stmt->execute([$user['id'], trim($row['customer']), strtolower($row['email']), $row['amount'], $row['date']]);
        }
        $this->pdo->commit();

        return [200, ['imported' => count($valid), 'rejected' => $rejected]];
    }

    /** @param array<string, mixed> $user */
    private function clearRecords(array $user): array
    {
        $stmt = $this->pdo->prepare('DELETE FROM records WHERE user_id = ?');
        $stmt->execute([$user['id']]);

        return [200, ['deleted' => $stmt->rowCount()]];
    }
}
