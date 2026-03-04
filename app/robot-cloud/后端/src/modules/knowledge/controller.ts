import type { Request, Response } from 'express';
import type { KnowledgeService } from './service';

export class KnowledgeController {
  constructor(private knowledgeService: KnowledgeService) {}

  private resolveParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  list = async (_req: Request, res: Response) => {
    try {
      res.json({ success: true, data: this.knowledgeService.list() });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  create = async (req: Request, res: Response) => {
    try {
      const userId = req.authContext?.user?.id || null;
      const data = this.knowledgeService.create(req.body || {}, userId);
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  update = async (req: Request, res: Response) => {
    try {
      const userId = req.authContext?.user?.id || null;
      const data = this.knowledgeService.update(this.resolveParam(req.params.id), req.body || {}, userId);
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  remove = async (req: Request, res: Response) => {
    try {
      this.knowledgeService.remove(this.resolveParam(req.params.id));
      res.json({ success: true });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  };
}
