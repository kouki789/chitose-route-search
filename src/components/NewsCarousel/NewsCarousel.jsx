import { useState, useEffect, useRef } from 'react'
import './NewsCarousel.css'
import newsData from '../../data/news.json'

const TAG_COLORS = {
  new:         { bg: '#dcfce7', color: '#166534', label: '新機能' },
  info:        { bg: '#dbeafe', color: '#1e40af', label: 'お知らせ' },
  important:   { bg: '#fee2e2', color: '#991b1b', label: '重要' },
  update:      { bg: '#ffedd5', color: '#9a3412', label: '更新' },
  maintenance: { bg: '#f3f4f6', color: '#4b5563', label: 'メンテナンス' },
}

const INTERVAL = 5000

export default function NewsCarousel() {
  const activeNews = newsData.filter(n => n.active)
  const [current, setCurrent] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)

  const total = activeNews.length
  if (total === 0) return null

  function next() { setCurrent(i => (i + 1) % total) }
  function prev() { setCurrent(i => (i - 1 + total) % total) }

  // 自動スライド
  useEffect(() => {
    if (paused || total <= 1) return
    timerRef.current = setInterval(next, INTERVAL)
    return () => clearInterval(timerRef.current)
  }, [paused, total, current])

  const item = activeNews[current]
  const tag = TAG_COLORS[item.tagType] ?? TAG_COLORS.info

  return (
    <div
      className="news-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="news-slide">
        <span
          className="news-tag"
          style={{ background: tag.bg, color: tag.color }}
        >
          {item.tag}
        </span>
        <div className="news-body">
          <div className="news-title">{item.title}</div>
          <div className="news-text">{item.body}</div>
          <div className="news-date">{item.date}</div>
        </div>
      </div>

      {total > 1 && (
        <div className="news-controls">
          <button className="news-arrow" onClick={prev}>‹</button>
          <div className="news-dots">
            {activeNews.map((_, i) => (
              <button
                key={i}
                className={`news-dot ${i === current ? 'active' : ''}`}
                onClick={() => setCurrent(i)}
              />
            ))}
          </div>
          <button className="news-arrow" onClick={next}>›</button>
        </div>
      )}
    </div>
  )
}
