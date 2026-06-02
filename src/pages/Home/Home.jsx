import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import {
  getSchedule, getReturnSchedule,
  findNextReturnBus, toDateTime,
  CHITOSE_STATION, TRANSFER_MIN,
} from '../../utils/schedule'
import { fetchTransit, findOptimalBusResult } from '../../utils/routeLogic'
import { useFavorites } from '../../hooks/useFavorites'
import RouteResult from '../../components/RouteResult/RouteResult'
import InputSelector from '../../components/InputSelector/InputSelector'
import NewsCarousel from '../../components/NewsCarousel/NewsCarousel'

export default function Home() {
  const [direction, setDirection] = useState('outbound')
  const [inputValue, setInputValue] = useState('')
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(new Date())
  const [selectedBus, setSelectedBus] = useState(null)
  const [busPickerOpen, setBusPickerOpen] = useState(false)
  const { favorites, add: addFav, remove: removeFav } = useFavorites()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  async function handleSearch(e) {
    e.preventDefault()
    if (!inputValue.trim()) return

    if (direction === 'outbound') {
      const timetable = getSchedule(now)
      if (!timetable.length) { setResult({ type: 'outbound', noService: true }); return }

      const base = { type: 'outbound', origin: inputValue.trim(), busResult: null, transit1Loading: true, transit1: null, transit1Error: null }
      setResult(base)

      try {
        let transit1
        const busDep = selectedBus ? toDateTime(now, selectedBus[0]) : null

        if (selectedBus) {
          // type=4: 千歳駅への着時刻 = バス出発 − 乗換時間 を指定して逆算検索
          const requiredArrival = new Date(busDep.getTime() - TRANSFER_MIN * 60000)
          transit1 = await fetchTransit(inputValue.trim(), CHITOSE_STATION, requiredArrival, 4)
        } else {
          transit1 = await fetchTransit(inputValue.trim(), CHITOSE_STATION, now)
        }

        let busResult
        if (transit1.arrTime) {
          const [ah, am] = transit1.arrTime.split(':').map(Number)
          const stationArrival = new Date(now)
          stationArrival.setHours(ah, am, 0, 0)
          if (stationArrival < now) stationArrival.setDate(stationArrival.getDate() + 1)
          const busStopArrival = new Date(stationArrival.getTime() + TRANSFER_MIN * 60000)

          if (selectedBus && busStopArrival <= busDep) {
            // 指定バスに間に合う
            busResult = {
              buses: [{ dep: busDep, kenArr: toDateTime(now, selectedBus[1]), honArr: toDateTime(now, selectedBus[2]), stop: selectedBus[3] }],
              status: 'good', waitMin: 0,
              message: `指定バス（${selectedBus[0]}発）で乗車`,
            }
          } else if (selectedBus) {
            // 指定バスに間に合わない（Yahoo!が制約を満たせなかった）→ 次の便を自動表示
            busResult = findOptimalBusResult(busStopArrival, timetable)
            busResult = { ...busResult, message: `⚠️ ${selectedBus[0]}発には間に合わないため、次の便を表示しています` }
          } else {
            busResult = findOptimalBusResult(busStopArrival, timetable)
          }
        } else {
          busResult = selectedBus
            ? { buses: [{ dep: busDep, kenArr: toDateTime(now, selectedBus[1]), honArr: toDateTime(now, selectedBus[2]), stop: selectedBus[3] }], status: 'good', waitMin: 0, message: `指定バス（${selectedBus[0]}発）で乗車` }
            : findOptimalBusResult(new Date(now.getTime() + TRANSFER_MIN * 60000), timetable)
        }

        setResult(r => ({ ...r, transit1Loading: false, transit1, busResult }))
      } catch (e) {
        const busResult = findOptimalBusResult(new Date(now.getTime() + TRANSFER_MIN * 60000), timetable)
        setResult(r => ({ ...r, transit1Loading: false, transit1Error: e.message, busResult }))
      }

    } else {
      const timetable = getReturnSchedule(now)
      if (!timetable.length) { setResult({ type: 'return', noService: true }); return }

      let bus
      if (selectedBus) {
        bus = {
          dep:    toDateTime(now, selectedBus[0]),
          kenDep: toDateTime(now, selectedBus[1]),
          arr:    toDateTime(now, selectedBus[2]),
        }
      } else {
        bus = findNextReturnBus(now, timetable)
        if (!bus) { setResult({ type: 'return', noService: true }); return }
      }

      const chitoseDep = new Date(bus.arr.getTime() + TRANSFER_MIN * 60000)
      const base = { type: 'return', destination: inputValue.trim(), bus, transit2Loading: true, transit2: null, transit2Error: null }
      setResult(base)

      try {
        const transit2 = await fetchTransit(CHITOSE_STATION, inputValue.trim(), chitoseDep)
        setResult(r => ({ ...r, transit2Loading: false, transit2 }))
      } catch {
        setResult(r => ({ ...r, transit2Loading: false, transit2Error: '路線情報を取得できませんでした' }))
      }
    }
  }

  function handleToggle(dir) {
    setDirection(dir)
    setInputValue('')
    setResult(null)
    setSelectedBus(null)
    setBusPickerOpen(false)
  }

  const busTimetable = direction === 'outbound' ? getSchedule(now) : getReturnSchedule(now)

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">公立千歳科学技術大学-ルート検索サイト（非公式）</div>
            <h1>公立千歳科学技術大学までの<br />ルート検索サイトです。<br />
              入力情報や出力結果は記録されていません。</h1>
            <p>
                Route Search for Chitose Institute of Science and Technology.<br />
            </p>
            <p className="hero-desc">ご希望の出発地/目的地を入力してください。</p>

            <div className="direction-toggle">
              <button className={`direction-btn ${direction === 'outbound' ? 'active' : ''}`} onClick={() => handleToggle('outbound')}>
                往路（行き）
              </button>
              <button className={`direction-btn ${direction === 'return' ? 'active' : ''}`} onClick={() => handleToggle('return')}>
                復路（帰り）
              </button>
            </div>

            {busTimetable.length > 0 && (
              <div className="bus-picker">
                <button
                  type="button"
                  className={`bus-picker-toggle ${selectedBus ? 'bus-picker-toggle--selected' : ''}`}
                  onClick={() => setBusPickerOpen(o => !o)}
                >
                  🚌 {selectedBus
                    ? `${selectedBus[0]}発を指定中`
                    : direction === 'outbound' ? '大学までのバスを指定' : '大学からのバスを指定'}
                  <span className="bus-picker-caret">{busPickerOpen ? '▲' : '▼'}</span>
                </button>
                {busPickerOpen && (
                  <div className="bus-picker-chips">
                    <button
                      type="button"
                      className={`bus-chip ${!selectedBus ? 'bus-chip--active' : ''}`}
                      onClick={() => { setSelectedBus(null); setBusPickerOpen(false) }}
                    >自動</button>
                    {busTimetable.map((t, i) => {
                      const timeStr = t[0]
                      const isPast = toDateTime(now, timeStr) < now
                      const isSelected = selectedBus?.[0] === t[0]
                      return (
                        <button
                          key={i}
                          type="button"
                          className={`bus-chip ${isSelected ? 'bus-chip--active' : ''} ${isPast ? 'bus-chip--past' : ''}`}
                          onClick={() => { setSelectedBus(isSelected ? null : t); setBusPickerOpen(false) }}
                        >
                          {timeStr}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            <form className="route-input-wrap" onSubmit={handleSearch}>
              <InputSelector
                label={direction === 'outbound' ? '出発地を入力' : '目的地を入力'}
                value={inputValue}
                onChange={v => { setInputValue(v); setResult(null) }}
              />
              <div className="search-actions">
                <button type="submit" className="route-search-btn" disabled={!inputValue.trim()}>
                  検索
                </button>
                <button
                  type="button"
                  className={`fav-btn ${favorites.includes(inputValue.trim()) ? 'fav-btn--active' : ''}`}
                  onClick={() => favorites.includes(inputValue.trim()) ? removeFav(inputValue.trim()) : addFav(inputValue.trim())}
                  disabled={!inputValue.trim()}
                  title="お気に入りに追加"
                >
                  {favorites.includes(inputValue.trim()) ? '★' : '☆'}
                </button>
              </div>
              {favorites.length > 0 && (
                <div className="favorites">
                  <span className="fav-label">お気に入り</span>
                  <div className="fav-chips">
                    {favorites.map(f => (
                      <span key={f} className="fav-chip">
                        <button type="button" className="fav-chip-name" onClick={() => { setInputValue(f); setResult(null) }}>
                          {f}
                        </button>
                        <button type="button" className="fav-chip-remove" onClick={() => removeFav(f)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </form>

            {result && <RouteResult result={result} />}

            <NewsCarousel />

            <div className="disclaimer">
              <div className="disclaimer-row">
                <span className="disclaimer-icon">⚠️</span>
                <strong>非公式サイト</strong>
              </div>
              <ul className="disclaimer-list">
                <li>このサイトは個人が運営する非公式サービスであり、公立千歳科学技術大学とは一切関係ありません。</li>
                <li>提供するルート情報はあくまで参考です。実際の乗車前に各交通機関の公式情報を必ずご確認ください。</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="discord-section">
        <div className="container">
          <div className="discord-card">
            <div className="discord-icon">🤖</div>
            <div className="discord-text">
              <h2>Discord Bot でも使えます</h2>
              <p>
                このサイトと同じルート検索ロジックを搭載した Discord Bot があります。
                サーバーに追加すると <code>/route</code> ・ <code>/return</code> コマンドでいつでもルートを確認できます。
              </p>
            </div>
            <a
              className="discord-btn"
              href="https://discord.com/oauth2/authorize?client_id=1509661105922900038&permissions=8&integration_type=0&scope=bot"
              target="_blank"
              rel="noreferrer"
            >
              <svg className="discord-logo" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              Discord に追加する
            </a>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="container">
          <div className="footer-logo">公立千歳科学技術大学-ルート検索サイト</div>
          <p>© 2026 Kouki Hashikake. All rights reserved.</p>
          <p className="footer-credit">
※This is an unofficial student-made service.<br />※本サービスは個人が開発・運営している非公式サービスです。</p>
          <div className="footer-links">
            <Link to="/terms" className="footer-link">利用規約</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
