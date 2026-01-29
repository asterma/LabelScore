import { useState, useEffect } from 'react'
import { getSessions, getStats, SessionItem, SessionStats } from '../api/sessions'
import { Loading } from '../components/common/Loading'

export default function ExportPage() {
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sessionsRes, statsRes] = await Promise.all([
          getSessions({ page_size: 1000 }),
          getStats(),
        ])
        setSessions(sessionsRes.items)
        setStats(statsRes)
      } catch (err) {
        console.error('Failed to load data:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [])

  if (isLoading) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Export</h1>
          <p className="page-subtitle">Export review results and stats</p>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_sessions}</div>
            <div className="stat-label">Sessions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_slices}</div>
            <div className="stat-label">Slices</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.reviewed_count}</div>
            <div className="stat-label">Reviewed</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completion_rate.toFixed(1)}%</div>
            <div className="stat-label">Completion Rate</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Statistics</div>
        {stats && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="info-row">
              <span className="info-label">Sessions</span>
              <span className="info-value">{stats.total_sessions}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Processing Versions</span>
              <span className="info-value">{stats.total_processing_versions}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Slices</span>
              <span className="info-value">{stats.total_slices}</span>
            </div>
            <div className="info-row">
              <span className="info-label">GT Versions</span>
              <span className="info-value">{stats.total_gt_versions}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Artifacts</span>
              <span className="info-value">{stats.total_artifacts}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Reviews</span>
              <span className="info-value">{stats.total_reviews}</span>
            </div>
            <div className="info-row" style={{ border: 'none' }}>
              <span className="info-label">Reviewed</span>
              <span className="info-value">{stats.reviewed_count}</span>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Sessions</div>
        {sessions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
            No data
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>License Plate</th>
                <th>Date</th>
                <th>Processing Versions</th>
                <th>Slices</th>
                <th>Review Progress</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>{session.license_plate}</td>
                  <td>{session.date}</td>
                  <td>{session.processing_versions}</td>
                  <td>{session.slice_count}</td>
                  <td>{session.reviewed_count}/{session.review_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
