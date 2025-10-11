<?php
// api/listar_inscripciones.php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Content-Type: application/json; charset=utf-8');

$DEV = true;
if ($DEV) { ini_set('display_errors', 1); error_reporting(E_ALL); }

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
  http_response_code(405);
  echo json_encode(['success'=>false,'message'=>'Método no permitido. Use GET.']);
  exit;
}

// ▶️ usar config.php
require __DIR__.'/config.php';
$pdo = pdo_conn();

$limit  = isset($_GET['limit'])  ? max(1, min((int)$_GET['limit'], 200)) : 50;
$offset = isset($_GET['offset']) ? max(0, (int)$_GET['offset']) : 0;
$q      = isset($_GET['q']) ? trim($_GET['q']) : '';
$sort   = $_GET['sort'] ?? 'fecha_inscripcion';
$order  = strtolower($_GET['order'] ?? 'desc');

$allowedSort = ['id','nombre','dni','email','carrera','fecha_inscripcion'];
$sort = in_array($sort, $allowedSort, true) ? $sort : 'fecha_inscripcion';
$order = $order === 'asc' ? 'ASC' : 'DESC';

try {
  // Filtros
  $where = 'WHERE 1';
  $params = [];
  if ($q !== '') {
    $where .= ' AND (nombre LIKE :q OR email LIKE :q OR dni LIKE :q)';
    $params[':q'] = "%$q%";
  }

  // Total
  $stmtCnt = $pdo->prepare("SELECT COUNT(*) FROM inscripciones $where");
  foreach ($params as $k=>$v) $stmtCnt->bindValue($k, $v, PDO::PARAM_STR);
  $stmtCnt->execute();
  $total = (int)$stmtCnt->fetchColumn();

  // Lista
  $sql = "SELECT id, nombre, dni, email, carrera, fecha_inscripcion
          FROM inscripciones
          $where
          ORDER BY $sort $order
          LIMIT :limit OFFSET :offset";
  $stmt = $pdo->prepare($sql);
  foreach ($params as $k=>$v) $stmt->bindValue($k, $v, PDO::PARAM_STR);
  $stmt->bindValue(':limit',  $limit,  PDO::PARAM_INT);
  $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
  $stmt->execute();

  echo json_encode([
    'success' => true,
    'total'   => $total,
    'limit'   => $limit,
    'offset'  => $offset,
    'items'   => $stmt->fetchAll()
  ]);

} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success'=>false,'message'=> $DEV ? $e->getMessage() : 'Error interno del servidor']);
}
