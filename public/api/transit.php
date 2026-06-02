<?php
header('Content-Type: application/json; charset=utf-8');

$from = isset($_GET['from']) ? $_GET['from'] : '';
$to   = isset($_GET['to'])   ? $_GET['to']   : '';
$y    = isset($_GET['y'])    ? intval($_GET['y'])  : intval(date('Y'));
$m    = isset($_GET['m'])    ? intval($_GET['m'])  : intval(date('n'));
$d    = isset($_GET['d'])    ? intval($_GET['d'])  : intval(date('j'));
$hh   = isset($_GET['hh'])   ? intval($_GET['hh']) : intval(date('G'));
$m1   = isset($_GET['m1'])   ? intval($_GET['m1']) : 0;
$m2   = isset($_GET['m2'])   ? intval($_GET['m2']) : 0;

if (!$from || !$to) {
    echo json_encode(['error' => 'from と to は必須です']);
    exit;
}

// ── Yahoo! に存在しない空港 → 最寄り乗換駅へのマッピング ─────────────────────
$AIRPORT_MAP = [
    '丘珠空港' => ['station' => 'さっぽろ', 'note' => '丘珠空港はYahoo!路線情報に未対応のため、さっぽろ駅（空港バス 約35分）からのルートを表示しています。'],
    '函館空港' => ['station' => '函館',     'note' => '函館空港はYahoo!路線情報に未対応のため、函館駅（空港バス 約20分）からのルートを表示しています。'],
    '旭川空港' => ['station' => '旭川',     'note' => '旭川空港はYahoo!路線情報に未対応のため、旭川駅（空港バス 約35分）からのルートを表示しています。'],
];
$airportNote = null;
if (isset($AIRPORT_MAP[$from])) { $airportNote = $AIRPORT_MAP[$from]['note']; $from = $AIRPORT_MAP[$from]['station']; }
if (isset($AIRPORT_MAP[$to]))   { $airportNote = ($airportNote ? $airportNote . ' ' : '') . $AIRPORT_MAP[$to]['note']; $to = $AIRPORT_MAP[$to]['station']; }

// ── 住所検知 → 最寄り駅名に変換 ─────────────────────────────────────────────
function isAddress($s) {
    return mb_strpos($s, '丁目') !== false || mb_strpos($s, '番地') !== false;
}

function findNearestStation($lat, $lon) {
    $query = "[out:json][timeout:8];"
           . "(node[\"railway\"=\"station\"](around:2000,{$lat},{$lon});"
           . "node[\"railway\"=\"stop\"](around:2000,{$lat},{$lon});"
           . "node[\"railway\"=\"halt\"](around:2000,{$lat},{$lon}););"
           . "out body;";
    $ch = curl_init('https://overpass-api.de/api/interpreter');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $query);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: text/plain']);
    curl_setopt($ch, CURLOPT_USERAGENT, 'chitose-route-search/1.0 (educational project)');
    curl_setopt($ch, CURLOPT_TIMEOUT, 8);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $result = curl_exec($ch);
    curl_close($ch);
    if (!$result) return null;
    $data = json_decode($result, true);
    if (empty($data['elements'])) return null;
    $nearest = null;
    $minDist = PHP_FLOAT_MAX;
    foreach ($data['elements'] as $el) {
        $d = hypot($el['lat'] - $lat, $el['lon'] - $lon);
        if ($d < $minDist) { $minDist = $d; $nearest = $el; }
    }
    return isset($nearest['tags']['name']) ? $nearest['tags']['name'] : null;
}

function nominatimSearch($q) {
    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q' => $q, 'format' => 'json', 'limit' => 1, 'countrycodes' => 'jp',
    ]);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'chitose-route-search/1.0 (educational project)');
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
    $result = curl_exec($ch);
    curl_close($ch);
    if (!$result) return null;
    $data = json_decode($result, true);
    return !empty($data[0]['lat']) ? $data[0] : null;
}

function resolveAddress($address) {
    $cacheFile = sys_get_temp_dir() . '/geocache_' . md5($address) . '.txt';
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < 86400) {
        return file_get_contents($cacheFile) ?: null;
    }
    $stripped = preg_replace('/\d+-\d+$/', '', trim($address));
    $candidates = [$stripped, '北海道' . $stripped, $address, '北海道' . $address];
    $lat = null; $lon = null;
    foreach ($candidates as $q) {
        $hit = nominatimSearch($q);
        if ($hit) { $lat = (float)$hit['lat']; $lon = (float)$hit['lon']; break; }
    }
    if (!$lat) { file_put_contents($cacheFile, ''); return null; }
    $station = findNearestStation($lat, $lon);
    if ($station) file_put_contents($cacheFile, $station);
    return $station;
}

// UI 表示用の disambig suffix（例：池田（北海道）→ 池田）を除去
$from = preg_replace('/（[^）]*）$/', '', $from);
$to   = preg_replace('/（[^）]*）$/', '', $to);

if (isAddress($from)) {
    $station = resolveAddress($from);
    if ($station) $from = $station;
}
if (isAddress($to)) {
    $station = resolveAddress($to);
    if ($station) $to = $station;
}

$params = http_build_query([
    'from' => $from, 'to' => $to,
    'y' => $y, 'm' => $m, 'd' => $d,
    'hh' => $hh, 'm1' => $m1, 'm2' => $m2,
    'type' => 1, 'al' => 1, 'shin' => 1, 'ex' => 0,
    'hb' => 1, 'lb' => 1, 'sr' => 1,
    'ticket' => 'ic', 'expkind' => 1, 'ws' => 3, 's' => 0,
]);

$url = 'https://transit.yahoo.co.jp/search/result?' . $params;

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_ENCODING, 'gzip, deflate');
$html     = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if (!$html || $httpCode !== 200) {
    echo json_encode(['error' => 'データ取得に失敗しました (HTTP ' . $httpCode . ')']);
    exit;
}

// ── __NEXT_DATA__ を抽出 ───────────────────────────────────────────────────
if (!preg_match('/<script[^>]+id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/s', $html, $matches)) {
    // フォールバック: 発/着パターン
    preg_match_all('/(\d{1,2}:\d{2})(?:発|着)/', $html, $t);
    if (count($t[1]) >= 2) {
        echo json_encode(['depTime' => $t[1][0], 'arrTime' => end($t[1]), 'totalTime' => null, 'totalPrice' => null, 'steps' => []]);
    } else {
        echo json_encode(['error' => 'ルートが見つかりませんでした']);
    }
    exit;
}

$nd         = json_decode($matches[1], true);
$pageProps  = isset($nd['props']['pageProps']) ? $nd['props']['pageProps'] : [];
$nsp        = isset($pageProps['naviSearchParam']) ? $pageProps['naviSearchParam'] : null;
$featureList = isset($nsp['featureInfoList']) ? $nsp['featureInfoList'] : [];

if (empty($featureList)) {
    $flightMsg = '飛行機を利用するルートのため表示できません。飛行機で来る場合は「新千歳空港」を出発地として入力してください。';
    // Yahoo! 自身がルートなしと返している場合
    $qs = isset($pageProps['queryState']) ? $pageProps['queryState'] : [];
    if (!empty($qs['errorList'])) {
        echo json_encode(['error' => $flightMsg]);
    // 飛行機ルート検出
    } elseif (isset($pageProps['diainfoFlightParams']) && is_array($pageProps['diainfoFlightParams']) && count($pageProps['diainfoFlightParams']) > 0) {
        echo json_encode(['error' => $flightMsg]);
    } else {
        echo json_encode(['error' => 'ルートが見つかりませんでした']);
    }
    exit;
}

$item    = $featureList[0];
$summary = isset($item['summaryInfo'])   ? $item['summaryInfo']   : [];
$edges   = isset($item['edgeInfoList'])  ? $item['edgeInfoList']  : [];

// ── エッジから交通手段名を取得（鉄道・バス・飛行機に対応） ────────────────
function getEdgeName($edge) {
    foreach (['railName', 'lineName', 'busLineName'] as $f) {
        if (!empty($edge[$f])) return $edge[$f];
    }
    if (!empty($edge['airlineName'])) {
        $n = $edge['airlineName'];
        if (!empty($edge['flightNo'])) $n .= ' ' . $edge['flightNo'];
        return $n;
    }
    return '';
}

function getEdgeType($edge, $name) {
    if (mb_strpos($name, '徒歩') !== false) return 'walk';
    if (!empty($edge['airlineName']) || !empty($edge['flightNo'])) return 'air';
    if (mb_strpos($name, '便') !== false && mb_strpos($name, 'バス') === false) return 'air';
    if (!empty($edge['busLineName']) || mb_strpos($name, 'バス') !== false) return 'bus';
    return 'transit';
}

// ── edgeInfoList をパース ─────────────────────────────────────────────────
$steps = [];
$i     = 0;
$cnt   = count($edges);

while ($i < $cnt) {
    $cur  = $edges[$i];
    $next = isset($edges[$i + 1]) ? $edges[$i + 1] : null;
    $rail = getEdgeName($cur);

    if (!$rail || !$next) { $i++; continue; }

    $sameRail = getEdgeName($next) === $rail;
    $stepType = getEdgeType($cur, $rail);
    $depSt    = isset($cur['stationName'])          ? $cur['stationName']          : '';
    $arrSt    = isset($next['stationName'])          ? $next['stationName']         : '';
    $depT     = isset($cur['timeInfo'][0]['time'])   ? $cur['timeInfo'][0]['time']  : '';
    $arrT     = isset($next['timeInfo'][0]['time'])  ? $next['timeInfo'][0]['time'] : '';
    $price    = isset($cur['priceInfo']['price'])    ? $cur['priceInfo']['price']   : null;

    if ($stepType === 'walk') {
        $steps[] = ['type' => 'walk', 'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail];
    } else {
        $steps[] = ['type' => $stepType, 'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail, 'price' => $price];
    }

    $i += $sameRail ? 2 : 1;
}

$response = [
    'depTime'    => isset($summary['departureTime']) ? $summary['departureTime'] : '',
    'arrTime'    => isset($summary['arrivalTime'])   ? $summary['arrivalTime']   : '',
    'totalTime'  => isset($summary['totalTime'])     ? $summary['totalTime']     : null,
    'totalPrice' => isset($summary['totalPrice'])    ? $summary['totalPrice']    : null,
    'steps'      => $steps,
];
if ($airportNote) $response['airportNote'] = $airportNote;
echo json_encode($response, JSON_UNESCAPED_UNICODE);
