import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getSession, SessionDetail, ProcessingVersionInfo } from '../api/sessions'
import {
  getSlicesForReview,
  getSliceDetail,
  updateReview,
  SlicesResponse,
  SliceDetail,
  ArtifactInfo,
  getArtifactUrl,
} from '../api/review'
import { scanSession } from '../api/scan'
import { Loading } from '../components/common/Loading'
import { useKeyboard } from '../hooks/useKeyboard'

type ReviewTab = 'preprocessing' | 'gt'

type DifficultyLevel = 'default' | 'easy' | 'median' | 'hard' | 'Error'

const difficultyLabels: Record<DifficultyLevel, string> = {
  default: 'Default',
  easy: 'Easy',
  median: 'Medium',
  hard: 'Hard',
  Error: 'Error',
}

const isDisplayable = (artifact: ArtifactInfo) =>
  artifact.file_type === 'image' || artifact.file_type === 'video'

const pickPreferredPrepArtifact = (artifacts: ArtifactInfo[]) => {
  const lowerNames = artifacts.map((a) => ({ artifact: a, name: a.file_name.toLowerCase() }))
  const findMatch = (base: string) =>
    lowerNames.find((item) =>
      item.name.endsWith(`${base}.jpg`) ||
      item.name.endsWith(`${base}.jpeg`) ||
      item.name.endsWith(`${base}.png`)
    )?.artifact

  return (
    findMatch('driving_line') ||
    findMatch('labelling') ||
    artifacts[0] ||
    null
  )
}

const isUnreviewed = (review: {
  score: number | null
  is_undecidable: boolean
} | null) => !review || ((review.score === null || review.score === 0) && !review.is_undecidable)

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()
  const [session, setSession] = useState<SessionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scanStatus, setScanStatus] = useState<string | null>(null)
  const [isScanning, setIsScanning] = useState(false)

  const [selectedPvId, setSelectedPvId] = useState<number | null>(null)
  const [slicesData, setSlicesData] = useState<SlicesResponse | null>(null)
  const [slicesLoading, setSlicesLoading] = useState(false)
  const [slicePage, setSlicePage] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')

  const [selectedSliceId, setSelectedSliceId] = useState<number | null>(null)
  const [detail, setDetail] = useState<SliceDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [activeTab, setActiveTab] = useState<ReviewTab>('preprocessing')
  const [activeGtIndex, setActiveGtIndex] = useState(0)
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactInfo | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const pageSize = 50

  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return
      setIsLoading(true)
      try {
        const data = await getSession(parseInt(sessionId))
        setSession(data)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load')
      } finally {
        setIsLoading(false)
      }
    }
    loadSession()
  }, [sessionId])

  useEffect(() => {
    if (session && session.processing_versions.length > 0 && selectedPvId === null) {
      setSelectedPvId(session.processing_versions[0].id)
    }
  }, [session, selectedPvId])

  useEffect(() => {
    setSlicesData(null)
    setSlicePage(1)
    setSelectedSliceId(null)
    setDetail(null)
  }, [selectedPvId])

  useEffect(() => {
    const loadSlices = async () => {
      if (!selectedPvId) return
      setSlicesLoading(true)
      try {
        const res = await getSlicesForReview(selectedPvId, {
          page: slicePage,
          page_size: pageSize,
          filter_status: filterStatus || undefined,
        })
        setSlicesData(res)
      } catch (err) {
        console.error('Failed to load slices:', err)
      } finally {
        setSlicesLoading(false)
      }
    }
    loadSlices()
  }, [selectedPvId, slicePage, filterStatus])

  useEffect(() => {
    const loadDetail = async () => {
      if (!selectedSliceId) return
      setDetailLoading(true)
      try {
        const data = await getSliceDetail(selectedSliceId)
        setDetail(data)
        setActiveTab('preprocessing')
        setActiveGtIndex(0)
        const prepArtifacts = data.preprocessing.artifacts.filter(isDisplayable)
        setSelectedArtifact(pickPreferredPrepArtifact(prepArtifacts))
      } catch (err) {
        console.error('Failed to load slice detail:', err)
      } finally {
        setDetailLoading(false)
      }
    }
    loadDetail()
  }, [selectedSliceId])

  useEffect(() => {
    if (!detail) return

    const artifacts =
      activeTab === 'preprocessing'
        ? detail.preprocessing.artifacts.filter(isDisplayable)
        : detail.gt_data[activeGtIndex]?.artifacts.filter(isDisplayable) || []

    if (!selectedArtifact || !artifacts.some((a) => a.id === selectedArtifact.id)) {
      if (activeTab === 'preprocessing') {
        setSelectedArtifact(pickPreferredPrepArtifact(artifacts))
      } else {
        setSelectedArtifact(artifacts[0] || null)
      }
    }
  }, [detail, activeTab, activeGtIndex, selectedArtifact])

  const currentReview = useMemo(() => {
    if (!detail) return null
    if (activeTab === 'preprocessing') return detail.preprocessing.review
    return detail.gt_data[activeGtIndex]?.review || null
  }, [detail, activeTab, activeGtIndex])

  const currentArtifacts = useMemo(() => {
    if (!detail) return []
    if (activeTab === 'preprocessing') return detail.preprocessing.artifacts
    return detail.gt_data[activeGtIndex]?.artifacts || []
  }, [detail, activeTab, activeGtIndex])

  const displayableArtifacts = currentArtifacts.filter(isDisplayable)

  const handleReviewUpdate = async (payload: {
    score?: number
    is_undecidable?: boolean
    difficulty?: DifficultyLevel
  }) => {
    if (!detail || isUpdating) return
    const gtData = activeTab === 'gt' ? detail.gt_data[activeGtIndex] : null
    if (activeTab === 'gt' && !gtData) return

    setIsUpdating(true)
    try {
      await updateReview({
        slice_id: detail.slice.id,
        gt_version_id: gtData?.gt_version.id ?? null,
        result: 'unknown',
        ...payload,
      })
      const refreshed = await getSliceDetail(detail.slice.id)
      setDetail(refreshed)
      if (selectedPvId) {
        const res = await getSlicesForReview(selectedPvId, {
          page: slicePage,
          page_size: pageSize,
          filter_status: filterStatus || undefined,
        })
        setSlicesData(res)
      }
    } catch (err) {
      console.error('Failed to update review:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!detail) return
    const targetId = direction === 'prev' ? detail.navigation.prev_id : detail.navigation.next_id
    if (targetId) {
      setSelectedSliceId(targetId)
    }
  }

  const handleRescan = async () => {
    if (!session || isScanning) return
    setIsScanning(true)
    setScanStatus(null)
    try {
      const res = await scanSession(session.raw_root_path, { sync_delete: true })
      if (res.error) {
        setScanStatus(`Scan failed: ${res.error}`)
      } else {
        setScanStatus(
          `Scan complete: +Slices ${res.slices_found ?? 0}, +Artifacts ${res.artifacts_found ?? 0} | ` +
          `-Slices ${res.slices_removed ?? 0}, -Artifacts ${res.artifacts_removed ?? 0}`
        )
        const refreshed = await getSession(session.id)
        setSession(refreshed)
      }
    } catch (err: any) {
      setScanStatus(err.response?.data?.detail || 'Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  useKeyboard({
    onScore: (score) => handleReviewUpdate({ score }),
    onUndecidable: () => handleReviewUpdate({ is_undecidable: true }),
    onDifficulty: (level) => handleReviewUpdate({ difficulty: level }),
    onPrev: () => handleNavigate('prev'),
    onNext: () => handleNavigate('next'),
  })

  const stats = useMemo(() => {
    if (!slicesData) return { total: 0, reviewed: 0, undecidable: 0, unknown: 0 }
    const items = slicesData.items
    const reviewed = items.filter((i) => !isUnreviewed(i.preprocessing_review)).length
    const undecidable = items.filter((i) => i.preprocessing_review.is_undecidable).length
    return {
      total: items.length,
      reviewed,
      undecidable,
      unknown: items.length - reviewed,
    }
  }, [slicesData])

  if (isLoading) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ color: 'var(--danger)', marginBottom: 16 }}>{error || 'Session not found'}</div>
          <Link to="/" className="btn btn-primary">Back to Sessions</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="detail-header">
        <Link to="/" className="app-link detail-back">
          ← Back to Sessions
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="page-title">{session.license_plate}</h1>
            <p className="page-subtitle">
              {session.date} | {session.session_uuid}
            </p>
          </div>
          <button className="btn btn-outline" onClick={handleRescan} disabled={isScanning}>
            {isScanning ? 'Scanning...' : 'Rescan'}
          </button>
        </div>
        {scanStatus && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--muted)' }}>{scanStatus}</div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Session Info</div>
        <div className="info-row">
          <span className="info-label">License Plate</span>
          <span className="info-value">{session.license_plate}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Date</span>
          <span className="info-value">{session.date}</span>
        </div>
        <div className="info-row">
          <span className="info-label">Session UUID</span>
          <span className="info-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
            {session.session_uuid}
          </span>
        </div>
        <div className="info-row" style={{ border: 'none' }}>
          <span className="info-label">Raw Data Path</span>
          <span className="info-value" style={{ fontFamily: 'monospace', fontSize: 11 }}>
            {session.raw_root_path}
          </span>
        </div>
      </div>

      <div className="card-title" style={{ marginBottom: 16 }}>
        Processing Versions ({session.processing_versions.length})
      </div>

      {session.processing_versions.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
          No processing versions
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {session.processing_versions.map((pv) => (
            <ProcessingVersionCard
              key={pv.id}
              pv={pv}
              isActive={pv.id === selectedPvId}
              onSelect={() => setSelectedPvId(pv.id)}
            />
          ))}
        </div>
      )}

      {selectedPvId && (
        <div style={{ marginTop: 32 }}>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20 }}>Slices</h2>
              <p className="page-subtitle">
                {slicesData?.processing_version.dir_name || 'Loading...'}
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                const items = slicesData?.items || []
                const unreviewed = items.find((i) => isUnreviewed(i.preprocessing_review))
                if (unreviewed) {
                  navigate(`/session/${session.id}/review/${unreviewed.id}`)
                } else if (items.length > 0) {
                  navigate(`/session/${session.id}/review/${items[0].id}`)
                }
              }}
              disabled={!slicesData || slicesData.items.length === 0}
            >
              Start Review
            </button>
          </div>

          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Slices</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#15803d' }}>{stats.reviewed}</div>
              <div className="stat-label">Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#64748b' }}>{stats.unknown}</div>
              <div className="stat-label">Not Reviewed</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: '#475569' }}>{stats.undecidable}</div>
              <div className="stat-label">Undecidable</div>
            </div>
          </div>

          {slicesData?.gt_versions.length ? (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-title">GT Versions</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slicesData.gt_versions.map((gt) => (
                  <span
                    key={gt.id}
                    className="status-badge"
                    style={{
                      background: gt.gt_type === 'OD'
                        ? 'rgba(34, 197, 94, 0.1)'
                        : 'rgba(168, 85, 247, 0.1)',
                      color: gt.gt_type === 'OD' ? '#15803d' : '#7c3aed',
                    }}
                  >
                    {gt.gt_type} {gt.version_tag}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="filters" style={{ marginBottom: 16 }}>
            <div className="filter-group">
              <span className="filter-label">Review Status</span>
              <select
                className="select"
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value)
                  setSlicePage(1)
                }}
              >
                <option value="">All</option>
                <option value="unknown">Not Reviewed</option>
                <option value="scored">Scored</option>
                <option value="undecidable">Undecidable</option>
              </select>
            </div>
          </div>

          {slicesLoading && !slicesData ? (
            <Loading />
          ) : !slicesData || slicesData.items.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 48, color: 'var(--muted)' }}>
              No data
            </div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Slice Name</th>
                    <th>Preprocessing Score</th>
                    <th>Difficulty</th>
                    {slicesData.gt_versions.map((gt) => (
                      <th key={gt.id}>{gt.gt_type} {gt.version_tag}</th>
                    ))}
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slicesData.items.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        background: item.id === selectedSliceId ? 'rgba(10, 132, 255, 0.06)' : undefined,
                      }}
                    >
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
                          {item.slice_name.length > 60
                            ? '...' + item.slice_name.slice(-60)
                            : item.slice_name}
                        </span>
                      </td>
                      <td>
                        {item.preprocessing_review.is_undecidable ? (
                          <span className="score-tag">N</span>
                        ) : item.preprocessing_review.score !== null && item.preprocessing_review.score !== undefined ? (
                          <span className="score-tag" data-score={item.preprocessing_review.score}>
                            {item.preprocessing_review.score}
                          </span>
                        ) : (
                          <span className="score-tag">Not Reviewed</span>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const difficulty = item.preprocessing_review.difficulty || 'default'
                          return (
                            <span className="difficulty-tag" data-difficulty={difficulty}>
                              {difficultyLabels[difficulty] || 'Default'}
                            </span>
                          )
                        })()}
                      </td>
                      {slicesData.gt_versions.map((gt) => {
                        const gtReview = item.gt_reviews.find((r) => r.gt_version_id === gt.id)
                        if (!gtReview) {
                          return (
                            <td key={gt.id}>
                              <span style={{ color: 'var(--muted)' }}>-</span>
                            </td>
                          )
                        }
                        return (
                          <td key={gt.id}>
                            {gtReview.is_undecidable ? (
                              <span className="score-tag">N</span>
                            ) : gtReview.score !== null && gtReview.score !== undefined ? (
                              <span className="score-tag" data-score={gtReview.score}>
                                {gtReview.score}
                              </span>
                            ) : (
                              <span className="score-tag">Not Reviewed</span>
                            )}
                          </td>
                        )
                      })}
                      <td>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={() => navigate(`/session/${session.id}/review/${item.id}`)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pagination" style={{ marginBottom: 32 }}>
                <button
                  className={`btn btn-outline ${slicePage === 1 ? 'btn-disabled' : ''}`}
                  onClick={() => setSlicePage((p) => Math.max(1, p - 1))}
                  disabled={slicePage === 1}
                >
                  Previous
                </button>
                <span>
                  Page {slicePage} of {Math.ceil(slicesData.total / pageSize)}
                </span>
                <button
                  className={`btn btn-outline ${slicePage >= Math.ceil(slicesData.total / pageSize) ? 'btn-disabled' : ''}`}
                  onClick={() => setSlicePage((p) => p + 1)}
                  disabled={slicePage >= Math.ceil(slicesData.total / pageSize)}
                >
                  Next
                </button>
              </div>
            </>
          )}

          {detailLoading ? (
            <Loading />
          ) : detail ? (
            <div className="detail-stage" style={{ marginTop: 24 }}>
              <div className="detail-layout">
                <div className="image-container">
                  <div className="image-wrapper">
                    {selectedArtifact ? (
                      <div className="image-panel" style={{ width: '100%' }}>
                        {selectedArtifact.file_type === 'image' ? (
                          <img
                            src={getArtifactUrl(selectedArtifact.id)}
                            alt={selectedArtifact.file_name}
                            className="image-frame"
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
                        No previewable file
                      </div>
                    )}
                  </div>
                  <div className="image-nav">
                    <button
                      className={`btn btn-outline ${!detail.navigation.prev_id ? 'btn-disabled' : ''}`}
                      onClick={() => handleNavigate('prev')}
                      disabled={!detail.navigation.prev_id}
                    >
                      ← Previous
                    </button>
                    <span>
                      {detail.navigation.position} / {detail.navigation.total}
                    </span>
                    <button
                      className={`btn btn-outline ${!detail.navigation.next_id ? 'btn-disabled' : ''}`}
                      onClick={() => handleNavigate('next')}
                      disabled={!detail.navigation.next_id}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                <div className="score-sidebar">
                  <div className="card score-card">
                    <div className="card-title">Review Type</div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                      <button
                        className={`btn ${activeTab === 'preprocessing' ? 'btn-primary' : 'btn-outline'}`}
                        onClick={() => {
                          setActiveTab('preprocessing')
                          const prepArtifacts = detail.preprocessing.artifacts.filter(isDisplayable)
                          setSelectedArtifact(pickPreferredPrepArtifact(prepArtifacts))
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
                            const gtArtifacts = detail.gt_data[activeGtIndex]?.artifacts.filter(isDisplayable) || []
                            setSelectedArtifact(gtArtifacts[0] || null)
                          }}
                          style={{ flex: 1, padding: '8px 12px' }}
                        >
                          GT ({detail.gt_data.length})
                        </button>
                      )}
                    </div>

                    {activeTab === 'gt' && detail.gt_data.length > 1 && (
                      <div style={{ marginBottom: 16 }}>
                        <select
                          className="select"
                          value={activeGtIndex}
                          onChange={(e) => {
                            const idx = parseInt(e.target.value)
                            setActiveGtIndex(idx)
                            const gtArtifacts = detail.gt_data[idx]?.artifacts.filter(isDisplayable) || []
                            setSelectedArtifact(gtArtifacts[0] || null)
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

                    <div style={{ marginBottom: 16, padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 6 }}>Current Status</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {currentReview?.is_undecidable ? (
                          <span className="score-tag">N</span>
                        ) : currentReview?.score ? (
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
                          {difficultyLabels[currentReview?.difficulty || 'default']}
                        </span>
                      </div>
                    </div>

                    <div className="card-title">Score</div>
                    <div className="score-grid">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          className={`score-btn ${currentReview?.score === score && !currentReview?.is_undecidable ? 'active' : ''}`}
                          data-score={score}
                          onClick={() => handleReviewUpdate({ score })}
                          disabled={isUpdating}
                        >
                          <div className="score-number">{score}</div>
                          <div className="score-label">Score ({score})</div>
                        </button>
                      ))}
                      <button
                        className={`score-btn score-undecidable ${currentReview?.is_undecidable ? 'active' : ''}`}
                        onClick={() => handleReviewUpdate({ is_undecidable: true })}
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
                          onClick={() => handleReviewUpdate({ difficulty: level })}
                          disabled={isUpdating}
                        >
                          {difficultyLabels[level]} {level === 'default' ? '' : `(${{ easy: 'F1', median: 'F2', hard: 'F3', Error: 'F4' }[level]})`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

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
                    <div className="card-title">Files</div>
                    <div className="difficulty-grid" style={{ maxHeight: 200, overflow: 'auto' }}>
                      {displayableArtifacts.map((artifact) => (
                        <button
                          key={artifact.id}
                          className={`difficulty-btn ${selectedArtifact?.id === artifact.id ? 'active' : ''}`}
                          onClick={() => setSelectedArtifact(artifact)}
                          style={{ textAlign: 'left', padding: '8px 12px' }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 500 }}>{artifact.file_name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {artifact.category}
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

                  <div className="card">
                    <div className="card-title">Shortcuts</div>
                    <div className="shortcut-grid">
                      <div className="shortcut-row">
                        <span className="kbd">1-5</span>Score
                      </div>
                      <div className="shortcut-row">
                        <span className="kbd">N</span>Undecidable
                      </div>
                      <div className="shortcut-row">
                        <span className="kbd">F1</span>Easy
                      </div>
                      <div className="shortcut-row">
                        <span className="kbd">F2</span>Medium
                      </div>
                      <div className="shortcut-row">
                        <span className="kbd">F3</span>Hard
                      </div>
                      <div className="shortcut-row">
                        <span className="kbd">F4</span>Error
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
          ) : null}
        </div>
      )}
    </div>
  )
}

function ProcessingVersionCard({
  pv,
  isActive,
  onSelect,
}: {
  pv: ProcessingVersionInfo
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <div
      className="card"
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{
        border: isActive ? '1px solid rgba(10, 132, 255, 0.4)' : undefined,
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 600, fontSize: 16 }}>{pv.software_version}</div>
            {pv.run_tag && (
              <span
                className="status-badge"
                style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#1d4ed8' }}
              >
                {pv.run_tag}
              </span>
            )}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Processing Date: {pv.processing_date}
            {pv.processing_time ? ` ${pv.processing_time.split('T')[1]?.split('.')[0] || ''}` : ''}
          </div>
        </div>
        <span className="status-badge" style={{ background: 'rgba(10, 132, 255, 0.1)', color: 'var(--accent)' }}>
          {pv.slice_count} Slices
        </span>
      </div>

      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
        Directory: {pv.dir_name}
      </div>

      {pv.gt_versions.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>
            GT Versions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pv.gt_versions.map((gt) => (
              <span
                key={gt.id}
                className="status-badge"
                style={{
                  background: gt.gt_type === 'OD'
                    ? 'rgba(34, 197, 94, 0.1)'
                    : 'rgba(168, 85, 247, 0.1)',
                  color: gt.gt_type === 'OD' ? '#15803d' : '#7c3aed',
                }}
              >
                {gt.gt_type} {gt.version_tag}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
