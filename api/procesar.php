<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

$DEV = true;
if ($DEV) { ini_set('display_errors', 1); error_reporting(E_ALL); }

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success'=>false,'message'=>'Método no permitido. Solo se aceptan solicitudes POST.']);
  exit;
}

require __DIR__.'/config.php';
$pdo = pdo_conn();

// Aceptar JSON o form-encoded
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($ct, 'application/json') !== false) {
  $input = json_decode(file_get_contents('php://input'), true);
  if (json_last_error() !== JSON_ERROR_NONE) {
    http_response_code(400);
    echo json_encode(['success'=>false,'message'=>'Datos JSON inválidos.']);
    exit;
  }
} else {
  $input = $_POST;
}

// Validaciones
$req = ['nombre','dni','email','carrera'];
$miss = array_filter($req, fn($k)=>!isset($input[$k]) || trim($input[$k])==='');
if ($miss) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'Faltan campos obligatorios: '.implode(', ', $miss)]);
  exit;
}

$nombre  = trim(strip_tags($input['nombre']));
$dni     = preg_replace('/\D+/', '', $input['dni']);
$email   = trim($input['email']);
$carrera = strtoupper(trim($input['carrera']));

if (!preg_match('/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/u', $nombre)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'El nombre solo puede contener letras y espacios.']); exit; }
if (!preg_match('/^\d{7,8}$/', $dni)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'El DNI debe tener 7 u 8 dígitos.']); exit; }
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'El formato del email no es válido.']); exit; }
if (!in_array($carrera, ['2K','5K'], true)) { http_response_code(400); echo json_encode(['success'=>false,'message'=>'Tipo de carrera no válido.']); exit; }

try {
  // Duplicado por DNI
  $st = $pdo->prepare('SELECT id FROM inscripciones WHERE dni = :dni');
  $st->execute([':dni'=>$dni]);
  if ($st->fetch()) {
    http_response_code(409);
    echo json_encode(['success'=>false,'message'=>'El DNI ya está registrado en el sistema.']);
    exit;
  }

  // Insert
  $ins = $pdo->prepare('INSERT INTO inscripciones (nombre, dni, email, carrera, fecha_inscripcion)
                        VALUES (:nombre, :dni, :email, :carrera, NOW())');
  $ins->execute([
    ':nombre'=>$nombre, ':dni'=>$dni, ':email'=>$email, ':carrera'=>$carrera
  ]);

  $id = $pdo->lastInsertId();
  echo json_encode([
    'success'=>true,
    'message'=>'Inscripción exitosa.',
    'inscripcion_id'=>$id,
    'qr_data'=>"ID: $id\nNombre: $nombre\nDNI: $dni\nEmail: $email\nCarrera: $carrera"
  ]);

} catch (PDOException $e) {
  if ($e->getCode() === '23000') {
    http_response_code(409);
    echo json_encode(['success'=>false,'message'=>'Registro duplicado (DNI o Email).']);
  } else {
    http_response_code(500);
    echo json_encode(['success'=>false,'message'=> $DEV ? $e->getMessage() : 'Error interno del servidor. Por favor, intente nuevamente más tarde.']);
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success'=>false,'message'=> $DEV ? $e->getMessage() : 'Ocurrió un error inesperado. Por favor, intente nuevamente.']);
}
