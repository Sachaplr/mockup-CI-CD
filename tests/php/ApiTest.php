<?php

declare(strict_types=1);

namespace Tests;

use App\Api;
use App\Database;
use PHPUnit\Framework\TestCase;

final class ApiTest extends TestCase
{
    /** @var array<string, mixed> */
    private array $session = [];
    private Api $api;

    protected function setUp(): void
    {
        $this->session = [];
        $this->api = new Api(Database::connect(':memory:'), $this->session);
    }

    /** @return array<string, string> */
    private function account(string $email = 'ada@example.com'): array
    {
        return ['name' => 'Ada', 'email' => $email, 'password' => 'secret123'];
    }

    public function testHealthEndpoint(): void
    {
        $this->assertSame([200, ['status' => 'ok']], $this->api->handle('GET', '/api/health'));
    }

    public function testUnknownRouteIs404(): void
    {
        $this->assertSame(404, $this->api->handle('GET', '/api/nope')[0]);
    }

    public function testRegisterLogsTheUserIn(): void
    {
        [$status, $payload] = $this->api->handle('POST', '/api/register', $this->account());

        $this->assertSame(201, $status);
        $this->assertSame('ada@example.com', $payload['user']['email']);
        $this->assertSame(200, $this->api->handle('GET', '/api/me')[0]);
    }

    public function testRegisterRejectsInvalidInput(): void
    {
        [$status, $payload] = $this->api->handle('POST', '/api/register', ['email' => 'x']);

        $this->assertSame(422, $status);
        $this->assertArrayHasKey('email', $payload['fields']);
    }

    public function testDuplicateEmailIsRejectedCaseInsensitively(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());

        $this->assertSame(409, $this->api->handle('POST', '/api/register', $this->account('ADA@example.com'))[0]);
    }

    public function testLoginFailsWithWrongPasswordAndSucceedsWithRightOne(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());
        $this->api->handle('POST', '/api/logout');

        $this->assertSame(401, $this->api->handle('POST', '/api/login', ['email' => 'ada@example.com', 'password' => 'wrong'])[0]);
        $this->assertSame(200, $this->api->handle('POST', '/api/login', ['email' => 'ada@example.com', 'password' => 'secret123'])[0]);
    }

    public function testProtectedRoutesRequireLogin(): void
    {
        foreach ([['GET', '/api/me'], ['GET', '/api/records'], ['POST', '/api/records/import'], ['DELETE', '/api/records']] as [$m, $p]) {
            $this->assertSame(401, $this->api->handle($m, $p)[0], "$m $p");
        }
    }

    public function testImportKeepsValidRowsAndReportsRejectedOnes(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());

        [$status, $payload] = $this->api->handle('POST', '/api/records/import', ['rows' => [
            ['customer' => 'Acme', 'email' => 'a@acme.io', 'amount' => 100.5, 'date' => '2024-01-10'],
            ['customer' => '', 'email' => 'bad', 'amount' => -5, 'date' => 'yesterday'],
            ['customer' => 'Globex', 'email' => 'g@globex.io', 'amount' => 49.5, 'date' => '2024-02-01'],
        ]]);

        $this->assertSame(200, $status);
        $this->assertSame(2, $payload['imported']);
        $this->assertSame(2, $payload['rejected'][0]['row']);

        [, $list] = $this->api->handle('GET', '/api/records');
        $this->assertSame(['count' => 2, 'total' => 150.0], $list['summary']);
        $this->assertSame('Globex', $list['records'][0]['customer']); // newest first
    }

    public function testRecordsAreIsolatedPerUser(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());
        $this->api->handle('POST', '/api/records/import', ['rows' => [
            ['customer' => 'Acme', 'email' => 'a@acme.io', 'amount' => 1, 'date' => '2024-01-10'],
        ]]);
        $this->api->handle('POST', '/api/logout');
        $this->api->handle('POST', '/api/register', $this->account('bob@example.com'));

        $this->assertSame(0, $this->api->handle('GET', '/api/records')[1]['summary']['count']);
    }

    public function testImportRejectsEmptyPayload(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());

        $this->assertSame(422, $this->api->handle('POST', '/api/records/import', ['rows' => []])[0]);
    }

    public function testClearRemovesOnlyOwnRecords(): void
    {
        $this->api->handle('POST', '/api/register', $this->account());
        $this->api->handle('POST', '/api/records/import', ['rows' => [
            ['customer' => 'Acme', 'email' => 'a@acme.io', 'amount' => 1, 'date' => '2024-01-10'],
        ]]);

        $this->assertSame(1, $this->api->handle('DELETE', '/api/records')[1]['deleted']);
        $this->assertSame(0, $this->api->handle('GET', '/api/records')[1]['summary']['count']);
    }
}
