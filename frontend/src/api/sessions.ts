import api from './client'
import type {
  Session,
  SessionListResponse,
  SessionFilter,
  SessionStats,
  ImageListResponse,
} from '../types'

export async function getSessions(
  params: SessionFilter & { page?: number; page_size?: number } = {}
): Promise<SessionListResponse> {
  const response = await api.get<SessionListResponse>('/sessions', { params })
  return response.data
}

export async function getSession(sessionId: number): Promise<Session> {
  const response = await api.get<Session>(`/sessions/${sessionId}`)
  return response.data
}

export async function getSessionImages(
  sessionId: number,
  page: number = 1,
  pageSize: number = 100
): Promise<ImageListResponse> {
  const response = await api.get<ImageListResponse>(
    `/sessions/${sessionId}/images`,
    { params: { page, page_size: pageSize } }
  )
  return response.data
}

export async function getStats(): Promise<SessionStats> {
  const response = await api.get<SessionStats>('/sessions/stats')
  return response.data
}

export async function addSessionPath(session_path: string): Promise<{
  status?: string
  error?: string
  sessions_found?: number
  images_found?: number
}> {
  const response = await api.post('/scan/session', { session_path })
  return response.data
}

export async function getScanStatus(): Promise<{
  is_running: boolean
  progress: number
  total: number
  sessions_found: number
  images_found: number
}> {
  const response = await api.get('/scan/status')
  return response.data
}
