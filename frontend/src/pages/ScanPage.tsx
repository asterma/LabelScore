import { useState } from 'react'
import { scanSession, ScanResult } from '../api/scan'

export default function ScanPage() {
  const [sessionPath, setSessionPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    if (!sessionPath.trim()) {
      setError('Please enter a session path')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await scanSession(sessionPath.trim())
      if (res.error) {
        setError(res.error)
      } else {
        setResult(res)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'Scan failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Scan Data</h1>
          <p className="page-subtitle">Scan a session directory and register it in the database</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">Session Path</div>
        <div className="form-stack">
          <div className="form-field">
            <input
              type="text"
              className="input"
              value={sessionPath}
              onChange={(e) => setSessionPath(e.target.value)}
              placeholder="/path/to/BB10587/2026/01/20/ef86f625-97d1-4eb5-ac3d-5f052d8364e5"
              disabled={loading}
              style={{ width: '100%' }}
              onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            />
            <span className="text-muted" style={{ fontSize: 12 }}>
              Format: {'{license_plate}/{year}/{month}/{day}/{session_uuid}'}
            </span>
          </div>

          <button
            className={`btn btn-primary ${loading ? 'btn-disabled' : ''}`}
            onClick={handleScan}
            disabled={loading}
            style={{ alignSelf: 'flex-start' }}
          >
            {loading ? 'Scanning...' : 'Start Scan'}
          </button>
        </div>

        {error && (
          <div className="form-error" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {result && (
          <div className="scan-progress" style={{ marginTop: 16, background: 'rgba(20, 184, 106, 0.08)', borderColor: 'rgba(20, 184, 106, 0.18)' }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--success)' }}>Scan Complete</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.session_id}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Session ID</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.slices_found}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Slices</div>
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--accent)' }}>{result.artifacts_found}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>Artifacts</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-title">Scan Notes</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="info-row">
            <span className="info-label">Directory Structure</span>
            <span className="info-value" style={{ fontFamily: 'monospace', fontSize: 12 }}>
              {'{license_plate}/{year}/{month}/{day}/{session_uuid}'}
            </span>
          </div>
          <div className="info-row">
            <span className="info-label">Processing Versions</span>
            <span className="info-value">Auto-detect {'{date}_{software_version}'} directories</span>
          </div>
          <div className="info-row">
            <span className="info-label">GT Versions</span>
            <span className="info-value">Auto-scan GT_OD-* and GT_RF-* directories</span>
          </div>
          <div className="info-row">
            <span className="info-label">Slice Source</span>
            <span className="info-value">Derived from .bag files in sync/</span>
          </div>
          <div className="info-row" style={{ border: 'none' }}>
            <span className="info-label">Rescan</span>
            <span className="info-value">Skips records that already exist</span>
          </div>
        </div>
      </div>
    </div>
  )
}
