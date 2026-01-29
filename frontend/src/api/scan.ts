import api from './client'

export interface ScanResult {
  status?: string
  error?: string
  session_id?: number
  slices_found?: number
  artifacts_found?: number
  slices_removed?: number
  artifacts_removed?: number
  gt_versions_removed?: number
  reviews_removed?: number
}

export interface ScanStatus {
  is_running: boolean
  progress: number
  total: number
  current_file: string
  sessions_found: number
  slices_found: number
  artifacts_found: number
}

export async function scanSession(
  sessionPath: string,
  options: { sync_delete?: boolean } = {}
): Promise<ScanResult> {
  const response = await api.post<ScanResult>('/scan/session', {
    session_path: sessionPath,
    sync_delete: options.sync_delete ?? false,
  })
  return response.data
}

export async function getScanStatus(): Promise<ScanStatus> {
  const response = await api.get<ScanStatus>('/scan/status')
  return response.data
}

export async function createReviews(processingVersionId: number): Promise<{ status: string }> {
  const response = await api.post<{ status: string }>('/scan/create-reviews', {
    processing_version_id: processingVersionId,
  })
  return response.data
}
