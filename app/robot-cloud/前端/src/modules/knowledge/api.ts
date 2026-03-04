import { http } from '@/api/request'

export type KnowledgeItem = {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export function listKnowledge() {
  return http.get<{ success: boolean; data: KnowledgeItem[] }>('/api/v1/knowledge')
}

export function createKnowledge(payload: { title: string; content: string; tags: string[] }) {
  return http.post<{ success: boolean; data: KnowledgeItem }>('/api/v1/knowledge', payload)
}

export function updateKnowledge(id: string, payload: { title?: string; content?: string; tags?: string[] }) {
  return http.put<{ success: boolean; data: KnowledgeItem }>(`/api/v1/knowledge/${id}`, payload)
}

export function deleteKnowledge(id: string) {
  return http.delete<{ success: boolean }>(`/api/v1/knowledge/${id}`)
}
