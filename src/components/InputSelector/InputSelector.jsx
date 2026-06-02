import { useState } from 'react'
import { STATION_GROUPS } from '../../utils/hokkaido'

export default function InputSelector({ value, onChange, label }) {
  const [mode, setMode] = useState('text')
  const [geoState, setGeoState] = useState('idle')
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
          placeholder="例: 札幌駅、中央区北1条西2丁目"
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
