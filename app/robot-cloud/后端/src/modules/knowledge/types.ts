export interface KnowledgeEntryRecord {
  id: string;
  title: string;
  content: string;
  tags: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeInput {
  title: string;
  content: string;
  tags?: string[];
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  tags?: string[];
}
