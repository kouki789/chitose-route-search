export const CHITOSE_STATION = '千歳駅'
export const BUS_STOP = '千歳駅前'
export const UNIVERSITY = '公立千歳科学技術大学'
export const TRANSFER_MIN = 5

// 往路 [千歳駅前dep, 研究棟arr, 本部棟arr, 乗り場]
const WEEKDAY = [
  ['07:14', '07:32', '07:35', '3番'],
  ['07:20', '07:44', '07:45', '5番'],
  ['07:29', '07:47', '07:50', '3番'],
  ['08:04', '08:22', '08:25', '3番'],
  ['08:14', '08:32', '08:35', '3番'],
  ['08:19', '08:37', '08:40', '3番'],
  ['08:24', '08:42', '08:45', '3番'],
  ['08:29', '08:47', '08:50', '3番'],
  ['09:04', '09:22', '09:25', '3番'],
  ['09:19', '09:37', '09:40', '3番'],
  ['09:34', '09:52', '09:55', '3番'],
  ['09:44', '10:02', '10:05', '3番'],
  ['09:54', '10:12', '10:15', '3番'],
  ['10:04', '10:22', '10:25', '3番'],
  ['10:14', '10:32', '10:35', '3番'],
  ['10:30', '10:54', '10:55', '5番'],
  ['11:00', '11:24', '11:25', '5番'],
  ['11:29', '11:53', '11:54', '5番'],
  ['12:10', '12:34', '12:35', '5番'],
  ['12:19', '12:43', '12:44', '5番'],
  ['13:20', '13:44', '13:45', '5番'],
  ['14:24', '14:42', '14:45', '3番'],
  ['14:29', '14:53', '14:54', '5番'],
  ['15:22', '15:40', '15:43', '3番'],
  ['15:55', '16:13', '16:16', '3番'],
  ['16:04', '16:22', '16:25', '3番'],
  ['17:51', '18:09', '18:12', '3番'],
]

const HOLIDAY = [
  ['07:20', '07:44', '07:45', '5番'],
  ['08:18', '08:42', '08:43', '5番'],
  ['09:10', '09:34', '09:35', '5番'],
  ['11:29', '11:53', '11:54', '5番'],
  ['13:20', '13:44', '13:45', '5番'],
]

// 復路 [本部棟dep, 研究棟dep, 千歳駅前arr]
const RETURN_WEEKDAY = [
  ['11:02', '11:05', '11:24'],
  ['11:36', '11:39', '12:02'],
  ['12:27', '12:30', '12:49'],
  ['13:07', '13:10', '13:29'],
  ['13:35', '13:38', '14:01'],
  ['14:17', '14:20', '14:39'],
  ['15:02', '15:05', '15:24'],
  ['15:24', '15:27', '15:50'],
  ['16:42', '16:45', '17:04'],
  ['16:47', '16:50', '17:13'],
  ['17:02', '17:05', '17:24'],
  ['17:30', '17:33', '17:52'],
  ['17:52', '17:55', '18:18'],
  ['18:27', '18:30', '18:49'],
  ['19:02', '19:05', '19:28'],
  ['19:42', '19:45', '20:08'],
  ['20:32', '20:35', '21:00'],
  ['21:22', '21:25', '21:48'],
  ['22:02', '22:05', '22:30'],
]

const RETURN_HOLIDAY = [
  ['12:42', '12:45', '13:08'],
  ['14:32', '14:35', '14:58'],
  ['15:24', '15:27', '15:50'],
  ['16:47', '16:50', '17:13'],
  ['17:52', '17:55', '18:18'],
  ['19:02', '19:05', '19:28'],
  ['20:32', '20:35', '21:00'],
  ['22:02', '22:05', '22:30'],
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
// 戻り値: { dep, kenArr, honArr, stop } の配列（各値は Date）
export function findNextBuses(from, timetable, count = 3) {
  const results = []
  for (const entry of timetable) {
    const dep = toDateTime(from, entry[0])
    if (dep >= from) {
      results.push({
        dep,
        kenArr: toDateTime(from, entry[1]),
        honArr: toDateTime(from, entry[2]),
        stop:   entry[3],
      })
      if (results.length >= count) break
    }
  }
  return results
}

// 次の復路バス便を返す
// 戻り値: { dep, kenDep, arr }（dep=本部棟発, kenDep=研究棟発, arr=千歳駅前着）
export function findNextReturnBus(now, timetable) {
  for (const entry of timetable) {
    const dep = toDateTime(now, entry[0])
    if (dep >= now) {
      return {
        dep,
        kenDep: toDateTime(now, entry[1]),
        arr:    toDateTime(now, entry[2]),
      }
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
