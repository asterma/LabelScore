import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import {
  getSliceDetail,
  updateReview,
  SliceDetail,
  ArtifactInfo,
  getArtifactUrl,
} from '../api/review'
import { Loading } from '../components/common/Loading'

type ReviewType = 'preprocessing' | 'gt'

export default function ReviewPage() {
  const { sliceId, sessionId } = useParams<{ sliceId: string; sessionId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<SliceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<ReviewType>('preprocessing')
  const [activeGtIndex, setActiveGtIndex] = useState(0)
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactInfo | null>(null)
  const buildReviewPath = (id: number) =>
    sessionId ? `/session/${sessionId}/review/${id}` : `/review/${id}`

  const loadDetail = useCallback(async () => {
    if (!sliceId) return
    setIsLoading(true)
    try {
      const data = await getSliceDetail(parseInt(sliceId))
      setDetail(data)

      // Select first displayable artifact
      const prepArtifacts = data.preprocessing.artifacts.filter(
        (a) => a.file_type === 'image' || a.file_type === 'video'
      )
      if (prepArtifacts.length > 0) {
        setSelectedArtifact(prepArtifacts[0])
      }
    } catch (err) {
      console.error('Failed to load slice detail:', err)
    } finally {
      setIsLoading(false)
    }
  }, [sliceId])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!detail || isUpdating) return

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && detail.navigation.prev_id) {
        navigate(buildReviewPath(detail.navigation.prev_id))
      } else if (e.key === 'ArrowRight' && detail.navigation.next_id) {
        navigate(buildReviewPath(detail.navigation.next_id))
      }
      // Number keys for quick review
      else if (e.key === '1') {
        handleReview('pass')
      } else if (e.key === '2') {
        handleReview('fail')
      } else if (e.key === '0') {
        handleReview('unknown')
      }
      // Tab to switch between preprocessing and GT
      else if (e.key === 'Tab' && detail.gt_data.length > 0) {
        e.preventDefault()
        setActiveTab((prev) => (prev === 'preprocessing' ? 'gt' : 'preprocessing'))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [detail, isUpdating, navigate])

  const handleReview = async (result: string) => {
    if (!detail || isUpdating) return

    setIsUpdating(true)
    try {
      if (activeTab === 'preprocessing') {
        await updateReview({
          slice_id: detail.slice.id,
          gt_version_id: null,
          result,
        })
      } else {
        const gtData = detail.gt_data[activeGtIndex]
        if (gtData) {
          await updateReview({
            slice_id: detail.slice.id,
            gt_version_id: gtData.gt_version.id,
            result,
          })
        }
      }
      await loadDetail()

      // Auto advance to next if pass
      if (result === 'pass' && detail.navigation.next_id) {
        navigate(buildReviewPath(detail.navigation.next_id))
      }
    } catch (err) {
      console.error('Failed to update review:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const getCurrentReview = () => {
    if (!detail) return null
    if (activeTab === 'preprocessing') {
      return detail.preprocessing.review
    } else {
      return detail.gt_data[activeGtIndex]?.review
    }
  }

  const getCurrentArtifacts = () => {
    if (!detail) return []
    if (activeTab === 'preprocessing') {
      return detail.preprocessing.artifacts
    } else {
      return detail.gt_data[activeGtIndex]?.artifacts || []
    }
  }

  if (isLoading) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: 'var(--danger)', marginBottom: 16 }}>Slice not found</div>
          <Link to="/" className="btn btn-primary">Back to Home</Link>
        </div>
      </div>
    )
  }

  const currentReview = getCurrentReview()
  const currentArtifacts = getCurrentArtifacts()
  const displayableArtifacts = currentArtifacts.filter(
    (a) => a.file_type === 'image' || a.file_type === 'video'
  )

  return (
    <div className="page page-wide">
      <div className="detail-header">
        <Link
          to={sessionId ? `/session/${sessionId}` : `/slices/${detail.processing_version.id}`}
          className="app-link detail-back"
        >
          ← Back to Slices
        </Link>
        <h1 className="page-title" style={{ fontSize: 20 }}>
          {detail.slice.slice_name}
        </h1>
        <p className="page-subtitle">
          {detail.session.license_plate} | {detail.session.date} | {detail.processing_version.software_version}
        </p>
      </div>

      <div className="detail-stage">
        <div className="detail-layout">
          {/* Main content area */}
          <div className="image-container">
            <div className="image-wrapper">
              {selectedArtifact ? (
                <div className="image-panel" style={{ width: '100%' }}>
                  {selectedArtifact.file_type === 'image' ? (
                    <img
                      src={getArtifactUrl(selectedArtifact.id)}
                      alt={selectedArtifact.file_name}
                      className="image-frame"
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <video
                      src={getArtifactUrl(selectedArtifact.id)}
                      controls
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', padding: 48 }}>
                  No previewable files
                </div>
              )}
            </div>
            <div className="image-nav">
                <button
                  className={`btn btn-outline ${!detail.navigation.prev_id ? 'btn-disabled' : ''}`}
                  onClick={() => detail.navigation.prev_id && navigate(buildReviewPath(detail.navigation.prev_id))}
                  disabled={!detail.navigation.prev_id}
                >
                  ← Previous
                </button>
              <span>
                {detail.navigation.position} / {detail.navigation.total}
              </span>
                <button
                  className={`btn btn-outline ${!detail.navigation.next_id ? 'btn-disabled' : ''}`}
                  onClick={() => detail.navigation.next_id && navigate(buildReviewPath(detail.navigation.next_id))}
                  disabled={!detail.navigation.next_id}
                >
                  Next →
                </button>
            </div>
          </div>

          {/* Review panel */}
          <div className="score-sidebar">
            <div className="card score-card">
              <div className="card-title">Review Type</div>

              {/* Tab buttons */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button
                  className={`btn ${activeTab === 'preprocessing' ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => {
                    setActiveTab('preprocessing')
                    const prepArtifacts = detail.preprocessing.artifacts.filter(
                      (a) => a.file_type === 'image' || a.file_type === 'video'
                    )
                    if (prepArtifacts.length > 0) setSelectedArtifact(prepArtifacts[0])
                  }}
                  style={{ flex: 1, padding: '8px 12px' }}
                >
                  Preprocessing
                </button>
                {detail.gt_data.length > 0 && (
                  <button
                    className={`btn ${activeTab === 'gt' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => {
                      setActiveTab('gt')
                      const gtArtifacts = detail.gt_data[activeGtIndex]?.artifacts.filter(
                        (a) => a.file_type === 'image' || a.file_type === 'video'
                      ) || []
                      if (gtArtifacts.length > 0) setSelectedArtifact(gtArtifacts[0])
                    }}
                    style={{ flex: 1, padding: '8px 12px' }}
                  >
                    GT ({detail.gt_data.length})
                  </button>
                )}
              </div>

              {/* GT version selector */}
              {activeTab === 'gt' && detail.gt_data.length > 1 && (
                <div style={{ marginBottom: 16 }}>
                  <select
                    className="select"
                    value={activeGtIndex}
                    onChange={(e) => {
                      const idx = parseInt(e.target.value)
                      setActiveGtIndex(idx)
                      const gtArtifacts = detail.gt_data[idx]?.artifacts.filter(
                        (a) => a.file_type === 'image' || a.file_type === 'video'
                      ) || []
                      if (gtArtifacts.length > 0) setSelectedArtifact(gtArtifacts[0])
                    }}
                    style={{ width: '100%' }}
                  >
                    {detail.gt_data.map((gt, idx) => (
                      <option key={gt.gt_version.id} value={idx}>
                        {gt.gt_version.gt_type} {gt.gt_version.version_tag}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Current status */}
              <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>Current Status</div>
                <span
                  className="status-badge"
                  style={{
                    background:
                      currentReview?.result === 'pass'
                        ? 'rgba(34, 197, 94, 0.1)'
                        : currentReview?.result === 'fail'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(148, 163, 184, 0.2)',
                    color:
                      currentReview?.result === 'pass'
                        ? '#15803d'
                        : currentReview?.result === 'fail'
                        ? '#dc2626'
                        : '#64748b',
                  }}
                >
                  {currentReview?.result === 'pass'
                    ? 'Pass'
                    : currentReview?.result === 'fail'
                    ? 'Fail'
                    : 'Not Reviewed'}
                </span>
              </div>

              {/* Review buttons */}
              <div className="card-title">Review Result</div>
              <div className="score-grid">
                <button
                  className={`score-btn ${currentReview?.result === 'pass' ? 'active' : ''}`}
                  data-score="4"
                  onClick={() => handleReview('pass')}
                  disabled={isUpdating}
                >
                  <div className="score-number">✓</div>
                  <div className="score-label">Pass (1)</div>
                </button>
                <button
                  className={`score-btn ${currentReview?.result === 'fail' ? 'active' : ''}`}
                  data-score="1"
                  onClick={() => handleReview('fail')}
                  disabled={isUpdating}
                >
                  <div className="score-number">✗</div>
                  <div className="score-label">Fail (2)</div>
                </button>
                <button
                  className="score-btn score-undecidable"
                  onClick={() => handleReview('unknown')}
                  disabled={isUpdating}
                >
                  <div className="score-number">?</div>
                  <div className="score-label">Reset (0)</div>
                </button>
              </div>
            </div>

            {/* Artifacts list */}
            <div className="card difficulty-card">
              <div className="card-title">Files</div>
              <div className="difficulty-grid" style={{ maxHeight: 200, overflow: 'auto' }}>
                {displayableArtifacts.map((artifact) => (
                  <button
                    key={artifact.id}
                    className={`difficulty-btn ${selectedArtifact?.id === artifact.id ? 'active' : ''}`}
                    onClick={() => setSelectedArtifact(artifact)}
                    style={{ textAlign: 'left', padding: '8px 12px' }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{artifact.category}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {artifact.file_type}
                    </div>
                  </button>
                ))}
                {displayableArtifacts.length === 0 && (
                  <div style={{ color: 'var(--muted)', fontSize: 13, padding: 8 }}>
                    No previewable files
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div className="detail-sidebar">
            <div className="card">
              <div className="card-title">Slice Info</div>
              <div className="info-row">
                <span className="info-label">License Plate</span>
                <span className="info-value">{detail.session.license_plate}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Date</span>
                <span className="info-value">{detail.session.date}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Software Version</span>
                <span className="info-value">{detail.processing_version.software_version}</span>
              </div>
              <div className="info-row" style={{ border: 'none' }}>
                <span className="info-label">Slice</span>
                <span className="info-value" style={{ fontSize: 11 }}>
                  {detail.slice.slice_name}
                </span>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Shortcuts</div>
              <div className="shortcut-grid">
                <div className="shortcut-row">
                  <span className="kbd">1</span>Pass
                </div>
                <div className="shortcut-row">
                  <span className="kbd">2</span>Fail
                </div>
                <div className="shortcut-row">
                  <span className="kbd">0</span>Reset
                </div>
                <div className="shortcut-row">
                  <span className="kbd">Tab</span>Switch Type
                </div>
                <div className="shortcut-row">
                  <span className="kbd">←</span>Previous
                </div>
                <div className="shortcut-row">
                  <span className="kbd">→</span>Next
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
