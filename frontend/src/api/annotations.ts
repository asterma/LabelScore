import api from './client'
import type { Annotation, AnnotationWithNavigation, AnnotationUpdate } from '../types'

export async function getAnnotation(
  annotationId: number
): Promise<AnnotationWithNavigation> {
  const response = await api.get<AnnotationWithNavigation>(
    `/annotations/${annotationId}`
  )
  return response.data
}

export async function updateAnnotation(
  annotationId: number,
  data: AnnotationUpdate
): Promise<Annotation> {
  const response = await api.put<Annotation>(`/annotations/${annotationId}`, data)
  return response.data
}

export async function getNextUnannotated(
  sessionId: number
): Promise<Annotation | null> {
  const response = await api.get<Annotation | null>(
    `/annotations/next/${sessionId}`
  )
  return response.data
}

export function getImageUrl(annotationId: number): string {
  const token = localStorage.getItem('token')
  return `/api/images/${annotationId}?token=${token}`
}
