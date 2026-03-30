import { EventEmitter } from 'events';
import WebSocket服务 from './service';
import type { RoleRepository } from '../角色管理/repository';
import type { RoleRecord } from '../角色管理/types';
import type { RobotRepository } from '../机器人管理/repository';
import type { RobotRecord } from '../机器人管理/types';

jest.mock('../../core/utils/helpers', () => ({
  hasVisionTag: jest.fn(() => false),
  isValidRobotId: jest.fn(() => true),
  parseNormalizedTargetPosition: jest.fn(() => null),
  RateLimiter: jest.fn().mockImplementation(() => ({
    check: jest.fn(() => true),
  })),
  removeActionTags: jest.fn((text: string) => text),
  removeTargetTags: jest.fn((text: string) => text),
  removeVisionTags: jest.fn((text: string) => text),
  uuidv7: jest.fn(() => 'generated-robot-id'),
}));

jest.mock('opusscript', () => {
  const MockOpus = jest.fn().mockImplementation(() => ({
    decode: jest.fn(),
    delete: jest.fn(),
  }));
  Object.assign(MockOpus, {
    Application: {
      VOIP: 2048,
    },
  });
  return {
    __esModule: true,
    default: MockOpus,
  };
});

jest.mock('../大模型交互/asr-service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('../大模型交互/tts-service', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    synthesize: jest.fn(),
    synthesizeStream: jest.fn(),
  })),
}));

jest.mock('../大模型交互/aliyun-streaming-asr', () => ({
  AliyunStreamingASR: jest.fn(),
}));

jest.mock('../../core/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

type 数据库Mock = {
  getRobot: jest.Mock;
  updateRobot: jest.Mock;
  upsertRobot: jest.Mock;
  getRole: jest.Mock;
  insertActionLog: jest.Mock;
  insertConversation: jest.Mock;
};

class 假WebSocket extends EventEmitter {
  readyState = 1;
  send = jest.fn();
  close = jest.fn();
}

function 创建数据库Mock(): 数据库Mock {
  return {
    getRobot: jest.fn(),
    updateRobot: jest.fn(),
    upsertRobot: jest.fn(),
    getRole: jest.fn(),
    insertActionLog: jest.fn(),
    insertConversation: jest.fn(),
  };
}

function 创建机器人仓库Mock(): jest.Mocked<RobotRepository> {
  return {
    listRobots: jest.fn(),
    getRobot: jest.fn(),
    listGroups: jest.fn(),
    upsertRobot: jest.fn(),
    updateRobot: jest.fn(),
    deleteRobot: jest.fn(),
    getRoleById: jest.fn(),
  };
}

function 创建角色仓库Mock(): jest.Mocked<RoleRepository> {
  return {
    createRole: jest.fn(),
    getRole: jest.fn(),
    getAllRoles: jest.fn(),
    updateRole: jest.fn(),
    deleteRole: jest.fn(),
    getRobotsByRole: jest.fn(),
  };
}

function 创建角色记录(partial: Partial<RoleRecord> = {}): RoleRecord {
  return {
    uuid: 'role-1',
    name: '默认角色',
    description: '说明',
    llm_provider: 'aliyun',
    llm_model: 'qwen-plus',
    temperature: 0.7,
    system_prompt: '系统提示',
    asr_provider: 'custom-asr',
    asr_model: 'custom-model',
    voice: 'xiaoyun',
    intent_strategy: 'default',
    max_history: 10,
    is_default: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建机器人记录(partial: Partial<RobotRecord> = {}): RobotRecord {
  return {
    uuid: 'robot-1',
    name: '一号狗',
    model: 'spark-mini',
    version: '1.0.0',
    motion_control_version: '2.0.0',
    server_version: '3.0.0',
    ip: '192.168.1.10',
    group_name: '默认组',
    tags: null,
    sn: 'SN-001',
    role_uuid: null,
    audio_route_config: null,
    status: 'offline',
    last_connected_at: null,
    registered_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_at: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function 创建连接请求(url: string) {
  return {
    url,
    headers: {
      host: 'localhost',
    },
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };
}

function 等待异步任务(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('WebSocket服务', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('处理机器人连接时应通过机器人仓库更新在线状态', async () => {
    const database = 创建数据库Mock();
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(创建机器人记录());

    const service = new WebSocket服务(database as any);
    service.set机器人仓库(repository);
    (service as any).setupHeartbeat = jest.fn();

    (service as any).handleConnection(
      new 假WebSocket(),
      创建连接请求('/api/v1/robot?robotId=robot-1'),
      'business',
    );
    await 等待异步任务();

    expect(repository.getRobot).toHaveBeenCalledWith('robot-1');
    expect(repository.updateRobot).toHaveBeenCalledWith('robot-1', { status: 'online' });
    expect(database.updateRobot).not.toHaveBeenCalled();
    expect(database.upsertRobot).not.toHaveBeenCalled();
  });

  it('处理首次机器人连接时应通过机器人仓库补建记录', async () => {
    const database = 创建数据库Mock();
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(undefined);

    const service = new WebSocket服务(database as any);
    service.set机器人仓库(repository);
    (service as any).setupHeartbeat = jest.fn();

    (service as any).handleConnection(
      new 假WebSocket(),
      创建连接请求('/api/v1/robot?robotId=robot-1'),
      'business',
    );
    await 等待异步任务();

    expect(repository.upsertRobot).toHaveBeenCalledWith({
      uuid: 'robot-1',
      status: 'online',
    });
    expect(database.upsertRobot).not.toHaveBeenCalled();
  });

  it('处理机器人注册时应通过机器人仓库写入注册信息', async () => {
    const database = 创建数据库Mock();
    const repository = 创建机器人仓库Mock();
    repository.getRobot.mockResolvedValue(创建机器人记录({
      name: '旧名字',
      model: '旧型号',
      version: '1.0.0',
      motion_control_version: '2.0.0',
      server_version: '3.0.0',
    }));

    const service = new WebSocket服务(database as any);
    service.set机器人仓库(repository);
    (service as any).sendToRobot = jest.fn();
    (service as any).sendError = jest.fn();

    await (service as any).handleRobotRegister('robot-1', {
      name: '新名字',
      metadata: {
        motion_control_version: '2.1.0',
        robot_server_version: '3.1.0',
      },
    });

    expect(repository.upsertRobot).toHaveBeenCalledWith(expect.objectContaining({
      uuid: 'robot-1',
      name: '新名字',
      model: '旧型号',
      version: '1.0.0',
      motion_control_version: '2.1.0',
      server_version: '3.1.0',
      status: 'online',
    }));
    expect(database.updateRobot).not.toHaveBeenCalled();
  });

  it('处理音频开始时应通过角色仓库读取 ASR 配置', async () => {
    const database = 创建数据库Mock();
    const 机器人仓库 = 创建机器人仓库Mock();
    const 角色仓库 = 创建角色仓库Mock();
    机器人仓库.getRobot.mockResolvedValue(创建机器人记录({
      role_uuid: 'role-1',
    }));
    角色仓库.getRole.mockResolvedValue(创建角色记录());

    const service = new WebSocket服务(database as any);
    service.set机器人仓库(机器人仓库);
    service.set角色仓库(角色仓库);

    await (service as any).handleAudioStart('robot-1', {
      sessionId: 'session-1',
      format: 'pcm',
      sampleRate: 16000,
      channels: 1,
      frameDurationMs: 20,
    });

    const 会话 = (service as any).audioSessions.get('session-1');
    expect(角色仓库.getRole).toHaveBeenCalledWith('role-1');
    expect(会话?.asrOptions).toEqual({
      provider: 'custom-asr',
      model: 'custom-model',
    });
    expect(database.getRole).not.toHaveBeenCalled();
  });

  it('处理机器人断开连接时应通过机器人仓库写入离线状态', async () => {
    const database = 创建数据库Mock();
    const repository = 创建机器人仓库Mock();
    const ws = new 假WebSocket();

    const service = new WebSocket服务(database as any);
    service.set机器人仓库(repository);
    (service as any).robotConnections.set('robot-1', new Map([
      ['business', {
        websocket: ws,
      }],
    ]));

    (service as any).handleDisconnection('robot-1', 'business', ws);
    await 等待异步任务();

    expect(repository.updateRobot).toHaveBeenCalledWith('robot-1', { status: 'offline' });
    expect(database.updateRobot).not.toHaveBeenCalled();
  });
});
