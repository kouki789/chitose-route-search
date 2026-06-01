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

$params = http_build_query([
    'from' => $from, 'to' => $to,
    'y' => $y, 'm' => $m, 'd' => $d,
    'hh' => $hh, 'm1' => $m1, 'm2' => $m2,
    'type' => 1,
]);

$url = 'https://transit.yahoo.co.jp/search/print?' . $params;

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

$nd  = json_decode($matches[1], true);
$nsp = isset($nd['props']['pageProps']['naviSearchParam']) ? $nd['props']['pageProps']['naviSearchParam'] : null;
$featureList = isset($nsp['featureInfoList']) ? $nsp['featureInfoList'] : [];

if (empty($featureList)) {
    echo json_encode(['error' => 'ルートが見つかりませんでした']);
    exit;
}

$item    = $featureList[0];
$summary = isset($item['summaryInfo'])   ? $item['summaryInfo']   : [];
$edges   = isset($item['edgeInfoList'])  ? $item['edgeInfoList']  : [];

// ── edgeInfoList をパース ─────────────────────────────────────────────────
$steps = [];
$i     = 0;
$cnt   = count($edges);

while ($i < $cnt) {
    $cur  = $edges[$i];
    $next = isset($edges[$i + 1]) ? $edges[$i + 1] : null;
    $rail = isset($cur['railName']) ? $cur['railName'] : '';

    if (!$rail || !$next) { $i++; continue; }

    $sameRail = (isset($next['railName']) ? $next['railName'] : '') === $rail;
    $depSt    = isset($cur['stationName'])          ? $cur['stationName']          : '';
    $arrSt    = isset($next['stationName'])          ? $next['stationName']          : '';
    $depT     = isset($cur['timeInfo'][0]['time'])   ? $cur['timeInfo'][0]['time']   : '';
    $arrT     = isset($next['timeInfo'][0]['time'])  ? $next['timeInfo'][0]['time']  : '';
    $price    = isset($cur['priceInfo']['price'])    ? $cur['priceInfo']['price']    : null;

    $isWalk = mb_strpos($rail, '徒歩') !== false;

    if ($isWalk) {
        $steps[] = ['type' => 'walk',    'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail];
    } else {
        $steps[] = ['type' => 'transit', 'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail, 'price' => $price];
    }

    $i += $sameRail ? 2 : 1;
}

echo json_encode([
    'depTime'    => isset($summary['departureTime']) ? $summary['departureTime'] : '',
    'arrTime'    => isset($summary['arrivalTime'])   ? $summary['arrivalTime']   : '',
    'totalTime'  => isset($summary['totalTime'])     ? $summary['totalTime']     : null,
    'totalPrice' => isset($summary['totalPrice'])    ? $summary['totalPrice']    : null,
    'steps'      => $steps,
], JSON_UNESCAPED_UNICODE);
