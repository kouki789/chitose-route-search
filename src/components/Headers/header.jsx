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
                <NavLink to="/donation" className="nav-link">
                    寄付
                </NavLink>
            </nav>

        </div>
    </header>
  )
}