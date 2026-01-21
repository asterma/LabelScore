import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getSessions, getStats, addSessionPath, getScanStatus } from '../api/sessions'
import type { Session, SessionStats, SessionFilter } from '../types'
import { Loading } from '../components/common/Loading'

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<SessionFilter>({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<{
    progress: number
    total: number
  } | null>(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [sessionPath, setSessionPath] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const pageSize = 20

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        getSessions({ ...filter, page, page_size: pageSize }),
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
  }, [page, filter])

  const handleAddSession = async () => {
    const trimmed = sessionPath.trim()
    if (!trimmed) {
      setAddError('请输入 session 路径')
      return
    }

    setAddError(null)
    setIsScanning(true)
    try {
      setIsAddOpen(false)
      const result = await addSessionPath(trimmed)
      if (result.error) {
        throw new Error(result.error)
      }

      // Poll for status
      const pollInterval = setInterval(async () => {
        const status = await getScanStatus()
        setScanProgress({ progress: status.progress, total: status.total })

        if (!status.is_running) {
          clearInterval(pollInterval)
          setIsScanning(false)
          setScanProgress(null)
          loadData()
        }
      }, 1000)
    } catch (err) {
      console.error('Scan failed:', err)
      setAddError(err instanceof Error ? err.message : '添加失败')
      setIsAddOpen(true)
      setIsScanning(false)
    }
  }

  const handleFilterChange = (key: keyof SessionFilter, value: string) => {
    setFilter((prev) => ({ ...prev, [key]: value || undefined }))
    setPage(1)
  }

  const getSessionStatus = (session: Session) => {
    if (session.annotated_images === 0) return '待开始'
    if (session.annotated_images === session.total_images) return '已完成'
    return '进行中'
  }

  const getStatusColor = (session: Session) => {
    if (session.annotated_images === 0) return '#faad14'
    if (session.annotated_images === session.total_images) return '#52c41a'
    return '#1890ff'
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Session 列表</h1>
        <button
          className={`btn btn-success ${isScanning ? 'btn-disabled' : ''}`}
          onClick={() => {
            setSessionPath('')
            setAddError(null)
            setIsAddOpen(true)
          }}
          disabled={isScanning}
        >
          {isScanning ? '处理中...' : '添加 Session'}
        </button>
      </div>

      {isAddOpen && (
        <div className="modal-overlay" onClick={() => setIsAddOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">添加 Session</div>
            <div className="modal-hint">
              输入 session 的目录路径（必须在后端 images_root_dir 之下）
            </div>
            {addError && <div className="modal-error">{addError}</div>}
            <input
              type="text"
              className="input"
              placeholder="例如：A123/2024/09/01/SESSION_001/v1/map/visualize"
              value={sessionPath}
              onChange={(e) => setSessionPath(e.target.value)}
            />
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setIsAddOpen(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleAddSession}>
                添加
              </button>
            </div>
          </div>
        </div>
      )}

      {isScanning && scanProgress && (
        <div className="scan-progress">
          扫描进度: {scanProgress.progress} / {scanProgress.total}
        </div>
      )}

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.total_sessions}</div>
            <div className="stat-label">总 Session 数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.total_images}</div>
            <div className="stat-label">总图片数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.annotated_images}</div>
            <div className="stat-label">已标注数</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.completion_rate.toFixed(1)}%</div>
            <div className="stat-label">完成率</div>
          </div>
        </div>
      )}

      <div className="filters">
        <div className="filter-group">
          <span className="filter-label">车牌号</span>
          <input
            type="text"
            className="input"
            placeholder="搜索车牌号"
            value={filter.license_plate || ''}
            onChange={(e) => handleFilterChange('license_plate', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">开始日期</span>
          <input
            type="date"
            className="input"
            value={filter.date_from || ''}
            onChange={(e) => handleFilterChange('date_from', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">结束日期</span>
          <input
            type="date"
            className="input"
            value={filter.date_to || ''}
            onChange={(e) => handleFilterChange('date_to', e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">状态</span>
          <select
            className="select"
            value={filter.status || ''}
            onChange={(e) =>
              handleFilterChange('status', e.target.value as SessionFilter['status'] || '')
            }
          >
            <option value="">全部</option>
            <option value="pending">待开始</option>
            <option value="in_progress">进行中</option>
            <option value="completed">已完成</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>车牌号</th>
                <th>日期</th>
                <th>Session ID</th>
                <th>版本</th>
                <th>进度</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const progress =
                  session.total_images > 0
                    ? (session.annotated_images / session.total_images) * 100
                    : 0
                return (
                  <tr key={session.id}>
                    <td>{session.license_plate}</td>
                    <td>
                      {session.year}-{String(session.month).padStart(2, '0')}-
                      {String(session.day).padStart(2, '0')}
                    </td>
                    <td>{session.session_id}</td>
                    <td>{session.software_version}</td>
                    <td>
                      <div className="progress">
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span>
                          {session.annotated_images}/{session.total_images}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span style={{ color: getStatusColor(session) }}>
                        {getSessionStatus(session)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/session/${session.id}`}>
                        开始标注
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
              上一页
            </button>
            <span>
              第 {page} 页，共 {Math.ceil(total / pageSize)} 页
            </span>
            <button
              className={`btn btn-outline ${
                page >= Math.ceil(total / pageSize) ? 'btn-disabled' : ''
              }`}
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / pageSize)}
            >
              下一页
            </button>
          </div>
        </>
      )}
    </div>
  )
}
