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
    const next = edges[i + 1]
    const rail = getEdgeName(cur)

    if (!rail || !next) { i++; continue }

    const sameRail = getEdgeName(next) === rail
    const type  = getEdgeType(cur, rail)
    const depSt = cur.stationName  || ''
    const arrSt = next.stationName || ''
    const depT  = cur.timeInfo?.[0]?.time  || ''
    const arrT  = next.timeInfo?.[0]?.time || ''
    const price = cur.priceInfo?.price || null

    if (type === 'walk') {
      steps.push({ type: 'walk', from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail })
    } else {
      steps.push({ type, from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail, price })
    }

    i += sameRail ? 2 : 1
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

      // 通常の路線検索（featureInfoList から地上交通ルートを優先）
      const nsp = pageProps.naviSearchParam
      if (nsp?.featureInfoList?.length > 0) {
        // 飛行機ステップを含まないルートを優先、なければ最初のルートを使う
        const ground = nsp.featureInfoList.find(item =>
          !(item.edgeInfoList || []).some(e => !!(e.airlineName || e.flightNo))
        )
        const item = ground ?? nsp.featureInfoList[0]
        const result = parseFeatureItem(item)
        if (result.depTime || result.arrTime) return result
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

  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: { format: 'json', lat, lon, 'accept-language': 'ja' },
      headers: { 'User-Agent': 'chitose-route-search/1.0 (educational project)' },
      timeout: 10000,
    })

    const addr = data.address || {}
    // Yahoo!路線情報向けに使いやすい地名を組み立てる
    const location =
      addr.road ||
      addr.suburb ||
      addr.neighbourhood ||
      `${addr.city_district || ''}${addr.city || addr.county || ''}`

    res.json({ location: location.trim(), display: data.display_name })
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

function isAddress(s) {
  return s.includes('丁目') || s.includes('番地')
}

const addressCache = new Map()

async function resolveAddress(address) {
  if (addressCache.has(address)) {
    const cached = addressCache.get(address)
    console.log(`[cache] ${address} → ${cached}`)
    return cached
  }
  // Step 1: 住所 → 座標 (Nominatim) — 複数フォーマットを試す
  let lat, lon
  const stripped = address.replace(/\d+-\d+$/, '').trim()  // 末尾の番地番号を除去
  const candidates = [
    stripped,
    '北海道' + stripped,
    address,
    '北海道' + address,
  ]
  for (const q of candidates) {
    try {
      const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: { q, format: 'json', limit: 1, countrycodes: 'jp' },
        headers: { 'User-Agent': 'chitose-route-search/1.0 (educational project)' },
        timeout: 5000,
      })
      if (data[0]?.lat) {
        lat = parseFloat(data[0].lat)
        lon = parseFloat(data[0].lon)
        console.log(`[nominatim] "${q}" → (${lat}, ${lon})`)
        break
      }
      console.log(`[nominatim] 結果なし: "${q}"`)
    } catch (e) { console.error('[nominatim] error:', e.message) }
  }
  if (!lat) { console.log('[nominatim] 全候補で結果なし'); return null }

  // Step 2: 座標 → 最寄り駅名 (Overpass API)
  try {
    const query = `[out:json][timeout:8];(node["railway"="station"](around:2000,${lat},${lon});node["railway"="stop"](around:2000,${lat},${lon});node["railway"="halt"](around:2000,${lat},${lon}););out body;`
    console.log(`[overpass] querying around (${lat},${lon})`)
    const { data } = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'chitose-route-search/1.0' },
      timeout: 10000,
    })
    console.log(`[overpass] found ${data.elements?.length ?? 0} nodes`)
    if (!data.elements?.length) return null

    let nearest = null, minDist = Infinity
    for (const el of data.elements) {
      const d = Math.hypot(el.lat - lat, el.lon - lon)
      if (d < minDist) { minDist = d; nearest = el }
    }
    const name = nearest?.tags?.name || null
    console.log(`[geocode] ${address} → (${lat},${lon}) → ${name}  (railway=${nearest?.tags?.railway})`)
    if (name) addressCache.set(address, name)
    return name
  } catch (e) {
    console.error('[overpass] error:', e.message)
    return null
  }
}

// デバッグ: 住所ジオコーディングの各ステップを確認
app.get('/api/debug/geocode', async (req, res) => {
  const { q } = req.query
  if (!q) return res.json({ error: 'q パラメータが必要です' })

  // Nominatim
  let lat, lon, nominatimRaw
  try {
    const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 1, countrycodes: 'jp' },
      headers: { 'User-Agent': 'chitose-route-search/1.0 (educational project)' },
      timeout: 5000,
    })
    nominatimRaw = data[0] || null
    if (data[0]?.lat) { lat = parseFloat(data[0].lat); lon = parseFloat(data[0].lon) }
  } catch (e) { return res.json({ error: 'Nominatim失敗: ' + e.message }) }

  if (!lat) return res.json({ nominatim: nominatimRaw, error: '座標が取得できませんでした' })

  // Overpass
  let overpassNodes
  try {
    const query = `[out:json][timeout:8];(node["railway"="station"](around:2000,${lat},${lon});node["railway"="stop"](around:2000,${lat},${lon});node["railway"="halt"](around:2000,${lat},${lon}););out body;`
    const { data } = await axios.post('https://overpass-api.de/api/interpreter', query, {
      headers: { 'Content-Type': 'text/plain', 'User-Agent': 'chitose-route-search/1.0' },
      timeout: 10000,
    })
    overpassNodes = (data.elements || []).map(el => ({
      name: el.tags?.name, railway: el.tags?.railway,
      dist: Math.round(Math.hypot(el.lat - lat, el.lon - lon) * 111000),
    })).sort((a, b) => a.dist - b.dist).slice(0, 5)
  } catch (e) { return res.json({ nominatim: nominatimRaw, lat, lon, error: 'Overpass失敗: ' + e.message }) }

  res.json({ input: q, lat, lon, nominatim: nominatimRaw?.display_name, nearestStations: overpassNodes })
})

app.get('/api/transit', async (req, res) => {
  let { from, to, y, m, d, hh, m1, m2 } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from と to は必須です' })

  let airportNote = null
  const fromInfo = AIRPORT_MAP[from]
  if (fromInfo) { airportNote = fromInfo.note; from = fromInfo.station; console.log(`[transit] airport: ${from} → ${fromInfo.station}`) }
  const toInfo = AIRPORT_MAP[to]
  if (toInfo) { airportNote = (airportNote ? airportNote + ' ' : '') + toInfo.note; to = toInfo.station; console.log(`[transit] airport: ${to} → ${toInfo.station}`) }

  if (isAddress(from)) {
    const station = await resolveAddress(from)
    if (station) { console.log(`[transit] resolved from: ${from} → ${station}`); from = station }
  }
  if (isAddress(to)) {
    const station = await resolveAddress(to)
    if (station) { console.log(`[transit] resolved to: ${to} → ${station}`); to = station }
  }

  console.log(`[transit] ${from} → ${to}  ${y}/${m}/${d} ${hh}:${m1}${m2}`)

  try {
    const { data } = await axios.get(YAHOO_URL, {
      params: { from, to, y, m, d, hh, m1, m2, type: 1, al: 1, shin: 1, ex: 0, hb: 1, lb: 1, sr: 1, ticket: 'ic', expkind: 1, ws: 3, s: 0 },
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
