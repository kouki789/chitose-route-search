<?php
header('Content-Type: application/json; charset=utf-8');

$lat = isset($_GET['lat']) ? $_GET['lat'] : '';
$lon = isset($_GET['lon']) ? $_GET['lon'] : '';

if (!$lat || !$lon) {
    echo json_encode(['error' => 'lat, lon required']);
    exit;
}

$url = 'https://nominatim.openstreetmap.org/reverse?' . http_build_query([
    'format'          => 'json',
    'lat'             => $lat,
    'lon'             => $lon,
    'accept-language' => 'ja',
]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'chitose-route-search/1.0 (educational project)');
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$result = curl_exec($ch);
curl_close($ch);

if (!$result) {
    echo json_encode(['error' => '位置情報の取得に失敗しました']);
    exit;
}

$data = json_decode($result, true);
$addr = isset($data['address']) ? $data['address'] : [];

$location = '';
foreach (['road', 'suburb', 'neighbourhood', 'quarter'] as $key) {
    if (!empty($addr[$key])) { $location = $addr[$key]; break; }
}
if (!$location) {
    $location = ($addr['city_district'] ?? '') . ($addr['city'] ?? $addr['county'] ?? '');
}

echo json_encode([
    'location' => trim($location),
    'display'  => isset($data['display_name']) ? $data['display_name'] : '',
], JSON_UNESCAPED_UNICODE);
