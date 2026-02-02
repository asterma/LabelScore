import api from './client'

export interface SessionItem {
  id: number
  license_plate: string
  date: string
  session_uuid: string
  processing_versions: number
  slice_count: number
  review_count: number
  reviewed_count: number
}

export interface SessionsResponse {
  items: SessionItem[]
  total: number
  page: number
  page_size: number
}

export interface SessionStats {
  total_sessions: number
  total_processing_versions: number
  total_slices: number
  total_gt_versions: number
  total_artifacts: number
  total_reviews: number
  reviewed_count: number
  completion_rate: number
}

export interface GTVersionInfo {
  id: number
  gt_type: string
  version_tag: string
  dir_name: string
}

export interface ProcessingVersionInfo {
  id: number
  dir_name: string
  software_version: string
  run_tag?: string | null
  processing_date: string
  processing_time?: string | null
  slice_count: number
  gt_versions: GTVersionInfo[]
}

export interface SessionDetail {
  id: number
  license_plate: string
  date: string
  session_uuid: string
  raw_root_path: string
  processing_versions: ProcessingVersionInfo[]
}

export async function getSessions(params: {
  page?: number
  page_size?: number
  license_plate?: string
}): Promise<SessionsResponse> {
  const response = await api.get<SessionsResponse>('/sessions', { params })
  return response.data
}

export async function getStats(): Promise<SessionStats> {
  const response = await api.get<SessionStats>('/sessions/stats')
  return response.data
}

export async function getSession(sessionId: number): Promise<SessionDetail> {
  const response = await api.get<SessionDetail>(`/sessions/${sessionId}`)
  return response.data
}
