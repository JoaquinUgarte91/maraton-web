<?php
// public_html/api/enviar_qr.php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success'=>false,'message'=>'Método no permitido.']);
  exit;
}

// Lee JSON o form-data
$ct = $_SERVER['CONTENT_TYPE'] ?? '';
$input = [];
if (stripos($ct, 'application/json') !== false) {
  $raw = file_get_contents('php://input');
  $input = json_decode($raw, true);
  if (!is_array($input)) { $input = []; }
} else {
  $input = $_POST; // por si en algún momento lo llamás como form-data
}

// Normaliza campos (acepta alias)
$toEmail  = $input['to']      ?? $input['email']   ?? '';
$name     = $input['name']    ?? $input['nombre']  ?? 'Participante';
$dni      = $input['dni']     ?? '';
$carrera  = $input['carrera'] ?? '';
$qrTexto  = $input['qr_texto'] ?? '';
$qrData   = $input['qr_png_base64'] ?? $input['qr_png'] ?? '';

// Valida email
$toEmail = filter_var(trim($toEmail), FILTER_VALIDATE_EMAIL);
if (!$toEmail) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'Email destino inválido']);
  exit;
}
$name = trim($name);

// Toma el base64 del PNG (admite DataURL)
if (strpos($qrData, 'data:image') === 0) {
  // formato data:image/png;base64,xxxxx
  if (preg_match('#^data:image/\w+;base64,(.*)$#', $qrData, $m)) {
    $qrData = $m[1];
  }
}
$binary = base64_decode($qrData, true);
if ($binary === false || strlen($binary) < 100) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'Imagen QR inválida o vacía']);
  exit;
}

// ----- Construye email con adjunto -----
$from     = 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'example.com'); // **ideal**: usar un remitente del dominio
$subject  = 'Tu QR de inscripción – Maratón Ituzaingó';
$filename = 'qr_' . ($dni ?: time()) . '.png';

$textBody = "Hola {$name},\n\n"
          . "¡Gracias por inscribirte a la maratón!\n"
          . "Adjuntamos tu código QR. Presentalo para retirar tu kit.\n\n"
          . ($dni ? "DNI: {$dni}\n" : '')
          . ($carrera ? "Carrera: {$carrera}\n" : '')
          . ($qrTexto ? "\nDatos del QR:\n{$qrTexto}\n" : '')
          . "\n— Organización Maratón Ituzaingó";

$boundary = '==Multipart_Boundary_x' . md5((string)microtime()) . 'x';

$headers  = "From: {$from}\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

$body  = "This is a multi-part message in MIME format.\r\n";
$body .= "--{$boundary}\r\n";
$body .= "Content-Type: text/plain; charset=\"utf-8\"\r\n";
$body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
$body .= "{$textBody}\r\n\r\n";

$body .= "--{$boundary}\r\n";
$body .= "Content-Type: image/png; name=\"{$filename}\"\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n";
$body .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
$body .= chunk_split(base64_encode($binary)) . "\r\n";
$body .= "--{$boundary}--";

// Envía
$ok = @mail($toEmail, $subject, $body, $headers);

if (!$ok) {
  http_response_code(500);
  echo json_encode(['success'=>false,'message'=>'No se pudo enviar el email (mail() falló)']);
  exit;
}

echo json_encode(['success'=>true,'message'=>'Email enviado']);
