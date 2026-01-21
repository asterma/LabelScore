import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { getSession, getSessionImages } from '../api/sessions'
import { getAnnotation, updateAnnotation, getNextUnannotated } from '../api/annotations'
import { useKeyboard } from '../hooks/useKeyboard'
import { Loading } from '../components/common/Loading'
import type { Session, Annotation, AnnotationWithNavigation } from '../types'



const SCORE_LABELS: Record<number, string> = {
  1: '很差',
  2: '较差',
  3: '一般',
  4: '较好',
  5: '优秀',
}

export default function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const navigate = useNavigate()

  const [session, setSession] = useState<Session | null>(null)
  const [images, setImages] = useState<Annotation[]>([])
  const [currentAnnotation, setCurrentAnnotation] =
    useState<AnnotationWithNavigation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [isImageLoading, setIsImageLoading] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)
  const [intensityUrl, setIntensityUrl] = useState<string | null>(null)
  const [isIntensityLoading, setIsIntensityLoading] = useState(false)
  const [intensityError, setIntensityError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 })
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isSpaceDown, setIsSpaceDown] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null)

  const loadSession = useCallback(async () => {
    if (!sessionId) return
    try {
      const [sessionData, imagesData] = await Promise.all([
        getSession(parseInt(sessionId)),
        getSessionImages(parseInt(sessionId)),
      ])
      setSession(sessionData)
      setImages(imagesData.items)
      return imagesData.items
    } catch (err) {
      console.error('Failed to load session:', err)
      navigate('/')
    }
  }, [sessionId, navigate])

  const loadAnnotation = useCallback(async (annotationId: number) => {
    try {
      const data = await getAnnotation(annotationId)
      setCurrentAnnotation(data)
    } catch (err) {
      console.error('Failed to load annotation:', err)
    }
  }, [])

  // Initial load
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      const loadedImages = await loadSession()
      if (loadedImages && loadedImages.length > 0) {
        // Try to get next unannotated, otherwise load first image
        const nextUnannotated = await getNextUnannotated(parseInt(sessionId!))
        if (nextUnannotated) {
          await loadAnnotation(nextUnannotated.id)
        } else {
          await loadAnnotation(loadedImages[0].id)
        }
      }
      setIsLoading(false)
    }
    init()
  }, [sessionId, loadSession, loadAnnotation])

  useEffect(() => {
    if (!currentAnnotation) {
      setImageUrl(null)
      setImageError(null)
      setIntensityUrl(null)
      setIntensityError(null)
      setZoom(1)
      setZoomOrigin({ x: 50, y: 50 })
      setPan({ x: 0, y: 0 })
      return
    }

    const controller = new AbortController()
    let objectUrl: string | null = null
    let intensityObjectUrl: string | null = null
    const token = localStorage.getItem('token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    const fetchImage = async (url: string) => {
      const res = await fetch(url, { headers, signal: controller.signal })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      return res.blob()
    }

    setIsImageLoading(true)
    setImageError(null)
    setIsIntensityLoading(true)
    setIntensityError(null)

    Promise.allSettled([
      fetchImage(`/api/images/${currentAnnotation.id}`),
      fetchImage(`/api/images/${currentAnnotation.id}/intensity`),
    ])
      .then(([mainResult, intensityResult]) => {
        if (mainResult.status === 'fulfilled') {
          objectUrl = URL.createObjectURL(mainResult.value)
          setImageUrl(objectUrl)
        } else {
          console.error('Failed to load image:', mainResult.reason)
          setImageError('原图加载失败')
          setImageUrl(null)
        }

        if (intensityResult.status === 'fulfilled') {
          intensityObjectUrl = URL.createObjectURL(intensityResult.value)
          setIntensityUrl(intensityObjectUrl)
        } else {
          console.error('Failed to load intensity image:', intensityResult.reason)
          setIntensityError('强度图加载失败')
          setIntensityUrl(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsImageLoading(false)
          setIsIntensityLoading(false)
        }
      })

    return () => {
      controller.abort()
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
      }
      if (intensityObjectUrl) {
        URL.revokeObjectURL(intensityObjectUrl)
      }
    }
  }, [currentAnnotation?.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceDown(false)
        setIsPanning(false)
        panStart.current = null
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const handleZoomWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setZoomOrigin({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    })

    const delta = e.deltaY < 0 ? 1.1 : 0.9
    setZoom((prev) => {
      const next = prev * delta
      return Math.max(0.4, Math.min(4, next))
    })
  }

  const handlePanStart = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSpaceDown) return
    e.preventDefault()
    setIsPanning(true)
    panStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    }
  }

  const handlePanMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPanning || !panStart.current) return
    const dx = e.clientX - panStart.current.x
    const dy = e.clientY - panStart.current.y
    setPan({
      x: panStart.current.panX + dx,
      y: panStart.current.panY + dy,
    })
  }

  const handlePanEnd = () => {
    setIsPanning(false)
    panStart.current = null
  }

  const handleResetView = () => {
    setZoom(1)
    setZoomOrigin({ x: 50, y: 50 })
    setPan({ x: 0, y: 0 })
  }

  const handleScore = async (score: number) => {
    if (!currentAnnotation || isUpdating) return
    setIsUpdating(true)
    try {
      await updateAnnotation(currentAnnotation.id, {
        score,
        is_undecidable: false,
      })

      // Refresh session data
      await loadSession()

      // Move to next unannotated or next image
      if (currentAnnotation.next_unannotated_id) {
        await loadAnnotation(currentAnnotation.next_unannotated_id)
      } else if (currentAnnotation.next_id) {
        await loadAnnotation(currentAnnotation.next_id)
      } else {
        // Refresh current annotation
        await loadAnnotation(currentAnnotation.id)
      }
    } catch (err) {
      console.error('Failed to update score:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUndecidable = async () => {
    if (!currentAnnotation || isUpdating) return
    setIsUpdating(true)
    try {
      await updateAnnotation(currentAnnotation.id, {
        score: null,
        is_undecidable: true,
      })

      await loadSession()

      if (currentAnnotation.next_unannotated_id) {
        await loadAnnotation(currentAnnotation.next_unannotated_id)
      } else if (currentAnnotation.next_id) {
        await loadAnnotation(currentAnnotation.next_id)
      } else {
        await loadAnnotation(currentAnnotation.id)
      }
    } catch (err) {
      console.error('Failed to mark undecidable:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDifficulty = async (level: Annotation['difficulty']) => {
    if (!currentAnnotation || isUpdating) return
    setIsUpdating(true)
    try {
      await updateAnnotation(currentAnnotation.id, { difficulty: level })
      await loadAnnotation(currentAnnotation.id)
    } catch (err) {
      console.error('Failed to update difficulty:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePrev = async () => {
    if (!currentAnnotation?.prev_id || isUpdating) return
    await loadAnnotation(currentAnnotation.prev_id)
  }

  const handleNext = async () => {
    if (!currentAnnotation?.next_id || isUpdating) return
    await loadAnnotation(currentAnnotation.next_id)
  }

  useKeyboard({
    onScore: handleScore,
    onUndecidable: handleUndecidable,
    onDifficulty: handleDifficulty,
    onPrev: handlePrev,
    onNext: handleNext,
  })

  if (isLoading) {
    return (
      <div className="page page-wide">
        <Loading />
      </div>
    )
  }

  if (!session || images.length === 0) {
    return (
      <div className="page page-wide">
        <p>没有找到图片数据</p>
        <Link to="/" className="app-link">
          返回列表
        </Link>
      </div>
    )
  }

  const progress = session.total_images > 0
    ? (session.annotated_images / session.total_images) * 100
    : 0

  const getStatusBadge = () => {
    if (currentAnnotation?.is_undecidable) {
      return { text: '无法判断', bg: '#fffbe6', color: '#faad14' }
    }
    if (currentAnnotation?.score) {
      return { text: '已标注', bg: 'rgba(34, 197, 94, 0.2)', color: '#15803d' }
    }
    return { text: '未标注', bg: '#f5f5f5', color: '#999' }
  }

  const status = getStatusBadge()

  return (
    <div className="page page-wide">
      <div className="detail-header">
        <Link to="/" className="app-link detail-back">
          ← 返回列表
        </Link>
        <h1 className="page-title">
          {session.license_plate} - {session.session_id}
        </h1>
        <p className="page-subtitle">
          {session.year}-{String(session.month).padStart(2, '0')}-
          {String(session.day).padStart(2, '0')} | {session.software_version}
        </p>
      </div>

      <div className="detail-stage">
        <div className="detail-layout">
        <div className="image-container">
          <div className="image-wrapper">
            <div className="image-split">
              <div
                className="image-panel"
                onWheel={handleZoomWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
                onDoubleClick={handleResetView}
              >
                {currentAnnotation && isIntensityLoading && (
                  <span className="page-subtitle">强度图加载中...</span>
                )}
                {currentAnnotation && intensityError && (
                  <span className="form-error">{intensityError}</span>
                )}
                {currentAnnotation && intensityUrl && !isIntensityLoading && !intensityError && (
                  <img
                    src={intensityUrl}
                    alt={`${currentAnnotation.file_name} intensity`}
                    className="image-frame"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    }}
                  />
                )}
              </div>
              <div
                className="image-panel"
                onWheel={handleZoomWheel}
                onMouseDown={handlePanStart}
                onMouseMove={handlePanMove}
                onMouseUp={handlePanEnd}
                onMouseLeave={handlePanEnd}
                onDoubleClick={handleResetView}
              >
                {currentAnnotation && isImageLoading && (
                  <span className="page-subtitle">原图加载中...</span>
                )}
                {currentAnnotation && imageError && (
                  <span className="form-error">{imageError}</span>
                )}
                {currentAnnotation && imageUrl && !isImageLoading && !imageError && (
                  <img
                    src={imageUrl}
                    alt={currentAnnotation.file_name}
                    className="image-frame"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                      transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="image-nav">
            <button
              className={`btn btn-outline ${
                currentAnnotation?.prev_id ? '' : 'btn-disabled'
              }`}
              onClick={handlePrev}
              disabled={!currentAnnotation?.prev_id || isUpdating}
            >
              ← 上一张
            </button>
            <span>
              {currentAnnotation?.position} / {currentAnnotation?.total}
            </span>
            <button
              className={`btn btn-outline ${
                currentAnnotation?.next_id ? '' : 'btn-disabled'
              }`}
              onClick={handleNext}
              disabled={!currentAnnotation?.next_id || isUpdating}
            >
              下一张 →
            </button>
          </div>
        </div>

        <div className="score-sidebar">
          <div className="card score-card">
            <div className="card-title">评分</div>
            <div className="score-grid">
              {[1, 2, 3, 4, 5].map((score) => (
                <button
                  key={score}
                  className={`score-btn ${
                    currentAnnotation?.score === score ? 'active' : ''
                  }`}
                  data-score={score}
                  onClick={() => handleScore(score)}
                  disabled={isUpdating}
                >
                  <div className="score-number">{score}</div>
                  <div className="score-label">{SCORE_LABELS[score]}</div>
                </button>
              ))}
              <button
                className={`score-btn score-undecidable ${
                  currentAnnotation?.is_undecidable ? 'active' : ''
                }`}
                onClick={handleUndecidable}
                disabled={isUpdating}
              >
                <div className="score-number">N</div>
                <div className="score-label">无法判断</div>
              </button>
            </div>
          </div>
          <div className="card difficulty-card">
            <div className="card-title">难度</div>
            <div className="difficulty-grid">
              {([
                { key: 'default', label: '默认' },
                { key: 'easy', label: '简单' },
                { key: 'median', label: '中等' },
                { key: 'hard', label: '困难' },
                { key: 'Error', label: '错误' },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  className={`difficulty-btn ${
                    currentAnnotation?.difficulty === item.key ? 'active' : ''
                  }`}
                  data-difficulty={item.key}
                  onClick={() => handleDifficulty(item.key)}
                  disabled={isUpdating}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="detail-sidebar">
          <div className="info-progress">
            <div className="card">
              <div className="card-title">图片信息</div>
              <div className="info-row">
                <span className="info-label">车牌号</span>
                <span className="info-value">{session.license_plate}</span>
              </div>
              <div className="info-row">
                <span className="info-label">日期</span>
                <span className="info-value">
                  {session.year}-{String(session.month).padStart(2, '0')}-
                  {String(session.day).padStart(2, '0')}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Session ID</span>
                <span className="info-value">{session.session_id}</span>
              </div>
              <div className="info-row">
                <span className="info-label">状态</span>
                <span
                  style={{
                    background: status.bg,
                    color: status.color,
                  }}
                  className="status-badge"
                >
                  {status.text}
                </span>
              </div>
            <div className="info-row">
              <span className="info-label">难易程度</span>
              <span
                className="difficulty-tag"
                data-difficulty={currentAnnotation?.difficulty || 'default'}
              >
                {currentAnnotation?.difficulty || 'default'}
              </span>
            </div>
            {currentAnnotation?.score && (
              <div className="info-row">
                <span className="info-label">当前评分</span>
                <span
                  className="score-tag"
                  data-score={currentAnnotation.score}
                >
                  {currentAnnotation.score} 分 ({SCORE_LABELS[currentAnnotation.score]})
                </span>
              </div>
            )}
              <div className="info-row">
                <span className="info-label">文件名</span>
                <span className="info-value">
                  {currentAnnotation?.file_name}
                </span>
              </div>
            </div>

            <div className="card progress-card">
              <div className="card-title">Session 进度</div>
              <div style={{ fontSize: '14px' }}>
                {session.annotated_images} / {session.total_images} ({progress.toFixed(1)}%)
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">快捷键</div>
            <div className="shortcut-grid">
              <div className="shortcut-row">
                <span className="kbd">1-5</span>评分
              </div>
              <div className="shortcut-row">
                <span className="kbd">N</span>无法判断
              </div>
              <div className="shortcut-row">
                <span className="kbd">F1</span>简单
              </div>
              <div className="shortcut-row">
                <span className="kbd">F2</span>中等
              </div>
              <div className="shortcut-row">
                <span className="kbd">F3</span>困难
              </div>
              <div className="shortcut-row">
                <span className="kbd">F4</span>错误
              </div>
              <div className="shortcut-row">
                <span className="kbd">←</span>上一张
              </div>
              <div className="shortcut-row">
                <span className="kbd">→</span>下一张
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
