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
          Sessions
        </Link>
        <Link to="/scan" className="app-link">
          Scan Data
        </Link>
        <Link to="/export" className="app-link">
          Export
        </Link>
      </nav>

      <div className="app-user">
        <span>{user?.display_name || user?.username}</span>
        <button className="btn btn-ghost" onClick={logout}>
          Logout
        </button>
      </div>
    </header>
  )
}
