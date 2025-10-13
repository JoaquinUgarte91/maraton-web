<?php
// Defaults inocuos
$DB_HOST = 'localhost';
$DB_NAME = '';
$DB_USER = '';
$DB_PASS = '';

// Override servidor (NO versionado)
if (file_exists(__DIR__.'/config.server.php')) {
  require __DIR__.'/config.server.php';
}

// Override local (NO versionado)
if (file_exists(__DIR__.'/config.local.php')) {
  require __DIR__.'/config.local.php';
}

function pdo_conn(): PDO {
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
  $dsn = "mysql:host={$DB_HOST};dbname={$DB_NAME};charset=utf8mb4";
  return new PDO($dsn, $DB_USER, $DB_PASS, [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
  ]);
}
