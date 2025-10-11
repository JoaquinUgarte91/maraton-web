<?php
// ⚠️ Poné acá lo MISMO que ya te funciona en listar_inscripciones.php
$DB_HOST = 'localhost';
$DB_NAME = 'maraton_db';

// XAMPP por defecto:
$DB_USER = 'root';
$DB_PASS = '';

// Si ya creaste un usuario propio, usalo en lugar del root:
// $DB_USER = 'usuario_maraton';
// $DB_PASS = 'contraseña_segura';

function pdo_conn() {
  global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
  return new PDO(
    "mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4",
    $DB_USER,
    $DB_PASS,
    [
      PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
      PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]
  );
}
