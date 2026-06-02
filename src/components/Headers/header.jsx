import { Link, NavLink } from 'react-router-dom'
import './header.css'
export default function Headers() {
  return (
    <header className="header">
        <div className= "container header-inner">
            <Link to="/" className="logo">
            公立千歳科学技術大学-<span>ルート検索サイト</span>
            </Link>
            <nav className="nav">
                <NavLink to="/contact" className="nav-link">
                    お問い合わせ
                </NavLink>
                <NavLink to="/terms" className="nav-link">
                    利用規約
                </NavLink>
            </nav>

        </div>
    </header>
  )
}