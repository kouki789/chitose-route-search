import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Guide.css'

const SLIDES = [
  {
    step: 1,
    title: '往路・復路を選ぶ',
    description: '画面上部のボタンで方向を選択します。\n\n・往路（行き）→ 出発地を入力して大学までのルートを検索\n・復路（帰り）→ 目的地を入力して大学からのルートを検索',
    image: '/images/guide/step1.svg',
    alt: '往路・復路の選択ボタン',
  },
  {
    step: 2,
    title: '出発地 / 目的地を入力する',
    description: '3つの方法から入力できます。\n\n・✏️ 手入力 — 駅名・地名・住所を直接入力\n・📍 現在地 — GPSで現在地を自動取得\n・📋 リスト — 北海道の駅・地名から選択',
    image: '/images/guide/step2.svg',
    alt: '入力方法の選択',
  },
  {
    step: 3,
    title: '検索ボタンを押す',
    description: '入力後に「検索」ボタンを押すと、Yahoo! 路線情報をもとにルートを表示します。\n\n☆ボタンでよく使う駅をお気に入り登録できます。次回からワンタップで入力できます。',
    image: '/images/guide/step3.svg',
    alt: '検索ボタンとお気に入り',
  },
  {
    step: 4,
    title: '結果を確認する',
    description: '3ステップで結果が表示されます。\n\n① 出発地 → 千歳駅（路線・時刻・料金）\n② 千歳駅 → 千歳駅前（徒歩 約5分）\n③ 千歳駅前バス → 大学（次便とカウントダウン）',
    image: '/images/guide/step4.svg',
    alt: '検索結果の見方',
  },
  {
    step: 5,
    title: 'バスのカウントダウン',
    description: '③のバス欄には「あと○分○秒」のカウントダウンが表示されます。\n\n・残り3分未満になると赤く点滅\n・「発車済み」になると次便に切り替わります',
    image: '/images/guide/step5.svg',
    alt: 'バスカウントダウン',
  },
  {
    step: 6,
    title: 'Discord Bot でも使える',
    description: '同じルート検索機能をDiscordサーバーでも使えます。\n\n・/route [出発駅] → 大学までのルートを表示\n・/return [目的駅] → 大学からのルートを表示\n\nページ下部のボタンからサーバーに追加できます。',
    image: '/images/guide/step6.svg',
    alt: 'Discord Bot の使い方',
  },
]

export default function Guide() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const slide = SLIDES[current]
  const total = SLIDES.length

  function prev() { setCurrent(i => Math.max(0, i - 1)) }
  function next() { setCurrent(i => Math.min(total - 1, i + 1)) }

  function handleKey(e) {
    if (e.key === 'ArrowLeft') prev()
    if (e.key === 'ArrowRight') next()
  }

  return (
    <main className="guide-page">
      <div className="guide-container">
        <button className="guide-back" onClick={() => navigate(-1)}>← 戻る</button>
        <h1 className="guide-title">使い方ガイド</h1>

        <div className="slideshow" onKeyDown={handleKey} tabIndex={0}>
          {/* 画像エリア */}
          <div className="slide-image-wrap">
            <img
              src={slide.image}
              alt={slide.alt}
              className="slide-image"
              onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
            />
            <div className="slide-image-placeholder">
              <span>Step {slide.step}</span>
              <small>画像を<br />public/images/guide/step{slide.step}.svg<br />に配置してください</small>
            </div>
          </div>

          {/* テキストエリア */}
          <div className="slide-content">
            <div className="slide-step">STEP {slide.step} / {total}</div>
            <h2 className="slide-title">{slide.title}</h2>
            <p className="slide-desc">{slide.description}</p>
          </div>

          {/* ナビゲーション */}
          <div className="slide-nav">
            <button className="slide-arrow" onClick={prev} disabled={current === 0}>‹</button>
            <div className="slide-dots">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  className={`slide-dot ${i === current ? 'active' : ''}`}
                  onClick={() => setCurrent(i)}
                  aria-label={`スライド ${i + 1}`}
                />
              ))}
            </div>
            <button className="slide-arrow" onClick={next} disabled={current === total - 1}>›</button>
          </div>
        </div>

        {current === total - 1 && (
          <div className="guide-end">
            <p>以上で使い方の説明は終わりです。</p>
            <button className="btn-start" onClick={() => navigate('/')}>検索を始める</button>
          </div>
        )}
      </div>
    </main>
  )
}
