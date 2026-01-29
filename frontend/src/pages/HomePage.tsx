import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSessions, getStats, SessionItem, SessionStats } from '../api/sessions'
import { Loading } from '../components/common/Loading'

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [licensePlate, setLicensePlate] = useState('')

  const pageSize = 20

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        getSessions({ page, page_size: pageSize, license_plate: licensePlate || undefined }),
        getStats(),
      ])
      setSessions(sessionsRes.items)
      setTotal(sessionsRes.total)
      setStats(statsRes)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, licensePlate])

  const getProgress = (reviewed: number, total: number) => {
    if (total === 0) return 0
    return (reviewed / total) * 100
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sessions</h1>
          <p className="page-subtitle">Manage and review data sessions</p>
        </div>
        <Link to="/scan" className="btn btn-success">
          Scan Data
        </Link>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_sessions}</div>
            <div className="stat-label">Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_processing_versions}</div>
            <div className="stat-label">Processing Versions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_slices}</div>
            <div className="stat-label">Slices</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completion_rate.toFixed(1)}%</div>
            <div className="stat-label">Review Completion</div>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">License Plate</span>
          <input
            type="text"
            className="input"
            placeholder="Search license plate"
            value={licensePlate}
            onChange={(e) => {
              setLicensePlate(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>No data yet</div>
          <div style={{ color: 'var(--muted)', marginBottom: 24 }}>
            Click \"Scan Data\" to add a session
          </div>
          <Link to="/scan" className="btn btn-primary">
            Start Scan
          </Link>
        </div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>License Plate</th>
                <th>Date</th>
                <th>Session UUID</th>
                <th>Processing Versions</th>
                <th>Slices</th>
                <th>Review Progress</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const progress = getProgress(session.reviewed_count, session.review_count)
                return (
                  <tr key={session.id}>
                    <td>
                      <span style={{ fontWeight: 600 }}>{session.license_plate}</span>
                    </td>
                    <td>{session.date}</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {session.session_uuid.slice(0, 8)}...
                      </span>
                    </td>
                    <td>
                      <span className="status-badge" style={{ background: 'rgba(10, 132, 255, 0.1)', color: 'var(--accent)' }}>
                        {session.processing_versions} versions
                      </span>
                    </td>
                    <td>{session.slice_count}</td>
                    <td>
                      <div className="progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                          {session.reviewed_count}/{session.review_count}
                        </span>
                      </div>
                    </td>
                    <td>
                      <Link to={`/session/${session.id}`} className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 13 }}>
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="pagination">
            <button
              className={`btn btn-outline ${page === 1 ? 'btn-disabled' : ''}`}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </button>
            <span>
              Page {page} of {Math.ceil(total / pageSize)}
            </span>
            <button
              className={`btn btn-outline ${page >= Math.ceil(total / pageSize) ? 'btn-disabled' : ''}`}
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
