import { Request, Response, Router } from 'express';
import os from 'os';
import DatabaseService from '../database';
import WebSocketService from '../websocket';
import { v7 as uuidv7 } from 'uuid';
import { spawn } from 'child_process';
import path from 'path';
import net from 'net';
import config from '../config';
import { LLM_PROVIDERS } from '../config/llm-providers';

function createApiRoutes(
  database: DatabaseService,
  websocketService: WebSocketService
): Router {
  const router = Router();
  const normalizeParam = (v: unknown): string =>
    Array.isArray(v) ? String(v[0]) : String(v ?? '');

  /**
   * 获取所有机器狗列表
   */
  router.get('/robots', (req: Request, res: Response) => {
    try {
      const list = database.getAllRobots();
      res.json({
        success: true,
        data: {
          robots: list,
          onlineCount: websocketService.getOnlineCount(),
        },
      });
      return;
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  router.get('/config/llm', (req: Request, res: Response) => {
    try {
      const provider = config.llm.provider;
      const openai = config.llm.openai;
      const bigmodel = config.llm.bigmodel;
      res.json({
        success: true,
        data: {
          provider,
          openai: {
            model: openai?.model || '',
            baseUrl: openai?.baseUrl || '',
            hasApiKey: !!(openai?.apiKey && String(openai.apiKey).length > 0),
            apiKeyLength: openai?.apiKey ? String(openai.apiKey).length : 0
          },
          bigmodel: {
            model: bigmodel?.model || '',
            baseUrl: bigmodel?.baseUrl || '',
            hasApiKey: !!(bigmodel?.apiKey && String(bigmodel.apiKey).length > 0),
            apiKeyLength: bigmodel?.apiKey ? String(bigmodel.apiKey).length : 0
          },
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 获取可用LLM服务商与模型列表
   */
  router.get('/config/llm/providers', (req: Request, res: Response) => {
    try {
      res.json({ success: true, data: LLM_PROVIDERS });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/config/llm', (req: Request, res: Response) => {
    try {
      const { provider, apiKey, model, baseUrl } = req.body || {};
      const finalProvider = ['openai', 'bigmodel'].includes(provider) ? provider : config.llm.provider;
      config.llm.provider = finalProvider;
      // 持久化 provider
      database.setSetting('llm.provider', finalProvider);
      if (finalProvider === 'openai') {
        config.llm.openai = config.llm.openai || { apiKey: '', model: '' };
        if (typeof apiKey === 'string') {
          config.llm.openai.apiKey = apiKey;
          database.setSetting('openai.apiKey', apiKey);
        }
        if (typeof model === 'string') {
          config.llm.openai.model = model;
          database.setSetting('openai.model', model);
        }
        if (typeof baseUrl === 'string') {
          config.llm.openai.baseUrl = baseUrl || undefined;
          database.setSetting('openai.baseUrl', baseUrl || '');
        }
      } else if (finalProvider === 'bigmodel') {
        config.llm.bigmodel = config.llm.bigmodel || { apiKey: '', model: '' };
        if (typeof apiKey === 'string') {
          config.llm.bigmodel.apiKey = apiKey;
          database.setSetting('bigmodel.apiKey', apiKey);
        }
        if (typeof model === 'string') {
          config.llm.bigmodel.model = model;
          database.setSetting('bigmodel.model', model);
        }
        if (typeof baseUrl === 'string') {
          config.llm.bigmodel.baseUrl = baseUrl || undefined;
          database.setSetting('bigmodel.baseUrl', baseUrl || '');
        }
      }
      res.json({ success: true, data: { provider: config.llm.provider } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.get('/config/ui', (req: Request, res: Response) => {
    try {
      const serverUrl = database.getSetting('ui.serverUrl') || '';
      const wsPath = database.getSetting('ui.wsPath') || config.ws.path || '/api/conversation/connect';
      const mhRaw = database.getSetting('ui.maxHistory');
      const maxHistory = mhRaw ? parseInt(mhRaw, 10) || 10 : 10;
      res.json({
        success: true,
        data: { serverUrl, wsPath, maxHistory }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.put('/config/ui', (req: Request, res: Response) => {
    try {
      const { serverUrl, wsPath, maxHistory } = req.body || {};
      if (typeof serverUrl === 'string') {
        database.setSetting('ui.serverUrl', serverUrl);
      }
      if (typeof wsPath === 'string') {
        database.setSetting('ui.wsPath', wsPath);
      }
      if (typeof maxHistory !== 'undefined') {
        const mh = Array.isArray(maxHistory) ? Number(maxHistory[0]) : Number(maxHistory);
        if (!Number.isNaN(mh)) {
          database.setSetting('ui.maxHistory', String(mh));
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 创建机器人
   */
  router.post('/robots', async (req: Request, res: Response) => {
    try {
      const { name, robot_ip, local_ip, local_port, group_name, model, status } = req.body || {};

      // 若提供了机器人IP，则执行SSH初始化流程：创建数据目录、获取/生成UUID、复制客户端代码
      let finalUuid: string | null = null;
      if (robot_ip) {
        // 1) 先测试SSH连通性
        const sshArgsCheck = [
          '-o', 'BatchMode=yes',
          '-o', 'ConnectTimeout=5',
          '-o', 'StrictHostKeyChecking=no',
          `firefly@${robot_ip}`,
          'exit',
        ];
        const canSsh = await new Promise<boolean>((resolve) => {
          const p = spawn('ssh', sshArgsCheck);
          let hadError = false;
          let stderr = '';
          p.stderr.on('data', (d) => { stderr += d.toString(); });
          p.on('error', () => { hadError = true; resolve(false); });
          p.on('close', (code) => {
            if (!hadError && code === 0) {
              resolve(true);
            } else if (stderr.includes('Permission denied') || stderr.includes('Authentication failed')) {
              resolve(true);
            } else {
              resolve(false);
            }
          });
        });
        if (!canSsh) {
          return res.status(400).json({ success: false, error: `无法通过SSH连接到 ${robot_ip}` });
        }

        // 2) 创建数据目录并处理UUID
        const remoteInitCmd = [
          'mkdir -p ~/robot-chat',
          'if [ -f ~/robot-chat/config.json ]; then cat ~/robot-chat/config.json; else (test -r /etc/machine-id && cat /etc/machine-id) || echo \"\"; fi',
        ].join(' && ');
        const sshArgsInit = [
          '-o', 'StrictHostKeyChecking=no',
          `firefly@${robot_ip}`,
          remoteInitCmd,
        ];
        const remoteUuidRaw = await new Promise<string>((resolve, reject) => {
          const p = spawn('ssh', sshArgsInit);
          let stdout = '';
          let stderr = '';
          p.stdout.on('data', (d) => { stdout += d.toString(); });
          p.stderr.on('data', (d) => { stderr += d.toString(); });
          p.on('error', (e) => reject(e));
          p.on('close', (code) => {
            if (code === 0) {
              resolve(stdout.trim());
            } else {
              reject(new Error(stderr || `远程初始化失败 (code=${code})`));
            }
          });
        }).catch((e: any) => {
          throw new Error(e?.message || '远程初始化失败');
        });

        let parsedUuid: string | null = null;
        if (remoteUuidRaw && remoteUuidRaw.startsWith('{')) {
          try {
            const obj = JSON.parse(remoteUuidRaw);
            if (obj && typeof obj.uuid === 'string' && obj.uuid.length >= 8) {
              parsedUuid = obj.uuid;
            }
          } catch {}
        } else if (remoteUuidRaw && remoteUuidRaw.length >= 8) {
          parsedUuid = remoteUuidRaw;
        }
        finalUuid = parsedUuid || uuidv7();

        const needWriteConfig = !parsedUuid;
        if (needWriteConfig) {
          const configJson = JSON.stringify({ uuid: finalUuid });
          const writeCmd = `bash -lc 'cat > ~/robot-chat/config.json << \"EOF\"\n${configJson}\nEOF'`;
          const sshArgsWrite = ['-o', 'StrictHostKeyChecking=no', `firefly@${robot_ip}`, writeCmd];
          const wrote = await new Promise<boolean>((resolve) => {
            const p = spawn('ssh', sshArgsWrite);
            p.on('error', () => resolve(false));
            p.on('close', (code) => resolve(code === 0));
          });
          if (!wrote) {
            return res.status(500).json({ success: false, error: '写入远程配置失败' });
          }
        }

        // 3) 复制客户端代码到机器狗的目录
        // 运行环境通常在 backend 目录，client 位于其上级 ../client
        const clientPath = path.resolve(process.cwd(), '../client');
        // 使用bash以支持通配符展开，复制目录内容而不是目录本身
        const scpCmd = `scp -r -o StrictHostKeyChecking=no ${clientPath}/* firefly@${robot_ip}:~/robot-chat/`;
        const scpProc = spawn('bash', ['-lc', scpCmd]);
        const scpOk = await new Promise<boolean>((resolve) => {
          scpProc.on('error', () => resolve(false));
          scpProc.on('close', (code) => resolve(code === 0));
        });
        if (!scpOk) {
          return res.status(500).json({ success: false, error: '复制客户端代码到机器狗失败' });
        }
      }

      const uuid = finalUuid ?? uuidv7();
      const metadata = {
        robot_ip: robot_ip || null,
        local_ip: local_ip || null,
        local_port: local_port ?? null,
        group_name: group_name || null,
      };
      database.registerRobot({
        uuid,
        name: name || null,
        model: model || null,
        status: (status as any) || 'offline',
        last_connected: new Date(),
        metadata: metadata as any,
      });
      const created = database.getRobot(uuid);
      return res.json({ success: true, data: created });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 更新机器人
   */
  router.put('/robots/:uuid', async (req: Request, res: Response) => {
    try {
      const uuid = normalizeParam((req.params as any).uuid);
      const existing = database.getRobot(uuid);
      if (!existing) {
        return res.status(404).json({ success: false, error: '机器人不存在' });
      }
      const { name, model, status, robot_ip, local_ip, local_port, group_name, ai_temperature, ai_system_prompt } = req.body || {};
      let meta: any = {};
      try {
        meta = existing.metadata ? JSON.parse(existing.metadata) : {};
      } catch {
        meta = {};
      }
      if (robot_ip !== undefined) meta.robot_ip = robot_ip || null;
      if (local_ip !== undefined) meta.local_ip = local_ip || null;
      if (local_port !== undefined) meta.local_port = local_port ?? null;
      if (group_name !== undefined) meta.group_name = group_name || null;
      if (ai_temperature !== undefined) meta.ai_temperature = ai_temperature;
      if (ai_system_prompt !== undefined) meta.ai_system_prompt = ai_system_prompt || '';
      const updated = database.updateRobot(uuid, {
        name: name !== undefined ? name : existing.name,
        model: model !== undefined ? model : existing.model,
        status: status !== undefined ? (status as any) : existing.status,
        metadata: JSON.stringify(meta),
      });
      return res.json({ success: true, data: updated });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 删除机器人
   */
  router.delete('/robots/:uuid', async (req: Request, res: Response) => {
    try {
      const uuid = normalizeParam((req.params as any).uuid);
      database.deleteRobot(uuid);
      return res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  router.post('/robots/:uuid/test-connection', async (req: Request, res: Response) => {
    try {
      const uuid = normalizeParam((req.params as any).uuid);
      let robotIp: string | null = null;
      const robot = database.getRobot(uuid);
      if (!robot) return res.status(404).json({ success: false, error: '机器人不存在' });
      try {
        const meta = robot.metadata ? JSON.parse(robot.metadata) : {};
        robotIp = meta.robot_ip || null;
      } catch {
        robotIp = null;
      }
      if (!robotIp) return res.status(400).json({ success: false, error: '缺少机器人IP' });
      const pingOk = await new Promise<boolean>((resolve) => {
        const p = spawn('ping', ['-c', '1', '-W', '2', robotIp!]);
        let hadError = false;
        p.on('error', () => {
          hadError = true;
          resolve(false);
        });
        p.on('close', (code) => {
          resolve(!hadError && code === 0);
        });
      });
      if (!pingOk) {
        return res.json({ success: false, connected: false, message: `网络不可达: ${robotIp}` });
      }
      const sshReachable = await new Promise<boolean>((resolve) => {
        const socket = net.createConnection({ host: robotIp!, port: 22 });
        const timer = setTimeout(() => {
          try { socket.destroy(); } catch {}
          resolve(false);
        }, 3000);
        socket.on('connect', () => {
          clearTimeout(timer);
          try { socket.destroy(); } catch {}
          resolve(true);
        });
        socket.on('error', () => {
          clearTimeout(timer);
          try { socket.destroy(); } catch {}
          resolve(false);
        });
        socket.on('timeout', () => {
          clearTimeout(timer);
          try { socket.destroy(); } catch {}
          resolve(false);
        });
      });
      if (sshReachable) {
        return res.json({ success: true, connected: true, message: `SSH端口可达: ${robotIp}` });
      }
      return res.json({ success: false, connected: false, message: `SSH端口不可达: ${robotIp}` });
    } catch (error: any) {
      res.status(500).json({ success: false, connected: false, error: error.message });
    }
  });

  router.post('/robots/:uuid/connect', async (req: Request, res: Response) => {
    try {
      const uuid = normalizeParam((req.params as any).uuid);
      let robotIp: string | null = null;
      const robot = database.getRobot(uuid);
      if (!robot) return res.status(404).json({ success: false, error: '机器人不存在' });
      try {
        const meta = robot.metadata ? JSON.parse(robot.metadata) : {};
        robotIp = meta.robot_ip || null;
      } catch {
        robotIp = null;
      }
      if (!robotIp) return res.status(400).json({ success: false, error: '缺少机器人IP' });
      const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3', '-o', 'StrictHostKeyChecking=no', `firefly@${robotIp}`, 'exit'];
      const ok = await new Promise<boolean>((resolve) => {
        const p = spawn('ssh', args);
        let hadError = false;
        p.on('error', () => {
          hadError = true;
          resolve(false);
        });
        p.on('close', (code) => {
          resolve(!hadError && code === 0);
        });
      });
      if (!ok) {
        return res.status(500).json({ success: false, error: '连接失败' });
      }
      database.updateRobotStatus(uuid, 'online');
      const updated = database.getRobot(uuid);
      return res.json({ success: true, data: updated, message: '连接成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 获取指定机器狗信息
   */
  router.get('/robots/:robotId', (req: Request, res: Response) => {
    try {
      const robotId = normalizeParam((req.params as any).robotId);
      const robot = database.getRobot(robotId);
      if (!robot) {
        return res.status(404).json({
          success: false,
          error: '机器狗不存在',
        });
      }
      res.json({
        success: true,
        data: robot,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 获取对话历史
   */
  router.get('/conversations/:robotId', (req: Request, res: Response) => {
    try {
      const robotId = normalizeParam((req.params as any).robotId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      const conversations = database.getConversationHistory(robotId, limit, offset);

      res.json({
        success: true,
        data: {
          conversations,
          limit,
          offset,
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 获取系统状态
   */
  router.get('/status', (req: Request, res: Response) => {
    try {
      const onlineRobots = websocketService.getOnlineCount();
      const allRobots = database.getAllRobots();

      res.json({
        success: true,
        data: {
          onlineRobots,
          totalRobots: allRobots.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * 健康检查
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    });
  });

  /**
   * 获取本机IP
   */
  router.get('/network/local-ip', (req: Request, res: Response) => {
    try {
      const interfaces = os.networkInterfaces();
      const addresses: string[] = [];
      Object.keys(interfaces).forEach((ifname) => {
        interfaces[ifname]?.forEach((iface) => {
          if (iface.family !== 'IPv4' || iface.internal) return;
          addresses.push(iface.address);
        });
      });
      const ip = addresses[0] || '';
      res.json({ success: true, data: { ip, all: addresses } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createApiRoutes;
