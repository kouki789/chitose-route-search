import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import './Home.css'
import {
  getSchedule, getReturnSchedule,
  findNextBuses, findNextReturnBus,
  formatTime,
  CHITOSE_STATION, BUS_STOP, UNIVERSITY, TRANSFER_MIN,
} from '../../utils/schedule'
import { STATION_GROUPS } from '../../utils/hokkaido'

// ── API ────────────────────────────────────────────────────────────────────

async function fetchTransit(from, to, departure) {
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

// ── 所要時間の表示 ─────────────────────────────────────────────────────────

function diffMinutes(dep, arr) {
  const [dh, dm] = dep.split(':').map(Number)
  const [ah, am] = arr.split(':').map(Number)
  return (ah * 60 + am) - (dh * 60 + dm)
}

function formatMinutes(min) {
  if (!min && min !== 0) return null
  if (min < 60) return `${min}分`
  return `${Math.floor(min / 60)}時間${min % 60 > 0 ? `${min % 60}分` : ''}`
}

// ── ルート結果コンポーネント ───────────────────────────────────────────────

function TransitSteps({ steps, fallbackDep, fallbackArr }) {
  if (!steps || steps.length === 0) {
    return fallbackDep && fallbackArr ? (
      <div className="transit-fallback">🚃 {fallbackDep}発 → {fallbackArr}着</div>
    ) : null
  }

  const items = []
  steps.forEach((step, i) => {
    if (step.type === 'walk') {
      items.push(
        <div key={`s${i}`} className="transit-step transit-step--walk">
          <span className="step-icon">🚶</span>
          <div className="step-detail">
            <span className="step-line">{step.line || '徒歩'}</span>
            <span className="step-stations">{step.from} → {step.to}</span>
          </div>
        </div>
      )
    } else {
      items.push(
        <div key={`s${i}`} className="transit-step transit-step--transit">
          <span className="step-icon">🚃</span>
          <div className="step-detail">
            <span className="step-line">{step.line}</span>
            <div className="step-row">
              <span className="step-station">{step.from}</span>
              <span className="step-time">{step.dep}発</span>
            </div>
            <div className="step-row">
              <span className="step-station">{step.to}</span>
              <span className="step-time">{step.arr}着</span>
            </div>
            {step.price && <span className="step-price">💴 ¥{step.price}</span>}
          </div>
        </div>
      )
    }

    // 乗り換え表示: transit → transit の間
    const next = steps[i + 1]
    if (next && step.type === 'transit' && next.type === 'transit') {
      const waitMin = (step.arr && next.dep) ? diffMinutes(step.arr, next.dep) : null
      items.push(
        <div key={`t${i}`} className="transfer-row">
          <span className="transfer-icon">🔄</span>
          <span className="transfer-text">
            {step.to} で乗り換え
            {waitMin != null && waitMin > 0 && <span className="transfer-wait">（待ち {waitMin}分）</span>}
          </span>
        </div>
      )
    }
  })

  return <div className="transit-steps">{items}</div>
}

function RouteSummary({ dep, arr, totalPrice, totalTime }) {
  const displayTime = totalTime ?? (dep && arr ? formatMinutes(diffMinutes(dep, arr)) : null)
  return (
    <div className="route-summary">
      <div className="route-summary-times">
        <span className="summary-dep">{dep}<span className="summary-label">発</span></span>
        <span className="summary-arrow">→</span>
        <span className="summary-arr">{arr}<span className="summary-label">着</span></span>
      </div>
      <div className="route-summary-meta">
        {displayTime && <span className="meta-item">🕐 {displayTime}</span>}
        {totalPrice && <span className="meta-item">💴 ¥{totalPrice}</span>}
      </div>
    </div>
  )
}

function RouteResult({ result }) {
  if (result.noService) {
    return (
      <div className="route-result">
        <p className="result-no-service">🚌 本日のバスは運休です。</p>
      </div>
    )
  }

  if (result.type === 'outbound') {
    return (
      <div className="route-result">
        {/* ① 出発地 → 千歳駅 */}
        <div className="result-section">
          <div className="section-header">
            <span className="step-num">①</span>
            <span className="section-title">{result.origin} → {CHITOSE_STATION}</span>
          </div>
          {result.transit1Loading && <div className="loading">検索中…</div>}
          {result.transit1Error && <div className="transit-error">⚠️ {result.transit1Error}</div>}
          {result.transit1 && (
            <>
              <RouteSummary
                dep={result.transit1.depTime}
                arr={result.transit1.arrTime}
                totalPrice={result.transit1.totalPrice}
                totalTime={result.transit1.totalTime}
              />
              <TransitSteps
                steps={result.transit1.steps}
                fallbackDep={result.transit1.depTime}
                fallbackArr={result.transit1.arrTime}
              />
            </>
          )}
        </div>

        {/* ② 千歳駅 → 千歳駅前 */}
        <div className="result-section">
          <div className="section-header">
            <span className="step-num">②</span>
            <span className="section-title">{CHITOSE_STATION} → {BUS_STOP}</span>
          </div>
          <div className="walk-info">🚶 徒歩 約{TRANSFER_MIN}分</div>
        </div>

        {/* ③ バス */}
        <div className="result-section">
          <div className="section-header">
            <span className="step-num">③</span>
            <span className="section-title">{BUS_STOP} → {UNIVERSITY}</span>
          </div>
          {result.nextBuses.length > 0 ? (
            <div className="bus-times">
              {result.nextBuses.map((bus, i) => (
                <span key={i} className={`bus-time ${i === 0 ? 'next' : ''}`}>
                  {i === 0 && <span className="bus-label">次便</span>}
                  {formatTime(bus)}
                </span>
              ))}
            </div>
          ) : (
            <div className="transit-error">⚠️ 本日の便はすべて終了しています。</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="route-result">
      {/* ① バス */}
      <div className="result-section">
        <div className="section-header">
          <span className="step-num">①</span>
          <span className="section-title">{UNIVERSITY} → {BUS_STOP}</span>
        </div>
        <div className="bus-info">
          🚌 発車: <strong>{formatTime(result.bus.dep)}</strong>
          {BUS_STOP}着: <strong>{formatTime(result.bus.arr)}</strong>
        </div>
      </div>

      {/* ② 千歳駅前 → 千歳駅 */}
      <div className="result-section">
        <div className="section-header">
          <span className="step-num">②</span>
          <span className="section-title">{BUS_STOP} → {CHITOSE_STATION}</span>
        </div>
        <div className="walk-info">🚶 徒歩 約{TRANSFER_MIN}分</div>
      </div>

      {/* ③ 千歳駅 → 目的地 */}
      <div className="result-section">
        <div className="section-header">
          <span className="step-num">③</span>
          <span className="section-title">{CHITOSE_STATION} → {result.destination}</span>
        </div>
        {result.transit2Loading && <div className="loading">検索中…</div>}
        {result.transit2Error && <div className="transit-error">⚠️ {result.transit2Error}</div>}
        {result.transit2 && (
          <>
            <RouteSummary
              dep={result.transit2.depTime}
              arr={result.transit2.arrTime}
              totalPrice={result.transit2.totalPrice}
              totalTime={result.transit2.totalTime}
            />
            <TransitSteps
              steps={result.transit2.steps}
              fallbackDep={result.transit2.depTime}
              fallbackArr={result.transit2.arrTime}
            />
          </>
        )}
      </div>
    </div>
  )
}

// ── 入力セレクター ─────────────────────────────────────────────────────────

function InputSelector({ value, onChange, label }) {
  const [mode, setMode] = useState('text')           // 'text' | 'location' | 'list'
  const [geoState, setGeoState] = useState('idle')   // 'idle' | 'loading' | 'done' | 'error'
  const [geoMsg, setGeoMsg] = useState('')
  const [selGroup, setSelGroup] = useState('')
  const [selStation, setSelStation] = useState('')

  const currentGroup = STATION_GROUPS.find(g => g.group === selGroup)

  async function handleLocation() {
    if (!navigator.geolocation) {
      setGeoState('error'); setGeoMsg('この端末では位置情報を使用できません')
      return
    }
    setGeoState('loading')
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`/api/geocode?lat=${coords.latitude}&lon=${coords.longitude}`)
          const data = await res.json()
          if (data.error) throw new Error(data.error)
          onChange(data.location)
          setGeoMsg(data.location)
          setGeoState('done')
        } catch (e) {
          setGeoState('error'); setGeoMsg(e.message)
        }
      },
      () => { setGeoState('error'); setGeoMsg('位置情報の取得を許可してください') }
    )
  }

  function handleGroupChange(e) {
    setSelGroup(e.target.value)
    setSelStation('')
    onChange('')
  }

  function handleStationChange(e) {
    setSelStation(e.target.value)
    onChange(e.target.value)
  }

  function switchMode(m) {
    setMode(m)
    setGeoState('idle'); setGeoMsg('')
    setSelGroup(''); setSelStation('')
    onChange('')
  }

  return (
    <div className="input-selector">
      <div className="input-mode-tabs">
        <button type="button" className={`mode-tab ${mode === 'text' ? 'active' : ''}`} onClick={() => switchMode('text')}>✏️ 手入力</button>
        <button type="button" className={`mode-tab ${mode === 'location' ? 'active' : ''}`} onClick={() => switchMode('location')}>📍 現在地</button>
        <button type="button" className={`mode-tab ${mode === 'list' ? 'active' : ''}`} onClick={() => switchMode('list')}>📋 リスト</button>
      </div>

      <label className="route-label">{label}</label>

      {mode === 'text' && (
        <input
          className="route-input"
          type="text"
          placeholder="例: 札幌駅"
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      )}

      {mode === 'location' && (
        <div className="location-wrap">
          <button type="button" className="location-btn" onClick={handleLocation} disabled={geoState === 'loading'}>
            {geoState === 'loading' ? '取得中…' : '📍 現在地を取得'}
          </button>
          {geoState === 'done' && <span className="location-result">✅ {geoMsg}</span>}
          {geoState === 'error' && <span className="location-error">⚠️ {geoMsg}</span>}
        </div>
      )}

      {mode === 'list' && (
        <div className="list-wrap">
          <select className="route-select" value={selGroup} onChange={handleGroupChange}>
            <option value="">── 地域を選択 ──</option>
            {STATION_GROUPS.map(g => (
              <option key={g.group} value={g.group}>{g.group}</option>
            ))}
          </select>
          {currentGroup && (
            <select className="route-select" value={selStation} onChange={handleStationChange}>
              <option value="">── 駅・地名を選択 ──</option>
              {currentGroup.items.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  )
}

// ── メインコンポーネント ───────────────────────────────────────────────────

export default function Home() {
  const [direction, setDirection] = useState('outbound')
  const [inputValue, setInputValue] = useState('')
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(new Date())

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

      const busStopArrival = new Date(now.getTime() + TRANSFER_MIN * 60000)
      const nextBuses = findNextBuses(busStopArrival, timetable, 3)

      // 先に骨格を表示してから API 呼び出し
      const base = { type: 'outbound', origin: inputValue.trim(), nextBuses, transit1Loading: true, transit1: null, transit1Error: null }
      setResult(base)

      try {
        const transit1 = await fetchTransit(inputValue.trim(), CHITOSE_STATION, now)
        setResult(r => ({ ...r, transit1Loading: false, transit1 }))
      } catch {
        setResult(r => ({ ...r, transit1Loading: false, transit1Error: '路線情報を取得できませんでした' }))
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
            <div className="hero-badge">公立千歳科学技術大学-ルート検索サイト</div>
            <h1>公立千歳科学技術大学までの<br />ルート検索サイトです。<br />
              入力情報や出力結果は記録されていません。</h1>
            <p className="hero-desc">ご希望の目的地を入力してください。</p>

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
              <button type="submit" className="route-search-btn" disabled={!inputValue.trim()}>
                検索
              </button>
            </form>

            {result && <RouteResult result={result} />}
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
                サーバーに追加すると <code>/route</code>・<code>/return</code> コマンドで
                いつでもルートを確認できます。
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
          <p>© 2026 公立千歳科学技術大学. All rights reserved by b2241760.</p>
          <div className="footer-links">
            <Link to="/terms" className="footer-link">利用規約</Link>
            {/* <Link to="/donation" className="footer-link">寄付</Link> */}
          </div>
        </div>
      </footer>
    </main>
  )
}
