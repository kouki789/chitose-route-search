import { useState, useEffect } from 'react'
import { CHITOSE_STATION, BUS_STOP, UNIVERSITY, TRANSFER_MIN, STOP_KEN, STOP_HON, ROUTE_STOPS, formatTime } from '../../utils/schedule'
import { diffMinutes, formatMinutes } from '../../utils/routeLogic'

// ── カウントダウン ──────────────────────────────────────────────────────────

function Countdown({ bus }) {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const diffMs = bus - new Date()
  if (diffMs <= 0) return <span className="countdown countdown--gone">発車済み</span>
  const mins = Math.floor(diffMs / 60000)
  const secs = Math.floor((diffMs % 60000) / 1000)
  const text = mins > 0 ? `あと ${mins}分 ${secs}秒` : `あと ${secs}秒`
  return <span className={`countdown ${mins < 3 ? 'countdown--urgent' : ''}`}>{text}</span>
}

// ── 停車バス停ポップアップ ──────────────────────────────────────────────────

function BusStopsPopup({ bus, onClose }) {
  const stops = ROUTE_STOPS[bus.stop] ?? []

  function calcTime(stop) {
    return formatTime(new Date(bus.dep.getTime() + stop.min * 60000))
  }

  return (
    <div className="stops-overlay" onClick={onClose}>
      <div className="stops-popup" onClick={e => e.stopPropagation()}>
        <div className="stops-popup-header">
          <span>停車バス停（{bus.stop}乗り場）</span>
          <button type="button" className="stops-popup-close" onClick={onClose}>✕</button>
        </div>
        <ol className="stops-list">
          {stops.map((stop, i) => {
            const isFirst = i === 0
            const isLast  = i === stops.length - 1
            const isKey   = isFirst || isLast || stop.name === STOP_KEN || stop.name === STOP_HON
            return (
              <li
                key={stop.name}
                className={[
                  'stops-item',
                  isFirst ? 'stops-item--first' : '',
                  isLast  ? 'stops-item--last'  : '',
                  isKey   ? 'stops-item--key'   : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="stops-dot" />
                <span className="stops-name">{stop.name}</span>
                <span className="stops-time">{calcTime(stop)}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

// ── バス結果表示 ────────────────────────────────────────────────────────────

function BusResultView({ br }) {
  const [popupBus, setPopupBus] = useState(null)
  if (br.status === 'none') {
    return <div className="transit-error">⚠️ {br.message}</div>
  }
  const statusClass = { good: 'bus-status--good', tight: 'bus-status--tight', long: 'bus-status--long' }[br.status] ?? ''

  return (
    <div>
      {br.message && <div className={`bus-status ${statusClass}`}>{br.message}</div>}
      <div className="bus-times">
        {br.buses.map((bus, i) => (
          <span key={i} className={`bus-time ${i === 0 ? 'next' : ''}`}>
            {i === 0 && <span className="bus-label">{br.status === 'tight' ? '⚠️ 次便' : '次便'}</span>}
            <div className="bus-dep-row">
              千歳駅前{bus.stop} <strong>{formatTime(bus.dep)}</strong>発
              {i === 0 && <Countdown bus={bus.dep} />}
            </div>
            <div className="bus-arr-row">
              研究棟 {formatTime(bus.kenArr)}着 ／ 本部棟 {formatTime(bus.honArr)}着
            </div>
            {ROUTE_STOPS[bus.stop] && (
              <button type="button" className="stops-show-btn" onClick={() => setPopupBus(bus)}>
                停車バス停を見る ▶
              </button>
            )}
          </span>
        ))}
      </div>
      {popupBus && <BusStopsPopup bus={popupBus} onClose={() => setPopupBus(null)} />}
    </div>
  )
}

// ── 経路ステップ ────────────────────────────────────────────────────────────

function TransitSteps({ steps, fallbackDep, fallbackArr, originOverride }) {
  if (!steps || steps.length === 0) {
    return fallbackDep && fallbackArr
      ? <div className="transit-fallback">🚃 {fallbackDep}発 → {fallbackArr}着</div>
      : null
  }

  const items = []
  const STEP_ICON = { walk: '🚶', bus: '🚌', air: '✈️', transit: '🚃' }
  const STEP_CLASS = { walk: 'walk', bus: 'bus', air: 'air', transit: 'transit' }

  steps.forEach((step, i) => {
    const icon = STEP_ICON[step.type] ?? '🚃'
    const cls  = STEP_CLASS[step.type] ?? 'transit'
    if (step.type === 'walk') {
      const fromLabel = (i === 0 && originOverride) ? originOverride : step.from
      items.push(
        <div key={`s${i}`} className="transit-step transit-step--walk">
          <span className="step-icon">{icon}</span>
          <div className="step-detail">
            <span className="step-line">{step.line || '徒歩'}</span>
            <div className="step-row">
              <span className="step-station">{fromLabel}</span>
              {step.dep && <span className="step-time">{step.dep}発</span>}
            </div>
            <div className="step-row">
              <span className="step-station">{step.to}</span>
              {step.arr && <span className="step-time">{step.arr}着</span>}
            </div>
          </div>
        </div>
      )
    } else {
      items.push(
        <div key={`s${i}`} className={`transit-step transit-step--${cls}`}>
          <span className="step-icon">{icon}</span>
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

    const next = steps[i + 1]
    if (next && step.type !== 'walk' && next.type !== 'walk') {
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

// ── ルートサマリー ──────────────────────────────────────────────────────────

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

// ── メイン結果コンポーネント ───────────────────────────────────────────────

export default function RouteResult({ result }) {
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
        <div className="result-section">
          <div className="section-header">
            <span className="step-num">①</span>
            <span className="section-title">{result.origin} → {CHITOSE_STATION}</span>
          </div>
          {result.transit1Loading && <div className="loading">検索中…</div>}
          {result.transit1Error && <div className="transit-error">⚠️ {result.transit1Error}</div>}
          {result.transit1 && (
            <>
              {result.transit1.airportNote && (
                <div className="airport-note">⚠️ {result.transit1.airportNote}</div>
              )}
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
                originOverride={result.origin}
              />
            </>
          )}
        </div>

        <div className="result-section">
          <div className="section-header">
            <span className="step-num">②</span>
            <span className="section-title">{CHITOSE_STATION} → {BUS_STOP}</span>
          </div>
          <div className="walk-info">🚶 徒歩 約{TRANSFER_MIN}分</div>
        </div>

        <div className="result-section">
          <div className="section-header">
            <span className="step-num">③</span>
            <span className="section-title">{BUS_STOP} → {UNIVERSITY}</span>
          </div>
          {result.busResult
            ? <BusResultView br={result.busResult} />
            : <div className="loading">検索中…</div>
          }
        </div>
      </div>
    )
  }

  return (
    <div className="route-result">
      <div className="result-section">
        <div className="section-header">
          <span className="step-num">①</span>
          <span className="section-title">{UNIVERSITY} → {BUS_STOP}</span>
        </div>
        <div className="bus-info">
          <div className="bus-dep-row">
            🚌 本部棟 <strong>{formatTime(result.bus.dep)}</strong>発
            {result.bus.kenDep && <span> ／ 研究棟 <strong>{formatTime(result.bus.kenDep)}</strong>発</span>}
          </div>
          <div className="bus-arr-row">千歳駅前 <strong>{formatTime(result.bus.arr)}</strong>着</div>
        </div>
      </div>

      <div className="result-section">
        <div className="section-header">
          <span className="step-num">②</span>
          <span className="section-title">{BUS_STOP} → {CHITOSE_STATION}</span>
        </div>
        <div className="walk-info">🚶 徒歩 約{TRANSFER_MIN}分</div>
      </div>

      <div className="result-section">
        <div className="section-header">
          <span className="step-num">③</span>
          <span className="section-title">{CHITOSE_STATION} → {result.destination}</span>
        </div>
        {result.transit2Loading && <div className="loading">検索中…</div>}
        {result.transit2Error && <div className="transit-error">⚠️ {result.transit2Error}</div>}
        {result.transit2 && (
          <>
            {result.transit2.airportNote && (
              <div className="airport-note">⚠️ {result.transit2.airportNote}</div>
            )}
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
