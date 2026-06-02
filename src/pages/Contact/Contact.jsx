import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Contact.css'

const STATUSES = { idle: 'idle', sending: 'sending', done: 'done', error: 'error' }

export default function Contact() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [status, setStatus] = useState(STATUSES.idle)
  const [errorMsg, setErrorMsg] = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus(STATUSES.sending)
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || '送信に失敗しました')
      setStatus(STATUSES.done)
    } catch (e) {
      setStatus(STATUSES.error)
      setErrorMsg(e.message)
    }
  }

  if (status === STATUSES.done) {
    return (
      <main className="contact-page">
        <div className="contact-container">
          <div className="contact-done">
            <div className="done-icon">✅</div>
            <h1>送信完了</h1>
            <p>お問い合わせを受け付けました。<br />内容を確認の上、返信いたします。</p>
            <button className="btn-back" onClick={() => navigate('/')}>トップに戻る</button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="contact-page">
      <div className="contact-container">
        <button className="contact-back" onClick={() => navigate(-1)}>← 戻る</button>
        <h1 className="contact-title">お問い合わせ</h1>
        <p className="contact-intro">
          バグの報告・ご意見・ご要望などお気軽にお送りください。
        </p>

        <form className="contact-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">お名前 <span className="required">*</span></label>
            <input
              className="form-input"
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="例: 千歳　太郎"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">メールアドレス <span className="required">*</span></label>
            <input
              className="form-input"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="例: example@mail.com"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">お問い合わせ内容 <span className="required">*</span></label>
            <textarea
              className="form-textarea"
              name="message"
              value={form.message}
              onChange={handleChange}
              rows={6}
              placeholder="お問い合わせ内容を入力してください"
              required
            />
          </div>

          {status === STATUSES.error && (
            <div className="form-error">⚠️ {errorMsg}</div>
          )}

          <button
            type="submit"
            className="btn-submit"
            disabled={status === STATUSES.sending}
          >
            {status === STATUSES.sending ? '送信中…' : '送信する'}
          </button>
        </form>
      </div>
    </main>
  )
}
