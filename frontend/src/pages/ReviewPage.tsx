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
type DifficultyLevel = 'default' | 'easy' | 'median' | 'hard' | 'Error'

const difficultyLabels: Record<DifficultyLevel, string> = {
  default: 'Default',
  easy: 'Easy',
  median: 'Medium',
  hard: 'Hard',
  Error: 'Error',
}

export default function ReviewPage() {
  const { sliceId, sessionId } = useParams<{ sliceId: string; sessionId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const [detail, setDetail] = useState<SliceDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<ReviewType>('preprocessing')
  const [activeGtIndex, setActiveGtIndex] = useState(0)
  const [selectedIntensityArtifact, setSelectedIntensityArtifact] = useState<ArtifactInfo | null>(null)
  const [selectedVideoArtifact, setSelectedVideoArtifact] = useState<ArtifactInfo | null>(null)
  const [selectedVisualArtifact, setSelectedVisualArtifact] = useState<ArtifactInfo | null>(null)
  const [selectedMapVisualArtifact, setSelectedMapVisualArtifact] = useState<ArtifactInfo | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [lastDragPos, setLastDragPos] = useState<{ x: number; y: number } | null>(null)
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
      const firstIntensity = prepArtifacts.find(
        (a) => a.category.includes('map/IMG_INTENSITY') || a.category.includes('map/INTENSITY')
      ) || prepArtifacts.find((a) => a.file_type === 'image')
      const firstVideo = prepArtifacts.find((a) => a.file_type === 'video')
      const firstVisual = prepArtifacts.find((a) => a.category.includes('map/visualize')) || null
      if (firstIntensity) setSelectedIntensityArtifact(firstIntensity)
      if (firstVideo) setSelectedVideoArtifact(firstVideo)
      if (firstVisual) setSelectedVisualArtifact(firstVisual)
      if (firstVisual) setSelectedMapVisualArtifact(firstVisual)
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
      if (e.code === 'Space') {
        setIsSpaceDown(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
        setIsDragging(false)
        setLastDragPos(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleZoomWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault()
    const delta = event.deltaY
    setZoom((prev) => {
      const next = prev + (delta > 0 ? -0.1 : 0.1)
      return Math.min(5, Math.max(0.2, Number(next.toFixed(2))))
    })
  }

  const handlePanStart = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isSpaceDown) return
    event.preventDefault()
    setIsDragging(true)
    setLastDragPos({ x: event.clientX, y: event.clientY })
  }

  const handlePanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !lastDragPos) return
    event.preventDefault()
    const dx = event.clientX - lastDragPos.x
    const dy = event.clientY - lastDragPos.y
    setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }))
    setLastDragPos({ x: event.clientX, y: event.clientY })
  }

  const handlePanEnd = () => {
    setIsDragging(false)
    setLastDragPos(null)
  }

  const handleResetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!detail || isUpdating) return

      // Arrow keys for navigation
      if (e.key === 'ArrowLeft' && detail.navigation.prev_id) {
        navigate(buildReviewPath(detail.navigation.prev_id))
      } else if (e.key === 'ArrowRight' && detail.navigation.next_id) {
        navigate(buildReviewPath(detail.navigation.next_id))
      }
      // Number keys for quick scoring
      else if (e.key === '0') {
        handleScore(0)
      } else if (e.key >= '1' && e.key <= '5') {
        handleScore(parseInt(e.key))
      } else if (e.key === 'n' || e.key === 'N') {
        handleUndecidable()
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

  useEffect(() => {
    if (!detail) return
    const artifacts = getCurrentArtifacts().filter(
      (a) => a.file_type === 'image' || a.file_type === 'video'
    )
    const intensityArtifacts = detail.preprocessing.artifacts.filter(
      (a) => a.file_type === 'image'
    )
    const firstIntensity = intensityArtifacts.find(
      (a) => a.category.includes('map/IMG_INTENSITY') || a.category.includes('map/INTENSITY')
    ) || intensityArtifacts[0] || null
    const mapVisualArtifacts = detail.preprocessing.artifacts.filter(
      (a) => a.category.includes('map/visualize')
    )
    const firstMapVisual = mapVisualArtifacts[0] || null
    const firstVideo = artifacts.find((a) => a.file_type === 'video') || null
    const firstVisual = activeTab === 'gt'
      ? artifacts.find((a) => a.file_name.endsWith('_rf_gt.jpg')) || null
      : artifacts.find((a) => a.category.includes('map/visualize')) || null

    if (
      !selectedIntensityArtifact ||
      !intensityArtifacts.some((a) => a.id === selectedIntensityArtifact.id)
    ) {
      setSelectedIntensityArtifact(firstIntensity)
    }
    if (
      !selectedVideoArtifact ||
      !artifacts.some((a) => a.id === selectedVideoArtifact.id)
    ) {
      setSelectedVideoArtifact(firstVideo)
    }
    if (
      !selectedVisualArtifact ||
      !artifacts.some((a) => a.id === selectedVisualArtifact.id)
    ) {
      setSelectedVisualArtifact(firstVisual)
    }
    if (
      !selectedMapVisualArtifact ||
      !mapVisualArtifacts.some((a) => a.id === selectedMapVisualArtifact.id)
    ) {
      setSelectedMapVisualArtifact(firstMapVisual)
    }
  }, [detail, activeTab, activeGtIndex])

  const handleScore = async (score: number) => {
    if (!detail || isUpdating) return

    setIsUpdating(true)
    try {
      if (activeTab === 'preprocessing') {
        await updateReview({
          slice_id: detail.slice.id,
          gt_version_id: null,
          result: 'unknown',
          score,
        })
      } else {
        const gtData = detail.gt_data[activeGtIndex]
        if (gtData) {
          await updateReview({
            slice_id: detail.slice.id,
            gt_version_id: gtData.gt_version.id,
            result: 'unknown',
            score,
          })
        }
      }
      await loadDetail()

      // Auto advance to next if scored
      if (score > 0 && detail.navigation.next_id) {
        navigate(buildReviewPath(detail.navigation.next_id))
      }
    } catch (err) {
      console.error('Failed to update review:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDifficulty = async (difficulty: DifficultyLevel) => {
    if (!detail || isUpdating) return
    setIsUpdating(true)
    try {
      if (activeTab === 'preprocessing') {
        await updateReview({
          slice_id: detail.slice.id,
          gt_version_id: null,
          result: 'unknown',
          difficulty,
        })
      } else {
        const gtData = detail.gt_data[activeGtIndex]
        if (gtData) {
          await updateReview({
            slice_id: detail.slice.id,
            gt_version_id: gtData.gt_version.id,
            result: 'unknown',
            difficulty,
          })
        }
      }
      await loadDetail()
    } catch (err) {
      console.error('Failed to update difficulty:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUndecidable = async () => {
    if (!detail || isUpdating) return
    setIsUpdating(true)
    try {
      if (activeTab === 'preprocessing') {
        await updateReview({
          slice_id: detail.slice.id,
          gt_version_id: null,
          result: 'undecidable',
          is_undecidable: true,
        })
      } else {
        const gtData = detail.gt_data[activeGtIndex]
        if (gtData) {
          await updateReview({
            slice_id: detail.slice.id,
            gt_version_id: gtData.gt_version.id,
            result: 'undecidable',
            is_undecidable: true,
          })
        }
      }
      await loadDetail()
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
        <div className="detail-layout review-layout">
          {/* Main content area */}
          <div className="image-container">
            <div
              className="image-wrapper"
              onWheel={handleZoomWheel}
              onMouseDown={handlePanStart}
              onMouseMove={handlePanMove}
              onMouseUp={handlePanEnd}
              onMouseLeave={handlePanEnd}
              onDoubleClick={handleResetView}
              style={{ cursor: isSpaceDown ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
            >
              <div className="image-split">
                <div className="image-panel">
                  {selectedVideoArtifact ? (
                    <video
                      src={getArtifactUrl(selectedVideoArtifact.id)}
                      controls
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                    />
                  ) : (
                    <div style={{ color: 'var(--muted)', padding: 48 }}>
                      No video available
                    </div>
                  )}
                </div>
                <div className="image-panel">
                  {selectedIntensityArtifact ? (
                    <img
                      src={getArtifactUrl(selectedIntensityArtifact.id)}
                      alt={selectedIntensityArtifact.file_name}
                      className="image-frame"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  ) : (
                    <div style={{ color: 'var(--muted)', padding: 48 }}>
                      No intensity image
                    </div>
                  )}
                </div>
                <div className="image-panel">
                  {activeTab === 'gt' && detail.gt_data[activeGtIndex]?.gt_version.gt_type === 'RF' ? (
                    selectedMapVisualArtifact ? (
                      <img
                        src={getArtifactUrl(selectedMapVisualArtifact.id)}
                        alt={selectedMapVisualArtifact.file_name}
                        className="image-frame"
                        style={{
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                          transformOrigin: 'center center',
                        }}
                      />
                    ) : (
                      <div style={{ color: 'var(--muted)', padding: 48 }}>
                        No visualize image
                      </div>
                    )
                  ) : (
                    <div style={{ color: 'var(--muted)', padding: 48 }}>
                      Pointcloud view (coming soon)
                    </div>
                  )}
                </div>
                <div className="image-panel">
                  {selectedVisualArtifact ? (
                    <img
                      src={getArtifactUrl(selectedVisualArtifact.id)}
                      alt={selectedVisualArtifact.file_name}
                      className="image-frame"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                      }}
                    />
                  ) : (
                    <div style={{ color: 'var(--muted)', padding: 48 }}>
                      No visualize image
                    </div>
                  )}
                </div>
              </div>
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
          <div className="score-sidebar review-sidebar">
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
                    const intensityArtifacts = detail.preprocessing.artifacts.filter(
                      (a) => a.file_type === 'image'
                    )
                    const firstIntensity = intensityArtifacts.find(
                      (a) => a.category.includes('map/IMG_INTENSITY') || a.category.includes('map/INTENSITY')
                    ) || intensityArtifacts[0] || null
                    const firstVideo = prepArtifacts.find((a) => a.file_type === 'video') || null
                    const firstVisual = prepArtifacts.find((a) => a.category.includes('map/visualize')) || null
                    setSelectedIntensityArtifact(firstIntensity)
                    setSelectedVideoArtifact(firstVideo)
                    setSelectedVisualArtifact(firstVisual)
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
                    const intensityArtifacts = detail.preprocessing.artifacts.filter(
                      (a) => a.file_type === 'image'
                    )
                    const firstIntensity = intensityArtifacts.find(
                      (a) => a.category.includes('map/IMG_INTENSITY') || a.category.includes('map/INTENSITY')
                    ) || intensityArtifacts[0] || null
                    const firstVideo = gtArtifacts.find((a) => a.file_type === 'video') || null
                    const firstVisual = gtArtifacts.find((a) => a.file_name.endsWith('_rf_gt.jpg')) || null
                    setSelectedIntensityArtifact(firstIntensity)
                    setSelectedVideoArtifact(firstVideo)
                    setSelectedVisualArtifact(firstVisual)
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
                      const intensityArtifacts = detail.preprocessing.artifacts.filter(
                        (a) => a.file_type === 'image'
                      )
                      const firstIntensity = intensityArtifacts.find(
                        (a) => a.category.includes('map/IMG_INTENSITY') || a.category.includes('map/INTENSITY')
                      ) || intensityArtifacts[0] || null
                      const firstVideo = gtArtifacts.find((a) => a.file_type === 'video') || null
                      const firstVisual = gtArtifacts.find((a) => a.file_name.endsWith('_rf_gt.jpg')) || null
                      setSelectedIntensityArtifact(firstIntensity)
                      setSelectedVideoArtifact(firstVideo)
                      setSelectedVisualArtifact(firstVisual)
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
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {currentReview?.is_undecidable ? (
                    <span className="score-tag">N</span>
                  ) : currentReview?.score !== null && currentReview?.score !== undefined ? (
                    <span className="score-tag" data-score={currentReview.score}>
                      {currentReview.score}
                    </span>
                  ) : (
                    <span className="score-tag">Not Reviewed</span>
                  )}
                  <span
                    className="difficulty-tag"
                    data-difficulty={currentReview?.difficulty || 'default'}
                  >
                    {currentReview?.difficulty || 'default'}
                  </span>
                </div>
              </div>

              {/* Review buttons */}
              <div className="card-title">Score</div>
              <div className="score-grid">
                {[0, 1, 2, 3, 4, 5].map((score) => (
                  <button
                    key={score}
                    className={`score-btn ${
                      currentReview?.score === score && !currentReview?.is_undecidable ? 'active' : ''
                    }`}
                    data-score={score === 0 ? undefined : score}
                    onClick={() => handleScore(score)}
                    disabled={isUpdating}
                  >
                    <div className="score-number">{score}</div>
                    <div className="score-label">{score === 0 ? 'Default (0)' : `Score (${score})`}</div>
                  </button>
                ))}
                <button
                  className={`score-btn score-undecidable ${currentReview?.is_undecidable ? 'active' : ''}`}
                  onClick={handleUndecidable}
                  disabled={isUpdating}
                >
                  <div className="score-number">N</div>
                  <div className="score-label">Undecidable (N)</div>
                </button>
              </div>
            </div>

            <div className="card difficulty-card">
              <div className="card-title">Difficulty</div>
              <div className="difficulty-grid">
                {(Object.keys(difficultyLabels) as DifficultyLevel[]).map((level) => (
                  <button
                    key={level}
                    className={`difficulty-btn ${currentReview?.difficulty === level ? 'active' : ''}`}
                    data-difficulty={level}
                    onClick={() => handleDifficulty(level)}
                    disabled={isUpdating}
                  >
                    {difficultyLabels[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
      <div className="shortcut-bar">
        <div className="shortcut-row">
          <span className="kbd">1-5</span>Score
        </div>
        <div className="shortcut-row">
          <span className="kbd">0</span>Default
        </div>
        <div className="shortcut-row">
          <span className="kbd">N</span>Undecidable
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
  )
}
