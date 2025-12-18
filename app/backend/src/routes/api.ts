import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import { v7 as uuidv7 } from 'uuid';
import { getMainDatabase, ProjectDatabase } from '../database';
import { PATHS, CONFIG } from '../config';
import { pythonExecutor } from '../services/python-executor';
import path from 'path';
import fs from 'fs';
import os from 'os';

const router = express.Router();

// 获取本地 IP
router.get('/network/local-ip', (req: Request, res: Response) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    
    Object.keys(interfaces).forEach((ifname) => {
      interfaces[ifname]?.forEach((iface) => {
        // 跳过内部（即 127.0.0.1）和非 IPv4 地址
        if ('IPv4' !== iface.family || iface.internal) {
          return;
        }
        addresses.push(iface.address);
      });
    });

    // 默认返回第一个找到的 IP，或者空字符串
    const localIp = addresses.length > 0 ? addresses[0] : '';
    
    res.json({ success: true, data: { ip: localIp, all: addresses } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目接口
interface Project {
  uuid: string;
  user_uuid: string;
  name: string;
  description?: string;
  folder_path: string;
  thumbnail_path?: string;
  last_opened?: string;
  created_at: string;
  updated_at: string;
}

// 获取所有项目
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const projects = await db.all<Project>(
      'SELECT * FROM project_index ORDER BY last_opened DESC, created_at DESC'
    );
    res.json({ success: true, data: projects });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取单个项目
router.get('/projects/:uuid', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目文件列表
router.get('/projects/:uuid/files', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 递归读取文件夹结构
    const readDirectory = (dirPath: string, relativePath: string = ''): any[] => {
      const items: any[] = [];
      
      try {
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          // 跳过隐藏文件和特定文件夹
          if (file.startsWith('.') || file === 'node_modules' || file === 'backups') {
            continue;
          }
          
          const fullPath = path.join(dirPath, file);
          const relPath = relativePath ? path.join(relativePath, file) : file;
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            items.push({
              name: file,
              path: relPath,
              isDirectory: true,
              children: readDirectory(fullPath, relPath)
            });
          } else {
            items.push({
              name: file,
              path: relPath,
              isDirectory: false,
              size: stat.size,
              modifiedTime: stat.mtime
            });
          }
        }
      } catch (error) {
        console.error('读取目录失败:', dirPath, error);
      }
      
      // 排序：文件夹在前，文件在后，同类按名称排序
      items.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      
      return items;
    };

    const fileTree = readDirectory(project.folder_path);
    res.json({ success: true, data: fileTree });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 读取文件内容
router.get('/projects/:uuid/files/content', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );
    
    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    const filePath = req.query.path as string;
    if (!filePath) {
      return res.status(400).json({ success: false, error: '文件路径是必需的' });
    }

    // 防止目录遍历攻击
    const fullPath = path.join(project.folder_path, filePath);
    if (!fullPath.startsWith(project.folder_path)) {
      return res.status(403).json({ success: false, error: '非法的文件路径' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return res.status(400).json({ success: false, error: '无法读取文件夹内容' });
    }

    const content = fs.readFileSync(fullPath, 'utf-8');
    res.json({ success: true, data: content });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 创建新项目
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: '项目名称是必需的' });
    }

    const uuid = uuidv7();
    // 只替换文件系统不允许的特殊字符，保留中文字符
    const folderName = `${name.replace(/[<>:"\/|?*]/g, '_')}_${uuid.substring(0, 8)}`;
    const folderPath = path.join(PATHS.projectsDir, folderName);

    // 创建项目文件夹
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
      fs.mkdirSync(path.join(folderPath, 'audio'));
      fs.mkdirSync(path.join(folderPath, 'exports'));
      fs.mkdirSync(path.join(folderPath, 'backups'));
      fs.mkdirSync(path.join(folderPath, '.project_cache'));
    }

    // 创建项目数据库
    const projectDb = new ProjectDatabase(path.join(folderPath, 'project.db'));
    await projectDb.open();
    await projectDb.initTables();

    // 初始化项目配置 // TODO：这些推荐用json存储吗，还是直接存储字符串
    await projectDb.run(
      'INSERT INTO project_config (key, value) VALUES (?, ?)',
      ['project_uuid', JSON.stringify(uuid)]
    );
    await projectDb.run(
      'INSERT INTO project_config (key, value) VALUES (?, ?)',
      ['project_version', JSON.stringify('1.0.0')]
    );
    await projectDb.run(
      'INSERT INTO project_config (key, value) VALUES (?, ?)',
      ['user_uuid', JSON.stringify('00000000-0000-0000-0000-000000000000')]
    );

    await projectDb.close();

    // 创建项目元数据文件
    const projectMeta = {
      uuid,
      name,
      description: description || '',
      version: '1.0.0',
      app_version: CONFIG.APP_VERSION,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_opened: null,
      thumbnail: null,
      settings: {
        auto_backup: true,
        backup_interval: 300,
        max_backups: 10,
      },
    };

    fs.writeFileSync(
      path.join(folderPath, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    // 在主数据库中记录项目
    const db = await getMainDatabase();
    await db.run(
      `INSERT INTO project_index 
       (uuid, user_uuid, name, description, folder_path, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uuid,
        '00000000-0000-0000-0000-000000000000',
        name,
        description || '',
        folderPath,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // 返回新创建的项目
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [uuid]
    );

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新项目
router.put('/projects/:uuid', async (req: Request, res: Response) => {
  try {
    const { name, description } = req.body;
    const db = await getMainDatabase();

    await db.run(
      `UPDATE project_index 
       SET name = ?, description = ?, updated_at = ? 
       WHERE uuid = ?`,
      [name, description, new Date().toISOString(), req.params.uuid]
    );

    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除项目
router.delete('/projects/:uuid', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    // 删除数据库记录
    await db.run('DELETE FROM project_index WHERE uuid = ?', [req.params.uuid]);

    // 删除项目文件夹（可选：移到回收站）
    if (fs.existsSync(project.folder_path)) {
      fs.rmSync(project.folder_path, { recursive: true, force: true });
    }

    res.json({ success: true, message: '项目删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 打开项目（更新最后打开时间）
router.post('/projects/:uuid/open', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    await db.run(
      'UPDATE project_index SET last_opened = ? WHERE uuid = ?',
      [new Date().toISOString(), req.params.uuid]
    );

    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    res.json({ success: true, data: project });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 机器人相关接口
router.get('/projects/:projectUuid/robots', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    const robots = await projectDb.all('SELECT * FROM robots');
    await projectDb.close();

    res.json({ success: true, data: robots });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/projects/:projectUuid/robots', async (req: Request, res: Response) => {
  try {
    const { name, robot_ip, local_ip, local_port, group_name } = req.body;
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const robotUuid = uuidv7();
    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    
    await projectDb.run(
      `INSERT INTO robots 
       (uuid, name, robot_ip, local_ip, local_port, group_name, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        robotUuid,
        name,
        robot_ip,
        local_ip,
        local_port,
        group_name || null,
        new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    const robot = await projectDb.get('SELECT * FROM robots WHERE uuid = ?', [robotUuid]);
    await projectDb.close();

    res.json({ success: true, data: robot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新机器人
router.put('/projects/:projectUuid/robots/:robotUuid', async (req: Request, res: Response) => {
  try {
    const { name, robot_ip, local_ip, local_port, group_name, status } = req.body;
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    
    await projectDb.run(
      `UPDATE robots 
       SET name = ?, robot_ip = ?, local_ip = ?, local_port = ?, group_name = ?, status = ?, updated_at = ?
       WHERE uuid = ?`,
      [
        name,
        robot_ip,
        local_ip,
        local_port,
        group_name || null,
        status || 'offline',
        new Date().toISOString(),
        req.params.robotUuid,
      ]
    );

    const robot = await projectDb.get('SELECT * FROM robots WHERE uuid = ?', [req.params.robotUuid]);
    await projectDb.close();

    res.json({ success: true, data: robot });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 删除机器人
router.delete('/projects/:projectUuid/robots/:robotUuid', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    
    await projectDb.run('DELETE FROM robots WHERE uuid = ?', [req.params.robotUuid]);
    await projectDb.close();

    res.json({ success: true, message: '机器人删除成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 测试机器人连接
router.post('/projects/:projectUuid/robots/:robotUuid/test-connection', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: 'Project not found' });
    }

    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    
    const robot = await projectDb.get('SELECT * FROM robots WHERE uuid = ?', [req.params.robotUuid]);
    await projectDb.close();

    if (!robot) {
      return res.status(404).json({ success: false, error: 'Robot not found' });
    }

    // 使用Python执行器测试连接
    const result = await pythonExecutor.testConnection({
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port,
    });

    // 更新机器人状态
    const projectDb2 = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb2.open();
    await projectDb2.run(
      'UPDATE robots SET status = ?, updated_at = ? WHERE uuid = ?',
      [result.success ? 'online' : 'offline', new Date().toISOString(), req.params.robotUuid]
    );
    await projectDb2.close();

    res.json({ 
      success: result.success, 
      connected: result.success,
      message: result.message,
      robot: robot
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      connected: false,
      error: error.message 
    });
  }
});

// 执行动作序列
router.post('/projects/:projectUuid/execute-actions', async (req: Request, res: Response) => {
  try {
    const { robotUuids, actions } = req.body;
    
    if (!robotUuids || !Array.isArray(robotUuids) || robotUuids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择至少一个机器人' });
    }

    if (!actions || !Array.isArray(actions) || actions.length === 0) {
      return res.status(400).json({ success: false, error: '动作序列不能为空' });
    }

    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.projectUuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 获取机器人信息
    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    
    const robots = [];
    for (const robotUuid of robotUuids) {
      const robot = await projectDb.get('SELECT * FROM robots WHERE uuid = ?', [robotUuid]);
      if (robot) {
        robots.push({
          name: robot.name,
          robot_ip: robot.robot_ip,
          local_ip: robot.local_ip,
          local_port: robot.local_port,
        });
      }
    }
    
    await projectDb.close();

    if (robots.length === 0) {
      return res.status(404).json({ success: false, error: '未找到有效的机器人' });
    }

    // 生成执行ID
    const executionId = uuidv7();

    // 异步执行动作序列（不阻塞响应）
    pythonExecutor.executeActions(executionId, {
      robots,
      actions,
      onProgress: (progress, message) => {
        console.log(`执行进度 [${executionId}]: ${progress}% - ${message}`);
      },
      onOutput: (data) => {
        console.log(`执行输出 [${executionId}]:`, data);
      },
      onError: (error) => {
        console.error(`执行错误 [${executionId}]:`, error);
      },
    }).catch(error => {
      console.error(`执行失败 [${executionId}]:`, error);
    });

    res.json({ 
      success: true, 
      executionId,
      message: '动作序列已开始执行' 
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 停止执行
router.post('/projects/:projectUuid/stop-execution/:executionId', async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const stopped = pythonExecutor.stopExecution(executionId);
    
    res.json({ 
      success: stopped, 
      message: stopped ? '执行已停止' : '未找到执行任务'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取正在执行的任务列表
router.get('/projects/:projectUuid/executions', async (req: Request, res: Response) => {
  try {
    const runningExecutions = pythonExecutor.getRunningExecutions();
    res.json({ success: true, data: runningExecutions });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 保存项目时间轴数据
router.post('/projects/:uuid/timeline', async (req: Request, res: Response) => {
  try {
    const { tracks, config } = req.body;
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 保存时间轴数据到项目文件夹
    const timelineDataPath = path.join(project.folder_path, 'timeline.json');
    const timelineData = {
      tracks: tracks || [],
      config: config || {},
      updated_at: new Date().toISOString()
    };

    fs.writeFileSync(timelineDataPath, JSON.stringify(timelineData, null, 2));

    // 更新项目的 updated_at 时间
    await db.run(
      'UPDATE project_index SET updated_at = ? WHERE uuid = ?',
      [new Date().toISOString(), req.params.uuid]
    );

    res.json({ success: true, message: '时间轴数据已保存' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 加载项目时间轴数据
router.get('/projects/:uuid/timeline', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    const timelineDataPath = path.join(project.folder_path, 'timeline.json');
    
    // 如果文件不存在，返回默认空数据
    if (!fs.existsSync(timelineDataPath)) {
      return res.json({ 
        success: true, 
        data: { 
          tracks: [], 
          config: {
            duration: 60,
            pixelsPerSecond: 100,
            currentTime: 0,
            snapToGrid: true,
            gridSize: 0.5
          }
        } 
      });
    }

    const timelineData = JSON.parse(fs.readFileSync(timelineDataPath, 'utf-8'));
    res.json({ success: true, data: timelineData });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 配置multer用于音频上传
const audioStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const projectUuid = req.params.uuid;
      const db = await getMainDatabase();
      const project = await db.get<Project>(
        'SELECT * FROM project_index WHERE uuid = ?',
        [projectUuid]
      );

      if (!project) {
        return cb(new Error('项目未找到'), '');
      }

      const audioDir = path.join(project.folder_path, 'audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }

      cb(null, audioDir);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req, file, cb) => {
    // 保留原始文件名，但添加时间戳避免重名
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const filename = `${basename}_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const audioUpload = multer({
  storage: audioStorage,
  fileFilter: (req, file, cb) => {
    // 只接受音频文件
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('只能上传音频文件'));
    }
  },
  limits: {
    fileSize: 50 * 1024 * 1024 // 限制50MB
  }
});

// 上传音频文件
router.post('/projects/:uuid/upload-audio', audioUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 返回相对于项目文件夹的路径
    const relativePath = path.relative(project.folder_path, req.file.path);
    const audioUrl = `/api/v1/projects/${req.params.uuid}/audio/${req.file.filename}`;

    res.json({
      success: true,
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size,
        path: relativePath,
        url: audioUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 获取项目音频文件
router.get('/projects/:uuid/audio/:filename', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    const audioPath = path.join(project.folder_path, 'audio', req.params.filename);
    
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ success: false, error: '音频文件未找到' });
    }

    res.sendFile(audioPath);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 配置multer用于工程导入
const importStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(os.tmpdir(), 'robot-dog-imports');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const filename = `import_${timestamp}${ext}`;
    cb(null, filename);
  }
});

const importUpload = multer({
  storage: importStorage,
  fileFilter: (req, file, cb) => {
    // 接受 .zip 和 .hhzip 文件
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype === 'application/zip' || file.mimetype === 'application/x-zip-compressed' || ext === '.zip' || ext === '.hhzip') {
      cb(null, true);
    } else {
      cb(new Error('只能上传 ZIP 或 HHZIP 压缩文件'));
    }
  },
  limits: {
    fileSize: 500 * 1024 * 1024 // 限制500MB
  }
});

// 保存工程（保存当前工程的所有数据）
router.post('/projects/:uuid/save', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 更新项目元数据文件
    const projectJsonPath = path.join(project.folder_path, 'project.json');
    const projectMeta = {
      uuid: project.uuid,
      name: project.name,
      description: project.description || '',
      created_at: project.created_at,
      updated_at: new Date().toISOString()
    };
    
    fs.writeFileSync(projectJsonPath, JSON.stringify(projectMeta, null, 2));

    // 更新主数据库中的时间戳
    await db.run(
      'UPDATE project_index SET updated_at = ? WHERE uuid = ?',
      [new Date().toISOString(), req.params.uuid]
    );

    res.json({ success: true, message: '工程保存成功' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导出工程为 .hhzip 文件
router.get('/projects/:uuid/export', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 确保 exports 目录存在
    const exportsDir = path.join(project.folder_path, 'exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    // 生成导出文件名
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const exportFileName = `${project.name}_${timestamp}.hhzip`;
    const exportPath = path.join(exportsDir, exportFileName);

    // 使用 archiver 创建 zip 压缩文件
    const archiver = require('archiver');
    const output = fs.createWriteStream(exportPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // 最高压缩级别
    });

    // 监听完成事件
    output.on('close', () => {
      // 发送文件给客户端
      res.download(exportPath, exportFileName, (err) => {
        // 下载完成后删除临时文件
        if (fs.existsSync(exportPath)) {
          fs.unlinkSync(exportPath);
        }
        if (err) {
          console.error('下载文件时出错:', err);
        }
      });
    });

    archive.on('error', (err: Error) => {
      throw err;
    });

    archive.pipe(output);

    // 添加项目文件夹中的所有文件到压缩包
    // 排除 exports 目录和其他临时文件
    const addFilesToArchive = (dirPath: string, basePath: string = '') => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = basePath ? path.join(basePath, item) : item;
        
        // 跳过 exports 目录和隐藏文件
        if (item === 'exports' || item.startsWith('.')) {
          continue;
        }
        
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          addFilesToArchive(fullPath, relativePath);
        } else {
          archive.file(fullPath, { name: relativePath });
        }
      }
    };

    addFilesToArchive(project.folder_path);

    // 完成压缩
    await archive.finalize();
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 导入现有工程
router.post('/projects/import', importUpload.single('project'), async (req: Request, res: Response) => {
  const tempExtractDir = path.join(os.tmpdir(), 'robot-dog-extracts', `extract_${Date.now()}`);
  
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '没有上传文件' });
    }

    // 动态导入 extract-zip
    const extract = (await import('extract-zip')).default;
    
    // 解压文件
    await extract(req.file.path, { dir: tempExtractDir });

    // 查找 project.json 文件
    let projectJsonPath: string | null = null;
    let projectRootDir: string = tempExtractDir;

    const findProjectJson = (dir: string): string | null => {
      const items = fs.readdirSync(dir);
      
      // 首先在当前目录查找
      if (items.includes('project.json')) {
        return path.join(dir, 'project.json');
      }
      
      // 如果有且仅有一个子目录，递归查找
      const subdirs = items.filter(item => {
        const itemPath = path.join(dir, item);
        return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
      });
      
      if (subdirs.length === 1) {
        return findProjectJson(path.join(dir, subdirs[0]));
      }
      
      return null;
    };

    projectJsonPath = findProjectJson(tempExtractDir);

    if (!projectJsonPath) {
      // 清理临时文件
      fs.rmSync(req.file.path, { force: true });
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      return res.status(400).json({ success: false, error: '压缩包中未找到 project.json 文件' });
    }

    // 确定项目根目录
    projectRootDir = path.dirname(projectJsonPath);

    // 读取 project.json
    const projectMeta = JSON.parse(fs.readFileSync(projectJsonPath, 'utf-8'));
    
    if (!projectMeta.name) {
      // 清理临时文件
      fs.rmSync(req.file.path, { force: true });
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
      return res.status(400).json({ success: false, error: 'project.json 格式不正确，缺少 name 字段' });
    }

    // 生成新的 UUID
    const newUuid = uuidv7();
    const folderName = `${projectMeta.name.replace(/[<>:"\/|?*]/g, '_')}_${newUuid.substring(0, 8)}`;
    const targetPath = path.join(PATHS.projectsDir, folderName);

    // 移动项目文件夹到目标位置
    fs.renameSync(projectRootDir, targetPath);

    // 更新 project.json 中的 UUID 和时间戳
    projectMeta.uuid = newUuid;
    projectMeta.imported_at = new Date().toISOString();
    projectMeta.updated_at = new Date().toISOString();
    
    fs.writeFileSync(
      path.join(targetPath, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    // 检查并更新项目数据库
    const projectDbPath = path.join(targetPath, 'project.db');
    if (fs.existsSync(projectDbPath)) {
      const projectDb = new ProjectDatabase(projectDbPath);
      await projectDb.open();
      
      // 更新项目配置中的 UUID
      await projectDb.run(
        'UPDATE project_config SET value = ? WHERE key = ?',
        [JSON.stringify(newUuid), 'project_uuid']
      );
      
      await projectDb.close();
    }

    // 在主数据库中记录导入的项目
    const db = await getMainDatabase();
    await db.run(
      `INSERT INTO project_index 
       (uuid, user_uuid, name, description, folder_path, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newUuid,
        '00000000-0000-0000-0000-000000000000',
        projectMeta.name,
        projectMeta.description || '',
        targetPath,
        projectMeta.created_at || new Date().toISOString(),
        new Date().toISOString(),
      ]
    );

    // 清理临时文件
    fs.rmSync(req.file.path, { force: true });
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }

    // 返回新创建的项目
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [newUuid]
    );

    res.json({ success: true, data: project });
  } catch (error: any) {
    // 清理临时文件
    if (req.file && fs.existsSync(req.file.path)) {
      fs.rmSync(req.file.path, { force: true });
    }
    if (fs.existsSync(tempExtractDir)) {
      fs.rmSync(tempExtractDir, { recursive: true, force: true });
    }
    
    res.status(500).json({ success: false, error: error.message });
  }
});

// 封装项目为Python脚本
router.post('/projects/:uuid/build', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 读取时间轴数据
    const timelineDataPath = path.join(project.folder_path, 'timeline.json');
    if (!fs.existsSync(timelineDataPath)) {
      return res.status(400).json({ success: false, error: '未找到时间轴数据' });
    }

    const timelineData = JSON.parse(fs.readFileSync(timelineDataPath, 'utf-8'));
    
    // 读取项目的机器人配置
    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    const robots = await projectDb.all<any[]>('SELECT * FROM robots');
    await projectDb.close();
    
    // 创建build目录
    const buildDir = path.join(project.folder_path, 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // 复制lib库到build目录
    const libSourcePath = path.join(process.cwd(), '..', 'robot-control', 'lib');
    const libTargetPath = path.join(buildDir, 'lib');
    
    if (fs.existsSync(libSourcePath)) {
      // 删除旧的lib目录
      if (fs.existsSync(libTargetPath)) {
        fs.rmSync(libTargetPath, { recursive: true, force: true });
      }
      // 复制lib目录
      copyDirectory(libSourcePath, libTargetPath);
    }

    // 生成Python代码
    const pythonCode = generatePythonFromTimeline(timelineData, project.name, robots);
    
    // 写入Python文件
    const pythonFilePath = path.join(buildDir, `${sanitizeFilename(project.name)}.py`);
    fs.writeFileSync(pythonFilePath, pythonCode, 'utf-8');

    res.json({ 
      success: true, 
      message: '封装成功',
      data: {
        pythonFile: path.basename(pythonFilePath),
        buildPath: buildDir
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 运行项目的Python脚本
router.post('/projects/:uuid/run', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    const buildDir = path.join(project.folder_path, 'build');
    const pythonFilePath = path.join(buildDir, `${sanitizeFilename(project.name)}.py`);

    if (!fs.existsSync(pythonFilePath)) {
      return res.status(400).json({ success: false, error: '未找到Python文件，请先封装' });
    }

    // 运行Python脚本
    const result = pythonExecutor.execute(pythonFilePath, buildDir);

    res.json({ 
      success: true, 
      data: {
        executionId: result.executionId
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 封装并运行
router.post('/projects/:uuid/build-and-run', async (req: Request, res: Response) => {
  try {
    const db = await getMainDatabase();
    const project = await db.get<Project>(
      'SELECT * FROM project_index WHERE uuid = ?',
      [req.params.uuid]
    );

    if (!project) {
      return res.status(404).json({ success: false, error: '项目未找到' });
    }

    // 读取时间轴数据
    const timelineDataPath = path.join(project.folder_path, 'timeline.json');
    if (!fs.existsSync(timelineDataPath)) {
      return res.status(400).json({ success: false, error: '未找到时间轴数据' });
    }

    const timelineData = JSON.parse(fs.readFileSync(timelineDataPath, 'utf-8'));
    
    // 读取项目的机器人配置
    const projectDb = new ProjectDatabase(path.join(project.folder_path, 'project.db'));
    await projectDb.open();
    const robots = await projectDb.all<any[]>('SELECT * FROM robots');
    await projectDb.close();
    
    // 创建build目录
    const buildDir = path.join(project.folder_path, 'build');
    if (!fs.existsSync(buildDir)) {
      fs.mkdirSync(buildDir, { recursive: true });
    }

    // 复制lib库到build目录
    const libSourcePath = path.join(process.cwd(), '..', 'robot-control', 'lib');
    const libTargetPath = path.join(buildDir, 'lib');
    
    if (fs.existsSync(libSourcePath)) {
      // 删除旧的lib目录
      if (fs.existsSync(libTargetPath)) {
        fs.rmSync(libTargetPath, { recursive: true, force: true });
      }
      // 复制lib目录
      copyDirectory(libSourcePath, libTargetPath);
    }

    // 生成Python代码
    const pythonCode = generatePythonFromTimeline(timelineData, project.name, robots);
    
    // 写入Python文件
    const pythonFilePath = path.join(buildDir, `${sanitizeFilename(project.name)}.py`);
    fs.writeFileSync(pythonFilePath, pythonCode, 'utf-8');

    // 运行Python脚本
    const result = pythonExecutor.execute(pythonFilePath, buildDir);

    res.json({ 
      success: true, 
      message: '封装并运行成功',
      data: {
        executionId: result.executionId
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 辅助函数：复制目录
function copyDirectory(source: string, target: string) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }

  const files = fs.readdirSync(source);
  for (const file of files) {
    const sourcePath = path.join(source, file);
    const targetPath = path.join(target, file);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

// 辅助函数：清理文件名
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5]/g, '_');
}

// 辅助函数：从时间轴生成Python代码
function generatePythonFromTimeline(timelineData: any, projectName: string, robots: any[] = []): string {
  const { tracks, config } = timelineData;
  
  console.log('开始生成Python代码...');
  console.log('时间轴轨道数量:', tracks?.length || 0);
  console.log('项目机器人数量:', robots.length);
  
  // 提取所有机器人配置
  const robotsMap = new Map<string, any>();
  const actions: Array<{ time: number; robot: string; action: string; params: any }> = [];
  
  // 使用数据库中的机器人配置作为默认配置
  robots.forEach(robot => {
    robotsMap.set(robot.uuid, {
      name: robot.name,
      robot_ip: robot.robot_ip,
      local_ip: robot.local_ip,
      local_port: robot.local_port
    });
  });
  
  // 分析轨道数据
  tracks.forEach((track: any, index: number) => {
    console.log(`轨道 ${index}:`, {
      type: track.type,
      robotId: track.robotId,
      blocksCount: track.blocks?.length || 0,
      keyframesCount: track.keyframes?.length || 0
    });
    
    if (track.type === 'action') {
      // 检查轨道是否绑定了机器狗
      const robotId = track.robotId;
      
      if (!robotId) {
        // 如果轨道未绑定机器狗，跳过该轨道
        console.log(`⚠️ 轨道 ${index} 未绑定机器狗，跳过处理`);
        return;
      }
      
      // 检查robotId是否在机器人列表中
      if (!robotsMap.has(robotId)) {
        console.log(`⚠️ 轨道 ${index} 绑定的机器狗 ${robotId} 不存在，跳过处理`);
        return;
      }
      
      // 提取动作块
      if (track.blocks && Array.isArray(track.blocks)) {
        console.log(`轨道 ${index} 的动作块:`, track.blocks.length);
        track.blocks.forEach((block: any, blockIndex: number) => {
          console.log(`  块 ${blockIndex}:`, {
            name: block.name,
            actionType: block.actionType,
            startTime: block.startTime,
            duration: block.duration
          });
          
          // 如果有actionType才添加动作
          if (block.actionType) {
            actions.push({
              time: block.startTime || 0,
              robot: robotId,
              action: block.actionType,
              params: block.actionParams || {}
            });
          }
        });
      }
    }
  });
  
  console.log('提取的机器人数量:', robotsMap.size);
  console.log('提取的动作数量:', actions.length);
  
  // 按时间排序动作
  actions.sort((a, b) => a.time - b.time);
  
  // 生成Python代码
  let code = `# ${projectName}\n`;
  code += `from lib.api import CrazyRobotDog\n`;
  code += `import time\n\n`;
  
  // 创建机器人变量映射
  const robotVarMap = new Map<string, string>();
  
  // 生成机器人配置
  if (robotsMap.size > 0) {
    code += `# 机器人配置\n`;
    code += `DOGS_CONFIG = {\n`;
    robotsMap.forEach((config, uuid) => {
      code += `    "${config.name}": ("${config.robot_ip}", ${config.local_port}),\n`;
    });
    code += `}\n\n`;
    
    // 假设使用第一个机器人的local_ip
    const firstRobot = Array.from(robotsMap.values())[0];
    code += `LOCAL_IP = "${firstRobot.local_ip}"\n\n`;
    
    // 创建机器人实例
    code += `# 创建机器人实例\n`;
    let robotIndex = 1;
    robotsMap.forEach((config, uuid) => {
      const varName = `dog${robotIndex}`;
      robotVarMap.set(uuid, varName);
      code += `${varName} = CrazyRobotDog(\n`;
      code += `    name="${config.name}",\n`;
      code += `    robot_ip=DOGS_CONFIG["${config.name}"][0],\n`;
      code += `    local_ip=LOCAL_IP,\n`;
      code += `    local_port=DOGS_CONFIG["${config.name}"][1],\n`;
      code += `)\n\n`;
      robotIndex++;
    });
  } else {
    // 如果没有机器人配置，使用默认配置
    code += `# 默认机器人配置\n`;
    code += `DOGS_CONFIG = {\n`;
    code += `    "131": ("192.168.1.110", 10131),\n`;
    code += `}\n\n`;
    code += `LOCAL_IP = "192.168.1.105"\n\n`;
    code += `dog1 = CrazyRobotDog(\n`;
    code += `    name="131",\n`;
    code += `    robot_ip=DOGS_CONFIG["131"][0],\n`;
    code += `    local_ip=LOCAL_IP,\n`;
    code += `    local_port=DOGS_CONFIG["131"][1],\n`;
    code += `)\n\n`;
  }
  
  // 生成动作序列
  code += `# 动作序列\n`;
  if (actions.length > 0) {
    let lastTime = 0;
    actions.forEach((action, index) => {
      // 添加延迟
      if (action.time > lastTime) {
        const delay = action.time - lastTime;
        code += `time.sleep(${delay.toFixed(2)})\n`;
      }
      
      // 添加动作
      const robotVar = robotVarMap.get(action.robot) || 'dog1';
      const duration = action.params.duration !== undefined ? action.params.duration : '';
      const angle = action.params.angle !== undefined ? action.params.angle : '';
      const direction = action.params.direction ? `direction='${action.params.direction}'` : '';
      
      let params = [];
      if (duration !== '') params.push(duration);
      if (angle !== '') params.push(`angle=${angle}`);
      if (direction !== '') params.push(direction);
      
      const paramsStr = params.join(', ');
      code += `${robotVar}.${action.action}(${paramsStr})\n`;
      
      lastTime = action.time;
    });
  } else {
    code += `# 没有动作数据，添加默认动作\n`;
    code += `dog1.stand_up(0)\n`;
    code += `time.sleep(1)\n`;
    code += `dog1.attitude_rest()\n`;
  }
  
  return code;
}

export default router;
