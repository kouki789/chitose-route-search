import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import {
  getSchedule, getReturnSchedule,
  findNextReturnBus,
  CHITOSE_STATION, TRANSFER_MIN,
} from '../../utils/schedule'
import { fetchTransit, findOptimalBusResult } from '../../utils/routeLogic'
import { useFavorites } from '../../hooks/useFavorites'
import RouteResult from '../../components/RouteResult/RouteResult'
import InputSelector from '../../components/InputSelector/InputSelector'

export default function Home() {
  const [direction, setDirection] = useState('outbound')
  const [inputValue, setInputValue] = useState('')
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(new Date())
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
        const transit1 = await fetchTransit(inputValue.trim(), CHITOSE_STATION, now)

        let busResult
        if (transit1.arrTime) {
          const [ah, am] = transit1.arrTime.split(':').map(Number)
          const stationArrival = new Date(now)
          stationArrival.setHours(ah, am, 0, 0)
          if (stationArrival < now) stationArrival.setDate(stationArrival.getDate() + 1)
          const busStopArrival = new Date(stationArrival.getTime() + TRANSFER_MIN * 60000)
          busResult = findOptimalBusResult(busStopArrival, timetable)
        } else {
          busResult = findOptimalBusResult(new Date(now.getTime() + TRANSFER_MIN * 60000), timetable)
        }

        setResult(r => ({ ...r, transit1Loading: false, transit1, busResult }))
      } catch (e) {
        const busResult = findOptimalBusResult(new Date(now.getTime() + TRANSFER_MIN * 60000), timetable)
        setResult(r => ({ ...r, transit1Loading: false, transit1Error: e.message, busResult }))
      }

    } else {
      const timetable = getReturnSchedule(now)
      if (!timetable.length) { setResult({ type: 'return', noService: true }); return }

      const bus = findNextReturnBus(now, timetable)
      if (!bus) { setResult({ type: 'return', noService: true }); return }

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
  }

  return (
    <main>
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-badge">公立千歳科学技術大学-ルート検索サイト（非公式）</div>
            <h1>公立千歳科学技術大学までの<br />ルート検索サイトです。<br />
              入力情報や出力結果は記録されていません。</h1>
            <p1>
                Route Search for Chitose Institute of Science and Technology.<br />
            </p1>
            <p className="hero-desc">ご希望の出発地/目的地を入力してください。</p>

            <div className="direction-toggle">
              <button className={`direction-btn ${direction === 'outbound' ? 'active' : ''}`} onClick={() => handleToggle('outbound')}>
                往路（行き）
              </button>
              <button className={`direction-btn ${direction === 'return' ? 'active' : ''}`} onClick={() => handleToggle('return')}>
                復路（帰り）
              </button>
            </div>

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
