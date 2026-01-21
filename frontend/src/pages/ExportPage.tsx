import { useState, useEffect } from 'react'
import { getSessions, getStats } from '../api/sessions'
import { Loading } from '../components/common/Loading'
import type { Session, SessionStats } from '../types'

export default function ExportPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [selectedSession, setSelectedSession] = useState<string>('')
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

  const handleExport = (format: 'csv' | 'json') => {
    const token = localStorage.getItem('token')
    let url = `/api/export/${format}`
    if (selectedSession) {
      url += `?session_id=${selectedSession}`
    }

    // Create a hidden link and click it
    const link = document.createElement('a')
    link.href = url
    link.download = `annotations.${format}`

    // Add auth header via fetch
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        link.href = blobUrl
        link.click()
        URL.revokeObjectURL(blobUrl)
      })
      .catch((err) => {
        console.error('Export failed:', err)
        alert('导出失败，请重试')
      })
  }

  if (isLoading) {
    return (
      <div className="page">
        <Loading />
      </div>
    )
  }

  return (
    <div className="page">
      <h1 className="page-title">数据导出</h1>

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

      <div className="card">
        <div className="card-title">导出设置</div>
        <p className="page-subtitle">
          选择要导出的数据范围和格式。导出文件包含所有标注结果及其元数据。
        </p>

        <div className="form-group">
          <label className="form-label">选择 Session</label>
          <select
            className="select"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            <option value="">全部 Session</option>
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.license_plate} - {session.year}-
                {String(session.month).padStart(2, '0')}-
                {String(session.day).padStart(2, '0')} - {session.session_id} (
                {session.annotated_images}/{session.total_images})
              </option>
            ))}
          </select>
        </div>

        <div className="button-row">
          <button
            className="btn btn-success"
            onClick={() => handleExport('csv')}
          >
            导出 CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={() => handleExport('json')}
          >
            导出 JSON
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">导出字段说明</div>
        <table className="table">
          <tbody>
            <tr>
              <td>id</td>
              <td className="text-muted">标注记录ID</td>
            </tr>
            <tr>
              <td>license_plate</td>
              <td className="text-muted">车牌号</td>
            </tr>
            <tr>
              <td>date</td>
              <td className="text-muted">日期 (YYYY-MM-DD)</td>
            </tr>
            <tr>
              <td>session_id</td>
              <td className="text-muted">Session 标识</td>
            </tr>
            <tr>
              <td>file_name</td>
              <td className="text-muted">文件名</td>
            </tr>
            <tr>
              <td>file_path</td>
              <td className="text-muted">相对文件路径</td>
            </tr>
            <tr>
              <td>score</td>
              <td className="text-muted">评分 (1-5，空表示未评分)</td>
            </tr>
            <tr>
              <td>is_undecidable</td>
              <td className="text-muted">是否标记为无法判断</td>
            </tr>
            <tr>
              <td>difficulty</td>
              <td className="text-muted">难易程度 (default/easy/median/hard/Error)</td>
            </tr>
            <tr>
              <td>annotated_by</td>
              <td className="text-muted">标注人员用户名</td>
            </tr>
            <tr>
              <td>annotated_at</td>
              <td className="text-muted">标注时间</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}
