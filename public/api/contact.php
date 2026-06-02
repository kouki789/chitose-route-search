<?php
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);

$name    = isset($data['name'])    ? trim($data['name'])    : '';
$email   = isset($data['email'])   ? trim($data['email'])   : '';
$message = isset($data['message']) ? trim($data['message']) : '';

if (!$name || !$email || !$message) {
    http_response_code(400);
    echo json_encode(['error' => '必須項目が入力されていません']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'メールアドレスの形式が正しくありません']);
    exit;
}

$to      = 'b2241760@photon.chitose.ac.jp';
$subject = mb_encode_mimeheader('【ルート検索サイト】お問い合わせ', 'UTF-8', 'B');
$body    = "お名前: {$name}\nメールアドレス: {$email}\n\n【お問い合わせ内容】\n{$message}";
$headers = implode("\r\n", [
    "From: noreply@" . $_SERVER['HTTP_HOST'],
    "Reply-To: {$email}",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
]);

$result = mb_send_mail($to, $subject, base64_encode($body), $headers);

if ($result) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['error' => 'メールの送信に失敗しました。時間をおいて再度お試しください。']);
}
