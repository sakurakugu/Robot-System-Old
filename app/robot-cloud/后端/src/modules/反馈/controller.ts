import type { Request, Response } from 'express';
import type { 反馈服务 } from './service';

export class 反馈控制器 {
  constructor(private feedbackService: 反馈服务) {}

  private resolveParam(value: string | string[] | undefined): string {
    return Array.isArray(value) ? String(value[0] || '') : String(value || '');
  }

  submit = async (req: Request, res: Response) => {
    try {
      const data = await this.feedbackService.submit(req.body || {}, {
        clientType: String(req.header('x-client-type') || 'unknown'),
        deviceName: String(req.header('x-device-name') || ''),
        userId: req.authContext?.user?.id || null,
      });
      res.status(201).json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  list = async (req: Request, res: Response) => {
    try {
      const data = await this.feedbackService.list({
        limit: Number(req.query.limit || 20),
        offset: Number(req.query.offset || 0),
        status: req.query.status as any,
      });
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  detail = async (req: Request, res: Response) => {
    try {
      const data = await this.feedbackService.detail(this.resolveParam(req.params.id));
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  };

  updateStatus = async (req: Request, res: Response) => {
    try {
      const data = await this.feedbackService.updateStatus(
        this.resolveParam(req.params.id),
        req.body || {},
        req.authContext?.user?.id || null
      );
      res.json({ success: true, data });
    } catch (error: any) {
      const status = error.message.includes('不存在') ? 404 : 400;
      res.status(status).json({ success: false, error: error.message });
    }
  };
}
