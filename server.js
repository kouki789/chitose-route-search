import express from 'express'
import axios from 'axios'

const app = express()
const PORT = 3001
const YAHOO_URL = 'https://transit.yahoo.co.jp/search/result'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── パース ──────────────────────────────────────────────────────────────────

function getEdgeName(edge) {
  if (edge.railName) return edge.railName
  if (edge.lineName) return edge.lineName
  if (edge.busLineName) return edge.busLineName
  if (edge.airlineName) {
    return edge.airlineName + (edge.flightNo ? ' ' + edge.flightNo : '')
  }
  return ''
}

function getEdgeType(edge, name) {
  if (name.includes('徒歩')) return 'walk'
  if (edge.airlineName || edge.flightNo) return 'air'
  if (name.includes('便') && !name.includes('バス')) return 'air'
  if (edge.busLineName || name.includes('バス')) return 'bus'
  return 'transit'
}

function parseFeatureItem(item) {
  const s       = item.summaryInfo || {}
  const depTime = s.departureTime || ''
  const arrTime = s.arrivalTime   || ''
  const totalTime  = s.totalTime  || null
  const totalPrice = s.totalPrice || null

  const edges = item.edgeInfoList || []
  const steps = []
  let i = 0

  while (i < edges.length) {
    const cur  = edges[i]
    const rail = getEdgeName(cur)

    if (!rail) { i++; continue }

    // 同じ railName が続く中間停車駅を読み飛ばし、最初の別 rail エントリを到着駅とする
    let j = i + 1
    while (j < edges.length && getEdgeName(edges[j]) === rail) j++

    const type  = getEdgeType(cur, rail)
    const depSt = cur.stationName          || ''
    const depT  = cur.timeInfo?.[0]?.time  || ''
    const price = cur.priceInfo?.price     || null

    const arrEdge = edges[j]
    if (!arrEdge) {
      // 末尾に到着エッジがない（住所検索など）→ 最終エッジの情報で補完
      if (type !== 'walk') {
        const last = edges[edges.length - 1]
        steps.push({ type, from: depSt, to: last?.stationName || '', dep: depT, arr: last?.timeInfo?.[0]?.time || arrTime, line: rail, price })
      }
      break
    }

    const arrSt = arrEdge.stationName         || ''
    const arrT  = arrEdge.timeInfo?.[0]?.time || ''

    if (type === 'walk') {
      steps.push({ type: 'walk', from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail })
    } else {
      steps.push({ type, from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail, price })
    }

    i = j
  }

  return { depTime, arrTime, totalTime, totalPrice, steps }
}

const FLIGHT_ROUTE_ERROR = 'FLIGHT_ROUTE'

function parseYahooHtml(html) {
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const nd  = JSON.parse(m[1])
      const pageProps = nd?.props?.pageProps || {}

      // 通常の路線検索: transit ステップを含む候補の中で最安・最速を選択
      const nsp = pageProps.naviSearchParam
      if (nsp?.featureInfoList?.length > 0) {
        const parsed = nsp.featureInfoList
          .map(item => ({ item, result: parseFeatureItem(item) }))
          .filter(({ result }) => result.depTime || result.arrTime)

        const withTransit = parsed.filter(({ result }) =>
          result.steps.some(s => s.type !== 'walk')
        )
        const pool = withTransit.length > 0 ? withTransit : parsed

        if (pool.length > 0) {
          const best = pool.reduce((b, c) => {
            const bp = b.item.summaryInfo?.totalPrice ?? Infinity
            const cp = c.item.summaryInfo?.totalPrice ?? Infinity
            if (cp !== bp) return cp < bp ? c : b
            const bt = b.item.summaryInfo?.totalTime ?? Infinity
            const ct = c.item.summaryInfo?.totalTime ?? Infinity
            return ct < bt ? c : b
          })
          return best.result
        }
      }

      // Yahoo! 自身がルートなしと返している場合（queryState.errorList）
      const qs = pageProps.queryState
      if (qs?.errorList?.length > 0) return FLIGHT_ROUTE_ERROR

      // 飛行機ルート検出（diainfoFlightParams が配列として存在する場合）
      if (Array.isArray(pageProps.diainfoFlightParams) && pageProps.diainfoFlightParams.length > 0) {
        return FLIGHT_ROUTE_ERROR
      }
    } catch (e) {
      console.error('[parse] __NEXT_DATA__ error:', e.message)
    }
  }

  // フォールバック: 発/着 パターン
  const times = [...html.matchAll(/(\d{1,2}:\d{2})(?:発|着)/g)].map(m => m[1])
  if (times.length >= 2) {
    return { depTime: times[0], arrTime: times[times.length - 1], totalTime: null, totalPrice: null, steps: [] }
  }

  return null
}

// ── エンドポイント ────────────────────────────────────────────────────────────

// 逆ジオコーディング（緯度経度 → 地名）
app.get('/api/geocode', async (req, res) => {
  const { lat, lon } = req.query
  if (!lat || !lon) return res.status(400).json({ error: 'lat, lon required' })

  const latF = parseFloat(lat)
  const lonF = parseFloat(lon)

  // Step 1: Overpass で最寄り駅を直接検索
  try {
    const query = `[out:json][timeout:5];(node["railway"="station"](around:1000,${latF},${lonF});node["railway"="stop"](around:1000,${latF},${lonF});node["railway"="halt"](around:1000,${latF},${lonF}););out body;`
    const { data } = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'chitose-route-search/1.0 (educational project)' },
      timeout: 6000,
    })
    if (data.elements?.length) {
      let nearest = null, minDist = Infinity
      for (const el of data.elements) {
        const d = Math.hypot(el.lat - latF, el.lon - lonF)
        if (d < minDist) { minDist = d; nearest = el }
      }
      const name = nearest?.tags?.name
      if (name) {
        console.log(`[geocode] station found: ${name}`)
        return res.json({ location: name, display: name })
      }
    }
  } catch (e) {
    console.error('[geocode] Overpass error:', e.message)
  }

  // Step 2: Nominatim 逆ジオコーディング（フォールバック）
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { format: 'json', lat: latF, lon: lonF, 'accept-language': 'ja' },
      headers: { 'User-Agent': 'chitose-route-search/1.0 (educational project)' },
      timeout: 10000,
    })

    const addr = data.address || {}
    // 市区町村＋区以下の詳細を組み合わせて曖昧さを解消（例: "北区" → "札幌市北区王子"）
    const city     = addr.city || addr.town || addr.county || ''
    const district = addr.city_district || ''
    const detail   = addr.road || addr.suburb || addr.neighbourhood || addr.quarter || ''
    const location = (city + district + detail).trim() || data.display_name

    console.log(`[geocode] address: ${location}`)
    res.json({ location, display: data.display_name })
  } catch (e) {
    console.error('[geocode]', e.message)
    res.status(500).json({ error: '位置情報の取得に失敗しました' })
  }
})

// お問い合わせ（ローカル開発用：コンソールに出力してOKを返す）
app.use(express.json())
app.post('/api/contact', (req, res) => {
  const { name, email, message } = req.body || {}
  if (!name || !email || !message) {
    return res.status(400).json({ error: '必須項目が入力されていません' })
  }
  console.log(`\n[contact] お問い合わせを受信しました`)
  console.log(`  お名前: ${name}`)
  console.log(`  メール: ${email}`)
  console.log(`  内容:\n${message}\n`)
  res.json({ ok: true })
})

// Yahoo! 路線情報に存在しない空港 → 最寄り乗換駅 + 注記
const AIRPORT_MAP = {
  '丘珠空港': { station: 'さっぽろ', note: '丘珠空港はYahoo!路線情報に未対応のため、さっぽろ駅（空港バス 約35分）からのルートを表示しています。' },
  '函館空港': { station: '函館',     note: '函館空港はYahoo!路線情報に未対応のため、函館駅（空港バス 約20分）からのルートを表示しています。' },
  '旭川空港': { station: '旭川',     note: '旭川空港はYahoo!路線情報に未対応のため、旭川駅（空港バス 約35分）からのルートを表示しています。' },
}

app.get('/api/transit', async (req, res) => {
  let { from, to, y, m, d, hh, m1, m2, type } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from と to は必須です' })
  const searchType = parseInt(type) || 1

  let airportNote = null
  const fromInfo = AIRPORT_MAP[from]
  if (fromInfo) { airportNote = fromInfo.note; from = fromInfo.station; console.log(`[transit] airport: ${from} → ${fromInfo.station}`) }
  const toInfo = AIRPORT_MAP[to]
  if (toInfo) { airportNote = (airportNote ? airportNote + ' ' : '') + toInfo.note; to = toInfo.station; console.log(`[transit] airport: ${to} → ${toInfo.station}`) }

  // UI 表示用の disambig suffix（例：池田（北海道）→ 池田）を除去
  from = from.replace(/（[^）]*）$/, '')
  to   = to.replace(/（[^）]*）$/, '')

  console.log(`[transit] ${from} → ${to}  ${y}/${m}/${d} ${hh}:${m1}${m2}`)

  try {
    const { data } = await axios.get(YAHOO_URL, {
      params: {
        from, to, y, m, d, hh, m1, m2,
        type: searchType,
        ticket: 'ic', expkind: 1, userpass: 1, ws: 3,
        al: 1, shin: 1, hb: 1, lb: 1, sr: 1,
        ex: 1,
        s: searchType === 4 ? 1 : 0,
      },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    })

    const result = parseYahooHtml(data)
    if (!result) return res.status(404).json({ error: 'ルートが見つかりませんでした' })
    if (result === FLIGHT_ROUTE_ERROR) {
      return res.status(404).json({ error: '飛行機を利用するルートのため表示できません。飛行機で来る場合は「新千歳空港」を出発地として入力してください。' })
    }

    res.json({ ...result, ...(airportNote ? { airportNote } : {}) })
  } catch (e) {
    console.error('[transit] error:', e.message)
    res.status(500).json({ error: 'データ取得に失敗しました: ' + e.message })
  }
})

app.listen(PORT, () => console.log(`✅ Proxy server: http://localhost:${PORT}`))
