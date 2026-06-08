<?php
header('Content-Type: application/json; charset=utf-8');

$lat = isset($_GET['lat']) ? floatval($_GET['lat']) : 0;
$lon = isset($_GET['lon']) ? floatval($_GET['lon']) : 0;

if (!$lat || !$lon) {
    echo json_encode(['error' => 'lat, lon required']);
    exit;
}

// ── Step 1: Overpass で最寄り駅を検索（直接 lat/lon から） ──────────────────
$overpassQuery = "[out:json][timeout:5];"
    . "(node[\"railway\"=\"station\"](around:1000,{$lat},{$lon});"
    . "node[\"railway\"=\"stop\"](around:1000,{$lat},{$lon});"
    . "node[\"railway\"=\"halt\"](around:1000,{$lat},{$lon}););"
    . "out body;";

$ch = curl_init('https://overpass-api.de/api/interpreter');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $overpassQuery);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/plain']);
curl_setopt($ch, CURLOPT_USERAGENT, 'chitose-route-search/1.0 (educational project)');
curl_setopt($ch, CURLOPT_TIMEOUT, 6);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$overpassResult = curl_exec($ch);
curl_close($ch);

if ($overpassResult) {
    $overpassData = json_decode($overpassResult, true);
    if (!empty($overpassData['elements'])) {
        $nearest = null;
        $minDist = PHP_FLOAT_MAX;
        foreach ($overpassData['elements'] as $el) {
            $d = hypot($el['lat'] - $lat, $el['lon'] - $lon);
            if ($d < $minDist) { $minDist = $d; $nearest = $el; }
        }
        if (!empty($nearest['tags']['name'])) {
            $name = $nearest['tags']['name'];
            echo json_encode(['location' => $name, 'display' => $name], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }
}

// ── Step 2: Nominatim 逆ジオコーディング（駅が見つからない場合のフォールバック） ──
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

// 市区町村＋区以下の詳細を組み合わせて曖昧さを解消（例: "北区" → "札幌市北区王子"）
$city     = $addr['city'] ?? $addr['town'] ?? $addr['county'] ?? '';
$district = $addr['city_district'] ?? '';
$detail   = '';
foreach (['road', 'suburb', 'neighbourhood', 'quarter'] as $key) {
    if (!empty($addr[$key])) { $detail = $addr[$key]; break; }
}
$location = $city . $district . $detail;

echo json_encode([
    'location' => trim($location) ?: ($data['display_name'] ?? ''),
    'display'  => isset($data['display_name']) ? $data['display_name'] : '',
], JSON_UNESCAPED_UNICODE);
