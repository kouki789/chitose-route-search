import { useState, useEffect, useRef } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import './header.css'

const NAV_LINKS = [
  { to: '/guide',   label: '使い方' },
  { to: '/contact', label: 'お問い合わせ' },
  { to: '/terms',   label: '利用規約' },
]

export default function Headers() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const location = useLocation()

  // ページ遷移時にメニューを閉じる
  useEffect(() => { setOpen(false) }, [location])

  // メニュー外クリックで閉じる
  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          公立千歳科学技術大学-<span>ルート検索サイト</span>
        </Link>

        {/* PC: 通常ナビ */}
        <nav className="nav nav--desktop">
          {NAV_LINKS.map(({ to, label }) => (
            <NavLink key={to} to={to} className="nav-link">{label}</NavLink>
          ))}
        </nav>

        {/* スマホ: 三点リーダー */}
        <div className="nav nav--mobile" ref={menuRef}>
          <button
            className="menu-btn"
            onClick={() => setOpen(o => !o)}
            aria-label="メニューを開く"
          >
            ···
          </button>
          {open && (
            <div className="dropdown">
              {NAV_LINKS.map(({ to, label }) => (
                <NavLink key={to} to={to} className="dropdown-link">
                  {label}
                </NavLink>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
