import { findNextBuses } from './schedule'

// ── Yahoo! 路線情報 API ────────────────────────────────────────────────────

export async function fetchTransit(from, to, departure) {
  const y  = departure.getFullYear()
  const mo = departure.getMonth() + 1
  const d  = departure.getDate()
  const hh = departure.getHours()
  const min = departure.getMinutes()
  const m1 = Math.floor(min / 10)
  const m2 = min % 10
  const params = new URLSearchParams({ from, to, y, m: mo, d, hh, m1, m2 })
  let res
  try {
    res = await fetch(`/api/transit?${params}`)
  } catch {
    throw new Error('サーバーに接続できません。npm run server を実行してください。')
  }
  if (!res.ok) {
    const j = await res.json().catch(() => ({}))
    throw new Error(j.error || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── 時間計算ユーティリティ ──────────────────────────────────────────────────

export function diffMinutes(dep, arr) {
  const [dh, dm] = dep.split(':').map(Number)
  const [ah, am] = arr.split(':').map(Number)
  return (ah * 60 + am) - (dh * 60 + dm)
}

export function formatMinutes(min) {
  if (!min && min !== 0) return null
  if (min < 60) return `${min}分`
  return `${Math.floor(min / 60)}時間${min % 60 > 0 ? `${min % 60}分` : ''}`
}

// ── バス接続最適化 ─────────────────────────────────────────────────────────

export function findOptimalBusResult(busStopArrival, timetable) {
  const buses = findNextBuses(busStopArrival, timetable, 2)
  if (!buses.length) {
    return { buses: [], status: 'none', waitMin: 0, message: '本日の便はすべて終了しています' }
  }
  const waitMin = Math.round((buses[0] - busStopArrival) / 60000)

  if (waitMin < 5) {
    return { buses, status: 'tight', waitMin,
      message: `乗り換え時間が約${waitMin}分と短めです。次の便も表示しています` }
  } else if (waitMin <= 9) {
    return { buses: [buses[0]], status: 'good', waitMin,
      message: `乗り換え良好（バス停で約${waitMin}分待ち）` }
  } else {
    return { buses, status: 'long', waitMin,
      message: `バス停で約${waitMin}分待ちになります` }
  }
}
