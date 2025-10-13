<?php
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

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$email   = trim($input['email']   ?? '');
$nombre  = trim($input['nombre']  ?? '');
$dni     = trim($input['dni']     ?? '');
$carrera = trim($input['carrera'] ?? '');
$qr_png  = $input['qr_png']       ?? '';

if (!$email || !$qr_png) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'Faltan email o qr_png']);
  exit;
}

// quitar cabecera data:image/png;base64,
if (strpos($qr_png, 'base64,') !== false) {
  $qr_png = substr($qr_png, strpos($qr_png, 'base64,') + 7);
}
$png_bin = base64_decode($qr_png);
if ($png_bin === false) {
  http_response_code(400);
  echo json_encode(['success'=>false,'message'=>'PNG inválido']);
  exit;
}

// -------- email usando mail() + adjunto MIME --------
$to       = $email;
$subject  = 'Tu código QR de inscripción';
$from     = 'no-reply@TU-DOMINIO.COM';   // <-- CAMBIA ESTO por una casilla válida del dominio
$fromName = 'Maratón Ituzaingó';
$boundary = md5(uniqid(time(), true));

$headers  = "From: $fromName <$from>\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: multipart/mixed; boundary=\"{$boundary}\"\r\n";

$bodyText = "Hola {$nombre},\r\n\r\n"
          . "¡Gracias por inscribirte a la maratón!\r\n\r\n"
          . "Datos:\r\n"
          . "- DNI: {$dni}\r\n"
          . "- Distancia: {$carrera}\r\n\r\n"
          . "Adjuntamos tu código QR para retirar el kit.\r\n";

$body  = "--{$boundary}\r\n";
$body .= "Content-Type: text/plain; charset=\"utf-8\"\r\n";
$body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
$body .= $bodyText . "\r\n";

// adjunto
$filename = "qr_inscripcion_{$dni}.png";
$body .= "--{$boundary}\r\n";
$body .= "Content-Type: image/png; name=\"{$filename}\"\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n";
$body .= "Content-Disposition: attachment; filename=\"{$filename}\"\r\n\r\n";
$body .= chunk_split(base64_encode($png_bin)) . "\r\n";
$body .= "--{$boundary}--";

$ok = @mail($to, $subject, $body, $headers);

if ($ok) {
  echo json_encode(['success'=>true,'message'=>'Email enviado']);
} else {
  http_response_code(500);
  echo json_encode(['success'=>false,'message'=>'No se pudo enviar el email (mail() falló).']);
}
