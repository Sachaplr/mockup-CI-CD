<?php

declare(strict_types=1);

// Front controller / router for `php -S`. Serves /api/* from PHP and everything else as the SPA.
require __DIR__ . '/../src/autoload.php';

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

if (!str_starts_with($path, '/api/')) {
    if ($path !== '/' && is_file(__DIR__ . $path)) {
        return false; // let the built-in server serve static assets
    }
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/index.html');

    return true;
}

session_set_cookie_params(['httponly' => true, 'samesite' => 'Lax']);
session_start();

$dbPath = getenv('APP_DB') ?: __DIR__ . '/../var/app.sqlite';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$raw = file_get_contents('php://input');
$body = $raw !== '' && $raw !== false ? json_decode($raw, true) : [];

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);

    return true;
}

try {
    $api = new App\Api(App\Database::connect($dbPath), $_SESSION);
    [$status, $payload] = $api->handle($method, $path, $body);
    if ($path === '/api/login' && $status === 200) {
        session_regenerate_id(true); // prevent session fixation
    }
} catch (Throwable $e) {
    error_log((string) $e);
    $status = 500;
    $payload = ['error' => 'Internal server error'];
}

http_response_code($status);
echo json_encode($payload);

return true;
