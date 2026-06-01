export const CHITOSE_STATION = '千歳駅'
export const BUS_STOP = '千歳駅前'
export const UNIVERSITY = '公立千歳科学技術大学'
export const TRANSFER_MIN = 5

// 往路 平日バス時刻（千歳駅前発）
const WEEKDAY = [
  '07:14','07:20','07:29','08:04','08:14','08:19','08:24','08:29',
  '09:04','09:19','09:34','09:44','09:54','10:04','10:14','10:30',
  '11:00','11:29','12:10','12:19','13:20','14:24','14:29','15:22',
  '15:55','16:04','17:51',
]

// 往路 休日バス時刻
const HOLIDAY = [
  '07:20','08:18','09:10','11:29','13:20',
]

// 復路 平日バス時刻（大学発, 千歳駅前着）
const RETURN_WEEKDAY = [
  ['11:02','11:24'],['11:36','12:02'],['12:27','12:49'],['13:07','13:29'],
  ['13:35','14:01'],['14:17','14:39'],['15:02','15:24'],['15:24','15:50'],
  ['16:42','17:04'],['16:47','17:13'],['17:02','17:24'],['17:30','17:52'],
  ['17:52','18:18'],['18:27','18:49'],['19:02','19:28'],['19:42','20:08'],
  ['20:32','21:00'],['21:22','21:48'],['22:02','22:30'],
]

// 復路 休日バス時刻
const RETURN_HOLIDAY = [
  ['12:42','13:08'],['14:32','14:58'],['15:24','15:50'],
  ['16:47','17:13'],['17:52','18:18'],['19:02','19:28'],
  ['20:32','21:00'],['22:02','22:30'],
]

// 祝日でも平日ダイヤで運行
const PSEUDO_WEEKDAYS = new Set(['4/29','7/20','10/12','11/3','11/23'])

// 年末年始は全便運休
const NO_SERVICE = new Set(['12/31','1/1','1/2','1/3'])

function dateKey(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

export function getSchedule(date) {
  const key = dateKey(date)
  if (NO_SERVICE.has(key)) return []
  if (PSEUDO_WEEKDAYS.has(key)) return WEEKDAY
  if (date.getDay() === 0 || date.getDay() === 6) return HOLIDAY
  return WEEKDAY
}

export function getReturnSchedule(date) {
  const key = dateKey(date)
  if (NO_SERVICE.has(key)) return []
  if (PSEUDO_WEEKDAYS.has(key)) return RETURN_WEEKDAY
  if (date.getDay() === 0 || date.getDay() === 6) return RETURN_HOLIDAY
  return RETURN_WEEKDAY
}

export function toDateTime(baseDate, timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  const dt = new Date(baseDate)
  dt.setHours(h, m, 0, 0)
  return dt
}

// 次の往路バス便を最大 count 件返す
export function findNextBuses(from, timetable, count = 3) {
  const results = []
  for (const t of timetable) {
    const bus = toDateTime(from, t)
    if (bus >= from) {
      results.push(bus)
      if (results.length >= count) break
    }
  }
  return results
}

// 次の復路バス便を返す
export function findNextReturnBus(now, timetable) {
  for (const [depStr, arrStr] of timetable) {
    const dep = toDateTime(now, depStr)
    if (dep >= now) {
      return { dep, arr: toDateTime(now, arrStr) }
    }
  }
  return null
}

// Yahoo!路線情報の検索URLを生成
export function yahooTransitUrl(from, to, departure) {
  const y  = departure.getFullYear()
  const mo = departure.getMonth() + 1
  const d  = departure.getDate()
  const hh = departure.getHours()
  const min = departure.getMinutes()
  const m1 = Math.floor(min / 10)
  const m2 = min % 10
  const params = new URLSearchParams({ from, to, y, m: mo, d, hh, m1, m2, type: 1 })
  return `https://transit.yahoo.co.jp/search/print?${params}`
}

export function formatTime(dt) {
  return dt.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
