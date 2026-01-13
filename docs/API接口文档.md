# API 接口文档

## 目录

- [1. 基础信息](#1-基础信息)
- [2. 网络相关接口](#2-网络相关接口)
- [3. 工程管理接口](#3-工程管理接口)
- [4. 机器人管理接口](#4-机器人管理接口)
- [5. 动作执行接口](#5-动作执行接口)
- [6. 时间轴接口](#6-时间轴接口)
- [7. 自定义动作接口](#7-自定义动作接口)
- [8. 音频管理接口](#8-音频管理接口)
- [9. 工程保存导入导出](#9-工程保存导入导出)
- [10. 构建与运行接口](#10-构建与运行接口)
- [11. 错误码说明](#11-错误码说明)

---

## 1. 基础信息

### 1.1 服务器配置

- **基础URL**: `http://localhost:3000`
- **WebSocket URL**: `ws://localhost:3001`
- **内容类型**: `application/json`

### 1.2 通用响应格式

#### 成功响应

```json
{
  "success": true,
  "data": {}
}
```

#### 错误响应

```json
{
  "success": false,
  "error": "错误信息描述"
}
```

---

## 2. 网络相关接口

### 2.1 获取本地 IP 地址

获取运行后端服务器的本机 IP 地址。

**接口地址**: `GET /api/network/local-ip`

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "ip": "192.168.1.100",
    "all": ["192.168.1.100", "10.0.0.5"]
  }
}
```

**响应字段说明**:

| 字段 | 类型 | 说明 |
|------|------|------|
| ip | string | 默认 IP 地址（第一个非内网 IPv4） |
| all | string[] | 所有可用的 IP 地址列表 |

---

## 3. 工程管理接口

### 3.1 获取工程列表

获取所有工程的列表。

**接口地址**: `GET /api/projects`

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "uuid": "01939e7a-1234-7890-abcd-ef1234567890",
      "user_uuid": "00000000-0000-0000-0000-000000000000",
      "name": "我的机器狗项目",
      "description": "双狗协同舞蹈表演",
      "folder_path": "/home/user/Documents/RobotDogControlProjects/my_project",
      "thumbnail_path": null,
      "last_opened": "2026-01-13T10:30:00.000Z",
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    }
  ]
}
```

### 3.2 获取单个工程信息

根据 UUID 获取工程的详细信息。

**接口地址**: `GET /api/projects/:uuid`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "uuid": "01939e7a-1234-7890-abcd-ef1234567890",
    "name": "我的机器狗项目",
    "description": "双狗协同舞蹈表演",
    "folder_path": "/home/user/Documents/RobotDogControlProjects/my_project",
    "thumbnail_path": null,
    "last_opened": "2026-01-13T10:30:00.000Z",
    "created_at": "2026-01-10T08:00:00.000Z",
    "updated_at": "2026-01-13T10:30:00.000Z"
  }
}
```

### 3.3 获取工程文件列表

获取工程目录下的文件和文件夹列表。

**接口地址**: `GET /api/projects/:uuid/files`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 否 | 相对路径（默认为根目录） |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "files": [
      {
        "name": "main.py",
        "path": "main.py",
        "isDirectory": false,
        "size": 1024
      },
      {
        "name": "audio",
        "path": "audio",
        "isDirectory": true
      }
    ]
  }
}
```

### 3.4 获取文件内容

读取工程目录下某个文件的内容。

**接口地址**: `GET /api/projects/:uuid/files/content`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**Query 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| path | string | 是 | 文件相对路径 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "content": "from lib.api import CrazyRobotDog\n\n# 初始化机器狗\ndog = CrazyRobotDog(...)"
  }
}
```

### 3.5 创建新工程

创建一个新的工程。

**接口地址**: `POST /api/projects`

**请求体**:

```json
{
  "name": "新工程",
  "description": "工程描述（可选）"
}
```

**请求参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 工程名称 |
| description | string | 否 | 工程描述 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "uuid": "01939e8b-5678-7890-abcd-ef0987654321",
    "name": "新工程",
    "description": null,
    "folder_path": "/home/user/Documents/RobotDogControlProjects/新工程_01939e8b",
    "created_at": "2026-01-13T12:00:00.000Z"
  }
}
```

### 3.6 更新工程信息

更新工程的名称和描述。

**接口地址**: `PUT /api/projects/:uuid`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "name": "更新后的工程名",
  "description": "更新后的描述"
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "工程信息已更新"
  }
}
```

### 3.7 删除工程

删除指定的工程（包括数据库记录和工程文件夹）。

**接口地址**: `DELETE /api/projects/:uuid`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "工程已删除"
  }
}
```

### 3.8 打开工程

标记工程为最近打开，更新 `last_opened` 时间。

**接口地址**: `POST /api/projects/:uuid/open`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "工程已打开"
  }
}
```

---

## 4. 机器人管理接口

### 4.1 获取机器人列表

获取工程中的所有机器人。

**接口地址**: `GET /api/projects/:projectUuid/robots`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": [
    {
      "uuid": "019abc12-3456-7890-abcd-ef1234567890",
      "name": "131",
      "robot_ip": "192.168.1.110",
      "local_ip": "192.168.1.100",
      "local_port": 10131,
      "group_name": "A组",
      "status": "offline",
      "created_at": "2026-01-10T08:00:00.000Z",
      "updated_at": "2026-01-13T10:30:00.000Z"
    }
  ]
}
```

### 4.2 添加机器人

向工程中添加一个新的机器人。

**接口地址**: `POST /api/projects/:projectUuid/robots`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "name": "131",
  "robot_ip": "192.168.1.110",
  "local_ip": "192.168.1.100",
  "local_port": 10131,
  "group_name": "A组"
}
```

**请求参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 机器人名称 |
| robot_ip | string | 是 | 机器人 IP 地址 |
| local_ip | string | 是 | 本地 IP 地址 |
| local_port | number | 是 | 本地端口 |
| group_name | string | 否 | 分组名称 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "uuid": "019abc12-3456-7890-abcd-ef1234567890",
    "name": "131",
    "robot_ip": "192.168.1.110",
    "local_ip": "192.168.1.100",
    "local_port": 10131,
    "group_name": "A组",
    "status": "offline",
    "created_at": "2026-01-13T12:00:00.000Z",
    "updated_at": "2026-01-13T12:00:00.000Z"
  }
}
```

### 4.3 更新机器人信息

更新机器人的配置信息。

**接口地址**: `PUT /api/projects/:projectUuid/robots/:robotUuid`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| robotUuid | string | 是 | 机器人 UUID |

**请求体**:

```json
{
  "name": "131-更新",
  "robot_ip": "192.168.1.111",
  "local_ip": "192.168.1.100",
  "local_port": 10131,
  "group_name": "B组"
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "机器人信息已更新"
  }
}
```

### 4.4 删除机器人

从工程中删除机器人。

**接口地址**: `DELETE /api/projects/:projectUuid/robots/:robotUuid`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| robotUuid | string | 是 | 机器人 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "机器人已删除"
  }
}
```

### 4.5 测试机器人连接

测试机器人的 SSH 连接（包括自动安装依赖）。

**接口地址**: `POST /api/projects/:projectUuid/robots/:robotUuid/test-connection`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| robotUuid | string | 是 | 机器人 UUID |

**请求体**:

```json
{
  "username": "firefly",
  "password": "firefly"
}
```

**请求参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 否 | SSH 用户名（默认：firefly） |
| password | string | 否 | SSH 密码（默认：firefly） |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "SSH连接成功，依赖已安装"
  }
}
```

### 4.6 连接机器人（SDK 连接测试）

测试通过 SDK 连接机器人（发送 UDP 控制指令）。

**接口地址**: `POST /api/projects/:projectUuid/robots/:robotUuid/connect`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| robotUuid | string | 是 | 机器人 UUID |

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "连接成功"
  }
}
```

### 4.7 重启机器人运控

通过 SSH 重启机器人的运动控制服务。

**接口地址**: `POST /api/projects/:projectUuid/robots/:robotUuid/restart-motion`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| robotUuid | string | 是 | 机器人 UUID |

**请求体**:

```json
{
  "username": "firefly",
  "password": "firefly"
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "运控重启成功"
  }
}
```

---

## 5. 动作执行接口

### 5.1 执行动作序列

执行一系列机器人动作。

**接口地址**: `POST /api/projects/:projectUuid/execute-actions`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "robots": [
    {
      "uuid": "019abc12-3456-7890-abcd-ef1234567890",
      "name": "131",
      "robot_ip": "192.168.1.110",
      "local_ip": "192.168.1.100",
      "local_port": 10131
    }
  ],
  "actions": [
    {
      "action": "stand_up",
      "params": [],
      "duration": 0
    },
    {
      "action": "move",
      "params": [1.0, 0, 0],
      "duration": 2
    },
    {
      "action": "jump",
      "params": [],
      "duration": 0
    }
  ]
}
```

**动作类型说明**:

| 动作 | 参数 | 说明 |
|------|------|------|
| stand_up | [] | 站立 |
| lie_down | [] | 趴下 |
| move | [vx, vy, yaw_rate] | 移动（前向速度、侧向速度、角速度） |
| jump | [] | 原地跳跃 |
| front_jump | [] | 向前跳 |
| back_flip | [] | 后空翻 |
| shake_hand | [] | 握手 |
| attitude_control | [roll, pitch, yaw, height] | 姿态控制 |
| wait | [] | 等待（使用 duration 字段指定等待时间） |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "executionId": "exec_123456",
    "message": "动作执行已启动"
  }
}
```

### 5.2 停止动作执行

停止正在执行的动作序列。

**接口地址**: `POST /api/projects/:projectUuid/stop-execution/:executionId`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |
| executionId | string | 是 | 执行 ID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "执行已停止"
  }
}
```

### 5.3 获取执行状态列表

获取当前正在执行的动作列表。

**接口地址**: `GET /api/projects/:projectUuid/executions`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectUuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "executions": [
      {
        "id": "exec_123456",
        "status": "running",
        "startTime": "2026-01-13T12:30:00.000Z"
      }
    ]
  }
}
```

---

## 6. 时间轴接口

### 6.1 保存时间轴数据

保存时间轴的完整配置到工程目录。

**接口地址**: `POST /api/projects/:uuid/timeline`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "timeline": {
    "tracks": [
      {
        "id": "track_1",
        "name": "机器人 131",
        "type": "action",
        "blocks": [
          {
            "id": "block_1",
            "action": "stand_up",
            "startTime": 0,
            "duration": 4.5,
            "params": {}
          }
        ]
      }
    ],
    "duration": 60,
    "fps": 30
  }
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "时间轴已保存",
    "path": "/home/user/Documents/RobotDogControlProjects/my_project/timeline.json"
  }
}
```

### 6.2 加载时间轴数据

从工程目录加载时间轴配置。

**接口地址**: `GET /api/projects/:uuid/timeline`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "timeline": {
      "tracks": [...],
      "duration": 60,
      "fps": 30
    }
  }
}
```

---

## 7. 自定义动作接口

### 7.1 创建自定义动作

创建一个自定义动作（Python 脚本）。

**接口地址**: `POST /api/projects/:uuid/custom-actions`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "name": "my_custom_dance",
  "code": "from lib.api import CrazyRobotDog\n\ndef execute(dog):\n    dog.stand_up()\n    dog.jump()"
}
```

**请求参数说明**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 动作名称（文件名） |
| code | string | 是 | Python 代码 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "自定义动作已创建",
    "path": "custom_actions/my_custom_dance.py"
  }
}
```

### 7.2 获取自定义动作列表

获取工程中所有自定义动作。

**接口地址**: `GET /api/projects/:uuid/custom-actions`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "name": "my_custom_dance.py",
        "path": "custom_actions/my_custom_dance.py",
        "content": "from lib.api import CrazyRobotDog\n..."
      }
    ]
  }
}
```

---

## 8. 音频管理接口

### 8.1 上传音频文件

上传音频文件到工程的 audio 目录。

**接口地址**: `POST /api/projects/:uuid/upload-audio`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求类型**: `multipart/form-data`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| audio | file | 是 | 音频文件 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "filename": "bgm.mp3",
    "path": "audio/bgm.mp3",
    "size": 2048000
  }
}
```

### 8.2 获取音频文件

获取工程中的音频文件（返回文件流）。

**接口地址**: `GET /api/projects/:uuid/audio/:filename`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |
| filename | string | 是 | 音频文件名 |

**响应**: 音频文件流（Content-Type: audio/*)

---

## 9. 工程保存导入导出

### 9.1 保存工程

保存当前工程的所有数据。

**接口地址**: `POST /api/projects/:uuid/save`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求体**:

```json
{
  "robots": [...],
  "timeline": {...},
  "customActions": [...]
}
```

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "工程已保存"
  }
}
```

### 9.2 导出工程

将工程打包为 .rdcp 文件（ZIP 格式）。

**接口地址**: `GET /api/projects/:uuid/export`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**响应**: 工程压缩包（Content-Type: application/zip）

**文件名**: `{工程名称}.rdcp`

### 9.3 导入工程

从 .rdcp 文件导入工程。

**接口地址**: `POST /api/projects/import`

**请求类型**: `multipart/form-data`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| project | file | 是 | .rdcp 工程文件 |

**响应示例**:

```json
{
  "success": true,
  "data": {
    "uuid": "019abc34-5678-7890-abcd-ef1234567890",
    "name": "导入的工程",
    "message": "工程导入成功"
  }
}
```

---

## 10. 构建与运行接口

### 10.1 构建工程

将时间轴编译为可执行的 Python 脚本。

**接口地址**: `POST /api/projects/:uuid/build`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "message": "构建成功",
    "outputPath": "build/main.py"
  }
}
```

### 10.2 运行工程

执行构建后的 Python 脚本。

**接口地址**: `POST /api/projects/:uuid/run`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "executionId": "exec_789012",
    "message": "程序已启动"
  }
}
```

### 10.3 构建并运行

一键构建并运行工程。

**接口地址**: `POST /api/projects/:uuid/build-and-run`

**URL 参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| uuid | string | 是 | 工程 UUID |

**请求参数**: 无

**响应示例**:

```json
{
  "success": true,
  "data": {
    "executionId": "exec_789012",
    "message": "构建并运行成功"
  }
}
```

---

## 11. 错误码说明

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 请求成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

### 业务错误码

错误响应示例：

```json
{
  "success": false,
  "error": "工程不存在"
}
```

常见错误信息：

| 错误信息 | 说明 | 解决方案 |
|----------|------|----------|
| 工程不存在 | 指定的工程 UUID 不存在 | 检查 UUID 是否正确 |
| 机器人不存在 | 指定的机器人 UUID 不存在 | 检查机器人是否已添加 |
| 文件不存在 | 指定的文件路径不存在 | 检查文件路径是否正确 |
| 连接失败 | 无法连接到机器人 | 检查网络和机器人状态 |
| 数据库错误 | 数据库操作失败 | 查看日志获取详细信息 |

---

## 附录

### A. WebSocket 事件

WebSocket 连接用于实时推送执行状态和日志。

**连接地址**: `ws://localhost:3001`

**事件类型**:

| 事件 | 说明 | 数据格式 |
|------|------|----------|
| execution.start | 动作执行开始 | `{executionId, timestamp}` |
| execution.progress | 执行进度更新 | `{executionId, progress, message}` |
| execution.output | 执行输出日志 | `{executionId, output}` |
| execution.error | 执行错误 | `{executionId, error}` |
| execution.complete | 执行完成 | `{executionId, timestamp}` |

**示例**:

```javascript
const ws = new WebSocket('ws://localhost:3001');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('收到事件:', data);
};
```

### B. 版本历史

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1.0 | 2026-01-13 | 初始版本 |

---

**文档版本**: v0.1.0  
**最后更新**: 2026-01-13  
**维护人员**: 开发团队
