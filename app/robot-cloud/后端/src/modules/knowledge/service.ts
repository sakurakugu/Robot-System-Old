import { v7 as uuidv7 } from 'uuid';
import type DatabaseService from '../../core/database';
import type { CreateKnowledgeInput, UpdateKnowledgeInput } from './types';

export class KnowledgeService {
  constructor(private database: DatabaseService) {}

  list() {
    return this.database.listKnowledgeEntries().map((entry) => ({
      id: entry.id,
      title: entry.title,
      content: entry.content,
      tags: entry.tags ? JSON.parse(entry.tags) as string[] : [],
      createdBy: entry.created_by,
      updatedBy: entry.updated_by,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }));
  }

  create(input: CreateKnowledgeInput, userId: string | null) {
    const title = String(input.title || '').trim();
    const content = String(input.content || '').trim();
    if (!title) {
      throw new Error('标题不能为空');
    }
    if (!content) {
      throw new Error('内容不能为空');
    }

    const id = uuidv7();
    this.database.createKnowledgeEntry({
      id,
      title,
      content,
      tags: JSON.stringify(input.tags || []),
      created_by: userId,
      updated_by: userId,
    });

    const created = this.database.getKnowledgeEntry(id);
    if (!created) {
      throw new Error('创建失败');
    }

    return {
      id: created.id,
      title: created.title,
      content: created.content,
      tags: created.tags ? JSON.parse(created.tags) as string[] : [],
      createdBy: created.created_by,
      updatedBy: created.updated_by,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  update(id: string, input: UpdateKnowledgeInput, userId: string | null) {
    const existing = this.database.getKnowledgeEntry(id);
    if (!existing) {
      throw new Error('知识条目不存在');
    }

    this.database.updateKnowledgeEntry(id, {
      title: input.title !== undefined ? String(input.title).trim() : undefined,
      content: input.content !== undefined ? String(input.content).trim() : undefined,
      tags: input.tags !== undefined ? JSON.stringify(input.tags) : undefined,
      updated_by: userId,
    });

    const updated = this.database.getKnowledgeEntry(id);
    if (!updated) {
      throw new Error('更新失败');
    }

    return {
      id: updated.id,
      title: updated.title,
      content: updated.content,
      tags: updated.tags ? JSON.parse(updated.tags) as string[] : [],
      createdBy: updated.created_by,
      updatedBy: updated.updated_by,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
    };
  }

  remove(id: string): void {
    const existing = this.database.getKnowledgeEntry(id);
    if (!existing) {
      throw new Error('知识条目不存在');
    }
    this.database.deleteKnowledgeEntry(id);
  }
}
