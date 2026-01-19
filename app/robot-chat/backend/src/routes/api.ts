import { spawn } from 'child_process';
import { Request, Response, Router } from 'express';
import net from 'net';
import os from 'os';
import path from 'path';
import { v7 as uuidv7 } from 'uuid';
import config from '../config';
import { LLM_PROVIDERS } from '../config/llm-providers';
import DatabaseService from '../database';
import WebSocketService from '../websocket';
import type { RobotRecord } from '../types';
import type { ServerMessage } from '../types';
import { formatTimestamp, newDate } from '../utils/datetime';

function createApiRoutes(
  database: DatabaseService,
  websocketService: WebSocketService
): Router {
  const router = Router();
  const normalizeParam = (v: unknown): string =>
    Array.isArray(v) ? String(v[0]) : String(v ?? '');

  const transformRobot = (r: RobotRecord | undefined) => {
    if (!r) return r;
    let meta: any = {};
    try {
      meta = r.metadata ? JSON.parse(r.metadata) : {};
    } catch {
      meta = {};
    }
    const {
      robot_ip = null,
      local_ip = null,
      local_port = null,
      group_name = null,
      ai_temperature,
      ai_system_prompt,
    } = meta || {};
    return {
      ...r,
      robot_ip,
      local_ip,
      local_port,
      group_name,
      ai_temperature,
      ai_system_prompt,
    };
  };

  /**
   * 获取所有机器狗列表
   */
  router.get('/robots', (req: Request, res: Response) => {
    try {
      const list = database.getAllRobots().map(transformRobot);
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
        const pythonScript = path.resolve(__dirname, '../utils/ssh_helper.py');
        const canSsh = await new Promise<boolean>((resolve) => {
          const p = spawn('python3', [pythonScript, 'test', robot_ip]);
          let stdout = '';
          p.stdout.on('data', (d) => { stdout += d.toString(); });
          p.on('error', () => resolve(false));
          p.on('close', (code) => {
            if (code === 0) {
              try {
                const result = JSON.parse(stdout);
                resolve(result.success && result.connected);
              } catch {
                resolve(false);
              }
            } else {
              resolve(false);
            }
          });
        });
        if (!canSsh) {
          return res.status(400).json({ success: false, error: `无法通过SSH连接到 ${robot_ip}` });
        }

        // 2) 创建数据目录并从机器人读取UUID
        console.log(`[INFO] 创建远程目录并检查UUID...`);
        const remoteInitCmd = [
          'mkdir -p /home/firefly/sparkrobot/robot-chat',
          'mkdir -p /home/firefly/sparkrobot/config',
          // 尝试读取config.toml中的uuid
          'if [ -f /home/firefly/sparkrobot/config/config.toml ]; then grep "^uuid" /home/firefly/sparkrobot/config/config.toml | cut -d"=" -f2 | tr -d \' \"\' | xargs; fi',
        ].join(' && ');
        
        const remoteUuidRaw = await new Promise<string>((resolve, reject) => {
          const p = spawn('python3', [pythonScript, 'exec', robot_ip, remoteInitCmd]);
          let stdout = '';
          p.stdout.on('data', (d) => { stdout += d.toString(); });
          p.on('error', (e) => reject(e));
          p.on('close', (code) => {
            if (code === 0) {
              try {
                const result = JSON.parse(stdout);
                if (result.success) {
                  resolve(result.output.trim());
                } else {
                  reject(new Error(result.error || '远程初始化失败'));
                }
              } catch (e) {
                reject(new Error('解析输出失败'));
              }
            } else {
              reject(new Error('远程初始化失败'));
            }
          });
        }).catch((e: any) => {
          throw new Error(e?.message || '远程初始化失败');
        });

        // 解析机器人内部的UUID
        let robotUuid: string | null = null;
        if (remoteUuidRaw && remoteUuidRaw.length > 0) {
          // 验证UUID格式 (UUIDv7格式: xxxxxxxx-xxxx-7xxx-xxxx-xxxxxxxxxxxx)
          const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidPattern.test(remoteUuidRaw)) {
            robotUuid = remoteUuidRaw;
            console.log(`[INFO] 从机器人读取到UUID: ${robotUuid}`);
          }
        }

        // 如果机器人没有UUID，生成新的UUID
        if (!robotUuid) {
          robotUuid = uuidv7();
          console.log(`[INFO] 机器人没有UUID，生成新UUID: ${robotUuid}`);
          
          // 将新生成的UUID写入机器人
          const configToml = `# 火花机器人配置文件\n# 生成于 ${formatTimestamp()}\n\nuuid = "${robotUuid}"\n`;
          const wrote = await new Promise<boolean>((resolve) => {
            const p = spawn('python3', [pythonScript, 'write', robot_ip, '/home/firefly/sparkrobot/config/config.toml', configToml]);
            let stdout = '';
            p.stdout.on('data', (d) => { stdout += d.toString(); });
            p.on('error', () => resolve(false));
            p.on('close', (code) => {
              if (code === 0) {
                try {
                  const result = JSON.parse(stdout);
                  resolve(result.success);
                } catch {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          });
          if (!wrote) {
            return res.status(500).json({ success: false, error: '写入远程UUID配置失败' });
          }
          console.log(`[SUCCESS] 已将UUID写入机器人配置文件`);
        } else {
          console.log(`[INFO] 使用机器人现有的UUID`);
        }

        // 设置最终使用的UUID（来自机器人）
        finalUuid = robotUuid;

        // 3) 复制客户端代码到机器狗的目录
        // 确定client目录的绝对路径（从backend/src/routes向上三级到robot-chat，再进入client）
        const clientPath = path.resolve(__dirname, '../../../client');
        console.log(`[INFO] Client path: ${clientPath}`);
        
        const scpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
          const p = spawn('python3', [pythonScript, 'copy', robot_ip, clientPath, '/home/firefly/sparkrobot/robot-chat']);
          let stdout = '';
          let stderr = '';
          p.stdout.on('data', (d) => { stdout += d.toString(); });
          p.stderr.on('data', (d) => { 
            stderr += d.toString();
            console.log(`[SSH] ${d.toString().trim()}`);
          });
          p.on('error', (err) => {
            console.error(`[ERROR] spawn error:`, err);
            resolve({ success: false, error: err.message });
          });
          p.on('close', (code) => {
            console.log(`[INFO] Copy process exit code: ${code}`);
            if (code === 0) {
              try {
                const result = JSON.parse(stdout);
                resolve(result);
              } catch (e) {
                console.error(`[ERROR] JSON parse error:`, e, `stdout:`, stdout);
                resolve({ success: false, error: '解析输出失败' });
              }
            } else {
              resolve({ success: false, error: stderr || '复制失败' });
            }
          });
        });
        
        if (!scpResult.success) {
          return res.status(500).json({ 
            success: false, 
            error: `复制客户端代码到机器狗失败: ${scpResult.error || '未知错误'}` 
          });
        }
        
        console.log(`[SUCCESS] 机器人 ${robot_ip} 初始化完成，UUID: ${finalUuid}`);
      }

      // 使用机器人的UUID或生成新的UUID（仅当未提供robot_ip时）
      const uuid = finalUuid ?? uuidv7();
      console.log(`[INFO] 准备写入数据库，UUID: ${uuid}`);
      
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
      const created = transformRobot(database.getRobot(uuid) as RobotRecord);
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
      return res.json({ success: true, data: transformRobot(updated as RobotRecord) });
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

  /*
   * 测试机器人连接
   */
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

  /**  
   * 连接机器人
   */
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
      const pythonScript = path.resolve(__dirname, '../utils/ssh_helper.py');
      const ok = await new Promise<boolean>((resolve) => {
        const p = spawn('python3', [pythonScript, 'test', robotIp]);
        let stdout = '';
        p.stdout.on('data', (d) => { stdout += d.toString(); });
        p.on('error', () => resolve(false));
        p.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result.success && result.connected);
            } catch {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      });
      if (!ok) {
        return res.status(500).json({ success: false, error: '连接失败' });
      }
      database.updateRobotStatus(uuid, 'online');
      const updated = transformRobot(database.getRobot(uuid) as RobotRecord);
      return res.json({ success: true, data: updated, message: '连接成功' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  /**
   * 更新机器人固件（复制客户端代码）
   */
  router.post('/robots/:uuid/update-firmware', async (req: Request, res: Response) => {
    try {
      const uuid = normalizeParam((req.params as any).uuid);
      const robot = database.getRobot(uuid);
      if (!robot) {
        return res.status(404).json({ success: false, error: '机器人不存在' });
      }

      let robotIp: string | null = null;
      try {
        const meta = robot.metadata ? JSON.parse(robot.metadata) : {};
        robotIp = meta.robot_ip || null;
      } catch {
        robotIp = null;
      }

      if (!robotIp) {
        return res.status(400).json({ success: false, error: '缺少机器人IP地址' });
      }

      const pythonScript = path.resolve(__dirname, '../utils/ssh_helper.py');
      
      // 1) 测试连接
      console.log(`[INFO] 测试连接到 ${robotIp}...`);
      const canConnect = await new Promise<boolean>((resolve) => {
        const p = spawn('python3', [pythonScript, 'test', robotIp]);
        let stdout = '';
        p.stdout.on('data', (d) => { stdout += d.toString(); });
        p.on('error', () => resolve(false));
        p.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result.success && result.connected);
            } catch {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      });

      if (!canConnect) {
        return res.status(400).json({ success: false, error: `无法连接到机器人 ${robotIp}` });
      }

      // 2) 确保远程目录存在
      console.log(`[INFO] 创建远程目录...`);
      const mkdirCmd = 'mkdir -p /home/firefly/sparkrobot/robot-chat && mkdir -p /home/firefly/sparkrobot/config';
      const mkdirOk = await new Promise<boolean>((resolve) => {
        const p = spawn('python3', [pythonScript, 'exec', robotIp, mkdirCmd]);
        let stdout = '';
        p.stdout.on('data', (d) => { stdout += d.toString(); });
        p.on('error', () => resolve(false));
        p.on('close', (code) => {
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result.success);
            } catch {
              resolve(false);
            }
          } else {
            resolve(false);
          }
        });
      });

      if (!mkdirOk) {
        return res.status(500).json({ success: false, error: '创建远程目录失败' });
      }

      // 3) 复制客户端代码
      console.log(`[INFO] 开始复制客户端代码...`);
      const clientPath = path.resolve(__dirname, '../../../client');
      console.log(`[INFO] Client path: ${clientPath}`);

      const copyResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
        const p = spawn('python3', [pythonScript, 'copy', robotIp, clientPath, '/home/firefly/sparkrobot/robot-chat']);
        let stdout = '';
        let stderr = '';
        p.stdout.on('data', (d) => { stdout += d.toString(); });
        p.stderr.on('data', (d) => { 
          stderr += d.toString();
          console.log(`[SSH] ${d.toString().trim()}`);
        });
        p.on('error', (err) => {
          console.error(`[ERROR] spawn error:`, err);
          resolve({ success: false, error: err.message });
        });
        p.on('close', (code) => {
          console.log(`[INFO] Copy process exit code: ${code}`);
          if (code === 0) {
            try {
              const result = JSON.parse(stdout);
              resolve(result);
            } catch (e) {
              console.error(`[ERROR] JSON parse error:`, e, `stdout:`, stdout);
              resolve({ success: false, error: '解析输出失败' });
            }
          } else {
            resolve({ success: false, error: stderr || '复制失败' });
          }
        });
      });

      if (!copyResult.success) {
        return res.status(500).json({ 
          success: false, 
          error: `复制客户端代码失败: ${copyResult.error || '未知错误'}` 
        });
      }

      console.log(`[SUCCESS] 固件更新成功`);
      return res.json({ 
        success: true, 
        message: '客户端代码已成功更新到机器人',
        data: { robotIp }
      });
    } catch (error: any) {
      console.error(`[ERROR] 更新固件失败:`, error);
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
          timestamp: formatTimestamp(),
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
        timestamp: formatTimestamp(),
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

  /**
   * 发送文本到指定机器狗（由前端控制面调用）
   */
  router.post('/robot/:robotId/command', (req: Request, res: Response) => {
    try {
      const robotId = normalizeParam((req.params as any).robotId);
      const { text } = req.body || {};
      if (typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ success: false, error: '缺少文本内容' });
      }
      const message: ServerMessage = {
        type: 'text_response',
        robotId,
        timestamp: Date.now(),
        data: { text: String(text) },
      };
      const ok = websocketService.sendToRobot(robotId, message);
      if (!ok) {
        return res.status(404).json({ success: false, error: '机器人未连接或不存在' });
      }
      // 可选：记录到对话历史（标记为控制端直接下发）
      database.insertConversation({
        robot_id: robotId,
        timestamp: new Date(),
        type: 'text',
        user_input: `[controller] ${String(text)}`,
        ai_response: String(text),
        actions: JSON.stringify([]),
        processing_time: 0,
        metadata: JSON.stringify({ from: 'controller' }),
      });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  return router;
}

export default createApiRoutes;
