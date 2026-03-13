export interface FeedbackEntryRecord {
  id: string
  content: string
  client_type: string
  device_name: string
  user_id: string | null
  status: FeedbackStatus
  handled_by: string | null
  handled_at: string | null
  created_at: string
  updated_at: string
}

export interface SubmitFeedbackInput {
  content?: string
}

export type FeedbackStatus = 'pending' | 'processing' | 'resolved'

export interface FeedbackListItem extends FeedbackEntryRecord {
  username: string | null
  handled_by_username: string | null
}

export interface FeedbackListQuery {
  limit?: number
  offset?: number
  status?: FeedbackStatus
}

export interface UpdateFeedbackStatusInput {
  status?: FeedbackStatus
}
