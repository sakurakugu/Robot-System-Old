// WebSocket消息类型定义

export interface RobotConnection {
  robotId: string;
  websocket: any;
  connectedAt: Date;
  lastActiveAt: Date;
  channel?: 'control' | 'business' | 'audio_upload' | 'audio_download';
  metadata: {
    name?: string;
    model?: string;
    version?: string;
    motion_control_version?: string;
    robot_server_version?: string;
  };
}

// 音频相关
export interface AudioChunk {
  format: 'opus' | 'pcm' | 'mp3';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  sessionId?: string;
  seq?: number;
  frameDurationMs?: number;
  buffer: string; // base64 编码的音频数据
}

export interface AudioStart {
  format: 'opus' | 'pcm';
  sampleRate: 16000 | 48000;
  channels: 1 | 2;
  frameDurationMs: number;
  sessionId: string;
}

export interface AudioEnd {
  sessionId: string;
  reason?: 'silence' | 'max_length' | 'manual' | 'error';
}

export interface AudioResponse {
  format: 'opus' | 'mp3';
  buffer: string; // base64 编码的音频数据
  duration: number;
}

// 客户端消息
export type ClientMessage =
  | AudioStartMessage
  | AudioChunkMessage
  | AudioEndMessage
  | TextInputMessage
  | HeartbeatMessage
  | StatusMessage
  | ClientRegisterMessage
  | TTSInputMessage
  | VideoSubscribeMessage
  | VideoUnsubscribeMessage
  | ActionInputMessage
  | ControlInputMessage
  | AudioControlMessage
  | SdkModeSetMessage
  | SdkModeGetMessage
  | SdkModeResponseMessage
  | PackageDownloadResponseMessage;

export interface SdkModeSetMessage {
  type: 'sdk_mode_set';
  robotId: string;
  timestamp: number;
  data: {
    mode: number;
  };
}

export interface SdkModeGetMessage {
  type: 'sdk_mode_get';
  robotId: string;
  timestamp: number;
  data?: any;
}

export interface SdkModeResponseMessage {
  type: 'sdk_mode_response';
  robotId: string;
  timestamp: number;
  data: {
    mode: number;
    result: 'success' | 'failure';
  };
}

export interface AudioStartMessage {
  type: 'audio_start';
  robotId: string;
  timestamp: number;
  data: AudioStart;
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  robotId: string;
  timestamp: number;
  data: AudioChunk;
}

export interface AudioEndMessage {
  type: 'audio_end';
  robotId: string;
  timestamp: number;
  data: AudioEnd;
}

export interface TextInputMessage {
  type: 'text_input';
  robotId: string;
  timestamp: number;
  data: {
    text: string;
    context?: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  robotId: string;
  timestamp: number;
  data?: any;
}

export interface StatusMessage {
  type: 'status';
  robotId: string;
  timestamp: number;
  data: {
    battery?: number;
    temperature?: number;
    position?: string;
  };
}

export interface ClientRegisterMessage {
  type: 'robot_register';
  robotId: string;
  timestamp: number;
  data: {
    name?: string;
    model?: string;
    version?: string;
    metadata?: {
      version?: string; // robot-agent 版本
      motion_control_version?: string;
      robot_server_version?: string;
      [key: string]: any;
    };
  };
}

export interface TTSInputMessage {
  type: 'tts_input';
  robotId: string;
  timestamp: number;
  data: {
    text: string;
    ttsOptions?: TTSOptions;
    conversationId?: string;
  };
}

export interface VideoSubscribeMessage {
  type: 'video_subscribe';
  robotId?: string;
  timestamp?: number;
}

export interface VideoUnsubscribeMessage {
  type: 'video_unsubscribe';
  robotId?: string;
  timestamp?: number;
}

export interface ActionInputMessage {
  type: 'action_input';
  robotId: string;
  timestamp: number;
  data: {
    action: string;
    parameters?: Record<string, any>;
  };
}

export interface ControlInputMessage {
  type: 'control_input';
  robotId: string;
  timestamp: number;
  data: {
    command: 'joystick' | 'joystick_stop' | 'estop';
    channel?: 'move' | 'look' | 'pose';
    mode?: 'move' | 'pose';
    x?: number;
    y?: number;
    speed?: number;
  };
}

export interface AudioControlMessage {
  type: 'audio_control';
  robotId: string;
  timestamp: number;
  data: {
    enabled: boolean;
  };
}

// 服务端消息
export type ServerMessage =
  | AudioResponseMessage
  | AudioStreamStartMessage
  | AudioStreamChunkMessage
  | AudioStreamEndMessage
  | ActionCommandMessage
  | ControlCommandMessage
  | TextResponseMessage
  | VideoFrameMessage
  | ErrorMessage
  | BatteryStatusMessage
  | StatusUpdateMessage
  | AudioControlCommandMessage
  | AsrTranscriptMessage
  | PackageDownloadCommandMessage
  | ChoreoWSMessage;

export interface AudioResponseMessage {
  type: 'audio_response';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: AudioResponse;
}

export interface AudioStreamStartMessage {
  type: 'audio_stream_start';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: {
    sessionId: string;
    format: 'mp3';
  };
}

export interface AudioStreamChunkMessage {
  type: 'audio_stream_chunk';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: {
    sessionId: string;
    seq: number;
    buffer: string;
  };
}

export interface AudioStreamEndMessage {
  type: 'audio_stream_end';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: {
    sessionId: string;
    duration: number;
  };
}

export interface ActionCommandMessage {
  type: 'action_command';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: ActionCommand;
}

export interface ControlCommandMessage {
  type: 'control_command';
  robotId: string;
  timestamp: number;
  data: {
    command: 'joystick' | 'joystick_stop' | 'estop';
    channel?: 'move' | 'look' | 'pose';
    mode?: 'move' | 'pose';
    x?: number;
    y?: number;
    speed?: number;
  };
}

export interface TextResponseMessage {
  type: 'text_response';
  robotId: string;
  timestamp: number;
  conversationId?: string;
  data: {
    text: string;
    noTTS?: boolean;
    ttsDone?: boolean;
    actions?: string[];
  };
}

export interface ErrorMessage {
  type: 'error';
  robotId: string;
  timestamp: number;
  data: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface VideoFrameMessage {
  type: 'video_frame';
  robotId: string;
  timestamp: number;
  data: {
    frame: string; // base64 编码的 JPEG 图像
  };
}

export interface BatteryStatusMessage {
  type: 'battery_status';
  robotId: string;
  timestamp: number;
  data: {
    level: number;
  };
}

export interface StatusUpdateMessage {
  type: 'status_update';
  robotId: string;
  timestamp: number;
  data: {
    battery?: number;
    temperature?: number;
    position?: string;
    [key: string]: any;
  };
}

export interface AudioControlCommandMessage {
  type: 'audio_control';
  robotId: string;
  timestamp: number;
  data: {
    enabled: boolean;
    source?: 'ui' | 'system';
  };
}

export interface AsrTranscriptMessage {
  type: 'asr_transcript';
  robotId: string;
  timestamp: number;
  data: {
    text: string;
    sessionId?: string;
    durationMs?: number;
    asrTime?: number;
  };
}

// 引用其他模块的类型
import type { TTSOptions } from '../大模型交互/types';
import type { ActionCommand } from '../机器人交互/types';
import type { ChoreoWSMessage } from '../编舞系统/types';

/** 云端→机器人：通知机器人通过 HTTP 下载安装包 */
export interface PackageDownloadCommandMessage {
  type: 'package_download';
  robotId: string;
  timestamp: number;
  data: {
    requestId: string;
    /** 各包的相对下载路径（机器人自行拼接 HTTP 基础 URL） */
    downloadPaths: {
      agent?: string;
      server?: string;
      common?: string;
    };
    /** 各包的 SHA-256 哈希，用于下载后校验 */
    hashes: {
      agent?: string;
      server?: string;
      common?: string;
    };
  };
}

/** 机器人→云端：下载安装包操作结果 */
export interface PackageDownloadResponseMessage {
  type: 'package_download_response';
  robotId: string;
  timestamp: number;
  data: {
    requestId: string;
    success: boolean;
    /** 成功下载的包类型列表 */
    downloaded?: string[];
    error?: string;
  };
}
