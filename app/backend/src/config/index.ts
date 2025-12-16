import path from 'path';
import os from 'os';
import pkg from '../../package.json';

export const APP_NAME = 'RobotDogControl';
export const APP_VERSION = pkg.version;

// 确定数据目录
const getDataDir = (): string => {
  if (process.env.APPDATA) {
    // Windows
    return path.join(process.env.APPDATA, APP_NAME);
  } else if (os.platform() === 'darwin') {
    // macOS
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  } else {
    // Linux
    return path.join(os.homedir(), '.local', 'share', APP_NAME);
  }
};

// 确定工程目录
const getProjectsDir = (): string => {
  return path.join(os.homedir(), 'Documents', `${APP_NAME}Projects`);
};

export const CONFIG = {
  APP_NAME: APP_NAME,                                           // 应用名称
  APP_VERSION: APP_VERSION,                                     // 应用版本
  APP_ROOT: process.cwd(),                                     // 应用根目录
  DATA_DIR: process.env.DATA_DIR || getDataDir(),              // 数据目录
  PROJECTS_DIR: process.env.PROJECTS_DIR || getProjectsDir(),  // 工程目录
  TEMP_DIR: path.join(os.tmpdir(), APP_NAME),                   // 临时目录
  
  // 服务器配置
  SERVER: {
    PORT: parseInt(process.env.PORT || '3000', 10),
    HOST: process.env.HOST || '0.0.0.0',
  },
  
  // WebSocket 配置
  WEBSOCKET: {
    PORT: parseInt(process.env.WS_PORT || '3001', 10),
  },
  
  // Python 控制层配置
  PYTHON: {
    SCRIPT_DIR: path.join(process.cwd(), '..', 'robot-control'),
    PYTHON_CMD: process.env.PYTHON_CMD || 'python3',
  },
};

// 派生路径
export const PATHS = {
  mainDb: path.join(CONFIG.DATA_DIR, 'main.db'),   // 主数据库路径
  configDir: path.join(CONFIG.DATA_DIR, 'config'), // 配置文件目录
  logsDir: path.join(CONFIG.DATA_DIR, 'logs'),     // 日志文件目录
  cacheDir: path.join(CONFIG.DATA_DIR, 'cache'),   // 缓存文件目录
  projectsDir: CONFIG.PROJECTS_DIR,                // 工程文件目录
  templatesDir: path.join(CONFIG.APP_ROOT, '..', '..', 'templates'), // 模板文件目录
};
