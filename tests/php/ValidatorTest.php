<?php

declare(strict_types=1);

namespace Tests;

use App\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class ValidatorTest extends TestCase
{
    #[DataProvider('badPasswords')]
    public function testRejectsWeakPasswords(string $password): void
    {
        $this->assertNotEmpty(Validator::password($password));
    }

    /** @return array<string, array{string}> */
    public static function badPasswords(): array
    {
        return ['too short' => ['abc123'], 'no digit' => ['abcdefgh'], 'no letter' => ['12345678']];
    }

    public function testAcceptsStrongPassword(): void
    {
        $this->assertSame([], Validator::password('correct1horse'));
    }

    public function testRegistrationReportsEachInvalidField(): void
    {
        $errors = Validator::registration(['name' => ' ', 'email' => 'nope', 'password' => 'x']);
        $this->assertSame(['name', 'email', 'password'], array_keys($errors));
    }

    public function testValidRecordPasses(): void
    {
        $row = ['customer' => 'Acme', 'email' => 'a@acme.io', 'amount' => 12.5, 'date' => '2024-02-29'];
        $this->assertSame([], Validator::record($row));
    }

    public function testRecordRejectsImpossibleDate(): void
    {
        $row = ['customer' => 'Acme', 'email' => 'a@acme.io', 'amount' => 1, 'date' => '2023-02-30'];
        $this->assertNotEmpty(Validator::record($row));
    }

    public function testRecordRejectsNegativeOrNonNumericAmount(): void
    {
        $base = ['customer' => 'Acme', 'email' => 'a@acme.io', 'date' => '2024-01-01'];
        $this->assertNotEmpty(Validator::record($base + ['amount' => -1]));
        $this->assertNotEmpty(Validator::record($base + ['amount' => '12']));
    }
}
