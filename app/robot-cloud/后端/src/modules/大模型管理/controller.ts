import type { Request, Response } from 'express';
import type { 大模型配置服务 } from './service';

export class 大模型管理控制器 {
  constructor(private llmConfigService: 大模型配置服务) { }

  getLLMConfig = async (_req: Request, res: Response) => {
    try {
      const data = this.llmConfigService.getLLMConfig();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  getLLMProviders = async (_req: Request, res: Response) => {
    try {
      const data = this.llmConfigService.getLLMProviders();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  updateLLMConfig = async (req: Request, res: Response) => {
    try {
      const data = this.llmConfigService.updateLLMConfig(req.body || {});
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  };

  getActiveLLMConfig = async (_req: Request, res: Response) => {
    try {
      const data = this.llmConfigService.getActiveLLMConfig();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
