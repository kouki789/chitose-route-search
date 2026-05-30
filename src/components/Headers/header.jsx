import { Link, NavLink } from 'react-router-dom'
import './header.css'
export default function Headers() {
  return (
    <header className="header">
    <div className="logo">
      <Link to="/">千歳科学技術大学-ルート検索サイト</Link>
    </div>
      <nav>
        <ul className="nav-links">
          <li>
            <NavLink to="/">
              ホーム
            </NavLink>
          </li>
          <li>
            <NavLink to="/donation">
              寄付
            </NavLink>
          </li>
        </ul>
      </nav>
    </header>
  )
}