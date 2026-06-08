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
$type = isset($_GET['type']) ? intval($_GET['type']) : 1;

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

// UI 表示用の disambig suffix（例：池田（北海道）→ 池田）を除去
$from = preg_replace('/（[^）]*）$/', '', $from);
$to   = preg_replace('/（[^）]*）$/', '', $to);

$params = http_build_query([
    'from' => $from, 'to' => $to,
    'y' => $y, 'm' => $m, 'd' => $d,
    'hh' => $hh, 'm1' => $m1, 'm2' => $m2,
    'type' => $type,
    'ticket' => 'ic', 'expkind' => 1, 'userpass' => 1, 'ws' => 3,
    'al' => 1, 'shin' => 1, 'hb' => 1, 'lb' => 1, 'sr' => 1,
    'ex' => 1,
    's'  => ($type === 4) ? 1 : 0,
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

// transit エッジ（徒歩以外）を含むかチェック
function hasTransitEdge($item) {
    $edges = isset($item['edgeInfoList']) ? $item['edgeInfoList'] : [];
    foreach ($edges as $e) {
        $name = '';
        foreach (['railName', 'lineName', 'busLineName'] as $f) {
            if (!empty($e[$f])) { $name = $e[$f]; break; }
        }
        if (!empty($e['airlineName'])) $name = $e['airlineName'];
        if ($name && mb_strpos($name, '徒歩') === false) return true;
    }
    return false;
}

// transit ステップを持つ候補を優先し、その中で最安・最速を選択
$withTransit = array_values(array_filter($featureList, 'hasTransitEdge'));
$pool = !empty($withTransit) ? $withTransit : $featureList;
$item = $pool[0];
foreach ($pool as $fi) {
    $cp = isset($fi['summaryInfo']['totalPrice'])    ? (float)$fi['summaryInfo']['totalPrice']    : PHP_FLOAT_MAX;
    $bp = isset($item['summaryInfo']['totalPrice'])  ? (float)$item['summaryInfo']['totalPrice']  : PHP_FLOAT_MAX;
    $ct = isset($fi['summaryInfo']['totalTime'])     ? (float)$fi['summaryInfo']['totalTime']     : PHP_FLOAT_MAX;
    $bt = isset($item['summaryInfo']['totalTime'])   ? (float)$item['summaryInfo']['totalTime']   : PHP_FLOAT_MAX;
    if ($cp < $bp || ($cp === $bp && $ct < $bt)) $item = $fi;
}
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
    $rail = getEdgeName($cur);

    if (!$rail) { $i++; continue; }

    // 同じ railName が続く中間停車駅を読み飛ばし、最初の別 rail エントリを到着駅とする
    $j        = $i + 1;
    while ($j < $cnt && getEdgeName($edges[$j]) === $rail) { $j++; }

    $stepType = getEdgeType($cur, $rail);
    $depSt    = isset($cur['stationName'])        ? $cur['stationName']        : '';
    $depT     = isset($cur['timeInfo'][0]['time']) ? $cur['timeInfo'][0]['time'] : '';
    $price    = isset($cur['priceInfo']['price'])  ? $cur['priceInfo']['price']  : null;

    if ($j >= $cnt) {
        // 末尾に到着エッジがない（住所検索など）→ 最終エッジの情報で補完
        if ($stepType !== 'walk') {
            $last = $edges[$cnt - 1];
            $arrSt2 = isset($last['stationName']) ? $last['stationName'] : '';
            $arrT2  = isset($last['timeInfo'][0]['time']) ? $last['timeInfo'][0]['time'] : (isset($summary['arrivalTime']) ? $summary['arrivalTime'] : '');
            $steps[] = ['type' => $stepType, 'from' => $depSt, 'to' => $arrSt2, 'dep' => $depT, 'arr' => $arrT2, 'line' => $rail, 'price' => $price];
        }
        break;
    }

    $arrEdge = $edges[$j];
    $arrSt   = isset($arrEdge['stationName'])         ? $arrEdge['stationName']         : '';
    $arrT    = isset($arrEdge['timeInfo'][0]['time'])  ? $arrEdge['timeInfo'][0]['time']  : '';

    if ($stepType === 'walk') {
        $steps[] = ['type' => 'walk', 'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail];
    } else {
        $steps[] = ['type' => $stepType, 'from' => $depSt, 'to' => $arrSt, 'dep' => $depT, 'arr' => $arrT, 'line' => $rail, 'price' => $price];
    }

    $i = $j;
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
