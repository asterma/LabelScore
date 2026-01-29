import api from './client'

export interface SliceReviewItem {
  id: number
  slice_name: string
  preprocessing_review: {
    result: string
    review_id: number | null
    score: number | null
    is_undecidable: boolean
    difficulty: 'default' | 'easy' | 'median' | 'hard' | 'Error'
  }
  gt_reviews: {
    gt_version_id: number
    gt_type: string
    version_tag: string
    result: string
    review_id: number | null
    score: number | null
    is_undecidable: boolean
    difficulty: 'default' | 'easy' | 'median' | 'hard' | 'Error'
  }[]
}

export interface SlicesResponse {
  items: SliceReviewItem[]
  total: number
  page: number
  page_size: number
  session_id: number
  processing_version: {
    id: number
    dir_name: string
    software_version: string
  }
  gt_versions: {
    id: number
    gt_type: string
    version_tag: string
  }[]
}

export interface ArtifactInfo {
  id: number
  category: string
  file_name: string
  file_type: string
}

export interface ReviewInfo {
  id: number
  result: string
  comment: string | null
  score: number | null
  is_undecidable: boolean
  difficulty: 'default' | 'easy' | 'median' | 'hard' | 'Error'
}

export interface GTData {
  gt_version: {
    id: number
    gt_type: string
    version_tag: string
    dir_name: string
  }
  artifacts: ArtifactInfo[]
  review: ReviewInfo | null
}

export interface SliceDetail {
  slice: {
    id: number
    slice_name: string
  }
  session: {
    id: number
    license_plate: string
    date: string
  }
  processing_version: {
    id: number
    dir_name: string
    software_version: string
  }
  preprocessing: {
    artifacts: ArtifactInfo[]
    review: ReviewInfo | null
  }
  gt_data: GTData[]
  navigation: {
    prev_id: number | null
    next_id: number | null
    position: number
    total: number
  }
}

export async function getSlicesForReview(
  processingVersionId: number,
  params: { page?: number; page_size?: number; filter_status?: string } = {}
): Promise<SlicesResponse> {
  const response = await api.get<SlicesResponse>(`/review/slices/${processingVersionId}`, { params })
  return response.data
}

export async function getSliceDetail(sliceId: number): Promise<SliceDetail> {
  const response = await api.get<SliceDetail>(`/review/slice/${sliceId}`)
  return response.data
}

export async function updateReview(data: {
  slice_id: number
  gt_version_id?: number | null
  result: string
  score?: number | null
  is_undecidable?: boolean | null
  difficulty?: 'default' | 'easy' | 'median' | 'hard' | 'Error' | null
  comment?: string | null
}): Promise<ReviewInfo> {
  const response = await api.post<ReviewInfo>('/review/update', null, { params: data })
  return response.data
}

export function getArtifactUrl(artifactId: number): string {
  const token = localStorage.getItem('token')
  return token
    ? `/api/review/artifact/${artifactId}/file?token=${token}`
    : `/api/review/artifact/${artifactId}/file`
}
