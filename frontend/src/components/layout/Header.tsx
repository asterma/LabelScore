import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="app-header">
      <Link to="/" className="app-logo">
        LabelScore
      </Link>

      <nav className="app-nav">
        <Link to="/" className="app-link">
          Session 列表
        </Link>
        <Link to="/export" className="app-link">
          数据导出
        </Link>
      </nav>

      <div className="app-user">
        <span>{user?.display_name || user?.username}</span>
        <button className="btn btn-ghost" onClick={logout}>
          退出
        </button>
      </div>
    </header>
  )
}
