import express from 'express'
import axios from 'axios'

const app = express()
const PORT = 3001
const YAHOO_URL = 'https://transit.yahoo.co.jp/search/print'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// ── パース ──────────────────────────────────────────────────────────────────

function parseFeatureItem(item) {
  const s       = item.summaryInfo || {}
  const depTime = s.departureTime || ''
  const arrTime = s.arrivalTime   || ''
  const totalTime  = s.totalTime  || null   // "29分" 形式
  const totalPrice = s.totalPrice || null   // "1,040" 形式

  const edges = item.edgeInfoList || []
  const steps = []
  let i = 0

  while (i < edges.length) {
    const cur  = edges[i]
    const next = edges[i + 1]
    const rail = cur.railName || ''

    if (!rail || !next) { i++; continue }

    const sameRail = next.railName === rail
    const depSt = cur.stationName  || ''
    const arrSt = next.stationName || ''
    const depT  = cur.timeInfo?.[0]?.time  || ''
    const arrT  = next.timeInfo?.[0]?.time || ''
    const price = cur.priceInfo?.price || null

    if (rail.includes('徒歩') || rail.includes('歩')) {
      steps.push({ type: 'walk', from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail })
    } else {
      steps.push({ type: 'transit', from: depSt, to: arrSt, dep: depT, arr: arrT, line: rail, price })
    }

    i += sameRail ? 2 : 1
  }

  return { depTime, arrTime, totalTime, totalPrice, steps }
}

function parseYahooHtml(html) {
  // __NEXT_DATA__ を regex で抽出（cheerio より安定）
  const m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)
  if (m) {
    try {
      const nd  = JSON.parse(m[1])
      const nsp = nd?.props?.pageProps?.naviSearchParam
      if (nsp?.featureInfoList?.length > 0) {
        const result = parseFeatureItem(nsp.featureInfoList[0])
        if (result.depTime && result.arrTime) return result
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

app.get('/api/transit', async (req, res) => {
  const { from, to, y, m, d, hh, m1, m2 } = req.query
  if (!from || !to) return res.status(400).json({ error: 'from と to は必須です' })

  console.log(`[transit] ${from} → ${to}  ${y}/${m}/${d} ${hh}:${m1}${m2}`)

  try {
    const { data } = await axios.get(YAHOO_URL, {
      params: { from, to, y, m, d, hh, m1, m2, type: 1 },
      headers: { 'User-Agent': UA },
      timeout: 15000,
    })

    const result = parseYahooHtml(data)
    if (!result) return res.status(404).json({ error: 'ルートが見つかりませんでした' })

    res.json(result)
  } catch (e) {
    console.error('[transit] error:', e.message)
    res.status(500).json({ error: 'データ取得に失敗しました: ' + e.message })
  }
})

app.listen(PORT, () => console.log(`✅ Proxy server: http://localhost:${PORT}`))
