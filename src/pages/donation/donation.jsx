import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './donation.css'

const AMOUNTS = [500, 1000, 3000, 5000, 10000]

export default function Donation() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState(1000)
  const [custom, setCustom] = useState('')
  const [message, setMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const finalAmount = custom ? Number(custom) : selected

  function handleSubmit(e) {
    e.preventDefault()
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <main className="donation-page">
        <div className="donation-container">
          <div className="donation-thanks">
            <div className="thanks-icon">🎉</div>
            <h1>ありがとうございます！</h1>
            <p>{finalAmount.toLocaleString()}円のご支援を受け付けました。</p>
            <button className="btn-back" onClick={() => navigate('/')}>
              トップに戻る
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="donation-page">
      <div className="donation-container">
        <div className="donation-header">
          <h1>寄付のお願い</h1>
          <p>
            このサービスは公立千歳科学技術大学のルート検索を無料で提供しています。
            サービスの継続・改善のため、ご支援をよろしくお願いします。
          </p>
        </div>

        <form className="donation-form" onSubmit={handleSubmit}>
          <section className="form-section">
            <h2>金額を選択</h2>
            <div className="amount-grid">
              {AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`amount-btn ${selected === amt && !custom ? 'active' : ''}`}
                  onClick={() => { setSelected(amt); setCustom('') }}
                >
                  ¥{amt.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="custom-amount">
              <label>金額を直接入力</label>
              <div className="input-wrap">
                <span className="currency">¥</span>
                <input
                  type="number"
                  min="1"
                  placeholder="例: 2000"
                  value={custom}
                  onChange={(e) => { setCustom(e.target.value); setSelected(null) }}
                />
              </div>
            </div>
          </section>

          <section className="form-section">
            <h2>メッセージ（任意）</h2>
            <textarea
              className="message-input"
              rows={4}
              placeholder="応援メッセージをどうぞ"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </section>

          <div className="donation-summary">
            <span>寄付金額</span>
            <span className="summary-amount">
              ¥{finalAmount ? finalAmount.toLocaleString() : '—'}
            </span>
          </div>

          <button
            type="submit"
            className="btn-donate"
            disabled={!finalAmount || finalAmount <= 0}
          >
            寄付する
          </button>
        </form>
      </div>
    </main>
  )
}
