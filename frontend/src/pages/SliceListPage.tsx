import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getSlicesForReview, SlicesResponse, SliceReviewItem } from '../api/review'
import { Loading } from '../components/common/Loading'

export default function SliceListPage() {
  const { processingVersionId } = useParams<{ processingVersionId: string }>()
  const navigate = useNavigate()

  const [data, setData] = useState<SlicesResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [filterStatus, setFilterStatus] = useState<string>('')

  const pageSize = 50

  useEffect(() => {
    const loadData = async () => {
      if (!processingVersionId) return
      setIsLoading(true)
      try {
        const res = await getSlicesForReview(parseInt(processingVersionId), {
          page,
          page_size: pageSize,
          filter_status: filterStatus || undefined,
        })
        setData(res)
      } catch (err) {
        console.error('Failed to load slices:', err)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [processingVersionId, page, filterStatus])

  const getStatusBadge = (result: string) => {
    switch (result) {
      case 'pass':
        return { text: 'Pass', bg: 'rgba(34, 197, 94, 0.1)', color: '#15803d' }
      case 'fail':
        return { text: 'Fail', bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }
      default:
        return { text: 'Not Reviewed', bg: 'rgba(148, 163, 184, 0.2)', color: '#64748b' }
    }
  }

  const getStats = () => {
    if (!data) return { total: 0, pass: 0, fail: 0, unknown: 0 }
    const items = data.items
    return {
      total: items.length,
      pass: items.filter((i) => i.preprocessing_review.result === 'pass').length,
      fail: items.filter((i) => i.preprocessing_review.result === 'fail').length,
      unknown: items.filter((i) => i.preprocessing_review.result === 'unknown').length,
    }
  }

  const stats = getStats()

  if (isLoading && !data) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: 'var(--danger)', marginBottom: 16 }}>Processing version not found</div>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link to="/" className="app-link detail-back" style={{ marginBottom: 8, display: 'inline-block' }}>
            ← Back to Sessions
          </Link>
          <h1 className="page-title">{data.processing_version.software_version}</h1>
          <p className="page-subtitle">{data.processing_version.dir_name}</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            // Find first unreviewed slice
            const unreviewed = data.items.find((i) => i.preprocessing_review.result === 'unknown')
            if (unreviewed) {
              navigate(`/session/${data.session_id}/review/${unreviewed.id}`)
            } else if (data.items.length > 0) {
              navigate(`/session/${data.session_id}/review/${data.items[0].id}`)
            }
          }}
        >
          Start Review
        </button>
      </div>

      {/* Stats */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-value">{data.total}</div>
          <div className="stat-label">Total Slices</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#15803d' }}>{stats.pass}</div>
          <div className="stat-label">Pass</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#dc2626' }}>{stats.fail}</div>
          <div className="stat-label">Fail</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#64748b' }}>{stats.unknown}</div>
          <div className="stat-label">Not Reviewed</div>
        </div>
      </div>

      {/* GT versions info */}
      {data.gt_versions.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">GT Versions</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {data.gt_versions.map((gt) => (
              <span
                key={gt.id}
                className="status-badge"
                style={{
                  background: gt.gt_type === 'OD' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)',
                  color: gt.gt_type === 'OD' ? '#15803d' : '#7c3aed',
                }}
              >
                {gt.gt_type} {gt.version_tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">Review Status</span>
          <select
            className="select"
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All</option>
            <option value="unknown">Not Reviewed</option>
            <option value="pass">Pass</option>
            <option value="fail">Fail</option>
          </select>
        </div>
      </div>

      {/* Slices table */}
      {isLoading ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
          No data
        </div>
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Slice Name</th>
                <th>Preprocessing</th>
                {data.gt_versions.map((gt) => (
                  <th key={gt.id}>{gt.gt_type} {gt.version_tag}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const prepStatus = getStatusBadge(item.preprocessing_review.result)
                return (
                  <tr key={item.id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {item.slice_name.length > 60
                          ? '...' + item.slice_name.slice(-60)
                          : item.slice_name}
                      </span>
                    </td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ background: prepStatus.bg, color: prepStatus.color }}
                      >
                        {prepStatus.text}
                      </span>
                    </td>
                    {data.gt_versions.map((gt) => {
                      const gtReview = item.gt_reviews.find((r) => r.gt_version_id === gt.id)
                      const gtStatus = gtReview
                        ? getStatusBadge(gtReview.result)
                        : { text: '-', bg: 'transparent', color: 'var(--muted)' }
                      return (
                        <td key={gt.id}>
                          {gtReview ? (
                            <span
                              className="status-badge"
                              style={{ background: gtStatus.bg, color: gtStatus.color }}
                            >
                              {gtStatus.text}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--muted)' }}>-</span>
                          )}
                        </td>
                      )
                    })}
                    <td>
                      <Link
                        to={`/session/${data.session_id}/review/${item.id}`}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        Review
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
              Page {page} of {Math.ceil(data.total / pageSize)}
            </span>
            <button
              className={`btn btn-outline ${page >= Math.ceil(data.total / pageSize) ? 'btn-disabled' : ''}`}
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(data.total / pageSize)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
