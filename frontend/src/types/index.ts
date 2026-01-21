// User types
export interface User {
  id: number
  username: string
  display_name: string | null
  is_active: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

// Session types
export interface Session {
  id: number
  license_plate: string
  year: number
  month: number
  day: number
  session_id: string
  software_version: string
  total_images: number
  annotated_images: number
  created_at: string
  base_path?: string
  updated_at?: string
}

export interface SessionListResponse {
  items: Session[]
  total: number
  page: number
  page_size: number
}

export interface SessionFilter {
  license_plate?: string
  date_from?: string
  date_to?: string
  status?: 'pending' | 'in_progress' | 'completed'
}

export interface SessionStats {
  total_sessions: number
  total_images: number
  annotated_images: number
  completion_rate: number
}

// Annotation types
export interface Annotation {
  id: number
  session_id: number
  file_path: string
  file_name: string
  score: number | null
  is_undecidable: boolean
  difficulty: 'default' | 'easy' | 'median' | 'hard' | 'Error'
  annotated_by: number | null
  annotated_at: string | null
  license_plate?: string
  date?: string
  session_name?: string
}

export interface AnnotationWithNavigation extends Annotation {
  prev_id: number | null
  next_id: number | null
  next_unannotated_id: number | null
  position: number
  total: number
}

export interface AnnotationUpdate {
  score?: number | null
  is_undecidable?: boolean
  difficulty?: 'default' | 'easy' | 'median' | 'hard' | 'Error'
}

export interface ImageListResponse {
  items: Annotation[]
  total: number
  current_index?: number
}
