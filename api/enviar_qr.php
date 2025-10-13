<?php
// /public_html/api/enviar_qr.php

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success'=>false,'message'=>'Método no permitido']);
  exit;
}

// ======== CONFIGURA ESTO ========
$FROM_EMAIL = 'no-reply@peachpuff-pheasant-847443.hostingersite.com'; // o un correo propio del dominio
$FROM_NAME  = 'Maratón Ituzaingó';
$SUBJECT    = 'Tu QR de inscripción - Maratón Ituzaingó';
// =================================

// Leer JSON
$input = json_decode(file_get_contents('php://input'), true) ?: [];
$to       = trim($input['to']   ?? '');
$name     = trim($input['name'] ?? '');
$dni      = trim($input['dni']  ?? '');
$carrera  = trim($input['carrera'] ?? '');
$dataUrl  = $input['qr_png_base64'] ?? '';

if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'Email destino inválido']);
  exit;
}
if (!preg_match('#^data:image/(png|gif|jpeg);base64,#i', $dataUrl)) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'QR inválido (base64)']);
  exit;
}

// Extraer y decodificar base64
$base64 = preg_replace('#^data:image/\w+;base64,#i', '', $dataUrl);
$binary = base64_decode($base64, true);
if ($binary === false) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'No se pudo decodificar el QR']);
  exit;
}

// Armar cuerpo simple
$bodyText = "¡Gracias por inscribirte!\n\n".
            "Nombre: {$name}\n".
            "DNI: {$dni}\n".
            "Carrera: {$carrera}\n\n".
            "Adjuntamos tu QR para presentar al retirar el kit.";

// Construir email MIME con adjunto
$boundary = 'b'.md5(uniqid('', true));
$headers  = [];
$headers[] = "From: {$FROM_NAME} <{$FROM_EMAIL}>";
$headers[] = "MIME-Version: 1.0";
$headers[] = "Content-Type: multipart/mixed; boundary=\"{$boundary}\"";

$filename = "qr_ituzaingo.png";
$attachment = chunk_split(base64_encode($binary));

$message =
"--{$boundary}\r\n".
"Content-Type: text/plain; charset=UTF-8\r\n".
"Content-Transfer-Encoding: 8bit\r\n\r\n".
$bodyText."\r\n\r\n".
"--{$boundary}\r\n".
"Content-Type: image/png; name=\"{$filename}\"\r\n".
"Content-Transfer-Encoding: base64\r\n".
"Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n".
$attachment."\r\n".
"--{$boundary}--\r\n";

// Importante para Return-Path (mejor deliverability)
$extra = "-f{$FROM_EMAIL}";

$ok = @mail($to, $SUBJECT, $message, implode("\r\n", $headers), $extra);

if (!$ok) {
  http_response_code(500);
  echo json_encode(['success'=>false,'message'=>'No se pudo enviar el correo (mail() falló)']);
  exit;
}

echo json_encode(['success'=>true]);
