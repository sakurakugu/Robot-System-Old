# 阿里云 ASR 流式处理优化

## 优化目标

将阿里云 ASR 从"等待音频完整接收后再处理"优化为"边接收边处理"，显著降低语音识别延迟。

## 优化内容

### 1. 创建流式 ASR 服务类

**文件**: `app/robot-cloud/后端/src/modules/机器人交互/aliyun-streaming-asr.ts`

新建了 `AliyunStreamingASR` 类，支持：

- 提前建立 WebSocket 连接到阿里云
- 实时推送音频数据（`pushAudio()` 方法）
- 内部队列缓存音频块，确保连接建立前不丢包
- 异步等待识别完成（`finish()` 方法）

### 2. 修改 WebSocket 音频处理流程

**文件**: `app/robot-cloud/后端/src/modules/websocket/service.ts`

#### 改动点 1: `handleAudioStart` - 音频开始时启动 ASR

**之前**：只是创建音频会话，缓存配置

**现在**：

1. 检测是否使用阿里云 ASR
2. 如果是，立即创建 `AliyunStreamingASR` 实例
3. 异步启动 WebSocket 连接（不阻塞）
4. 同时初始化 Opus 解码器，准备实时解码

```typescript
// 在音频开始时就启动流式 ASR
if (useStreamingASR) {
  const streamingASR = new AliyunStreamingASR({ ... });
  streamingASR.start(); // 异步启动，不阻塞
  session.streamingASR = streamingASR;
  session.opusDecoder = new OpusScript(...); // 准备解码器
}
```

#### 改动点 2: `handleAudioChunk` - 边收边解码边发送

**之前**：只是缓存 Opus 音频块到数组

**现在**：

1. 缓存音频块（保留降级方案）
2. 如果启用了流式 ASR，立即解码 Opus 为 PCM
3. 将解码后的 PCM 推送到流式 ASR
4. 流式 ASR 内部会自动处理队列，确保不丢包

```typescript
// 接收到音频块后立即处理
session.chunks.push(chunk); // 保留副本用于降级
if (session.streamingASR && session.opusDecoder) {
  const pcmData = session.opusDecoder.decode(chunk, frameSize);
  session.streamingASR.pushAudio(pcmBuffer); // 实时推送
}
```

#### 改动点 3: `handleAudioEnd` - 等待流式 ASR 完成

**之前**：

1. 批量解码所有 Opus 音频块
2. 组装成完整 WAV 文件
3. 连接阿里云 ASR
4. 发送完整音频
5. 等待结果

**现在**：

1. 如果使用了流式 ASR，直接调用 `finish()` 等待结果
2. 如果流式 ASR 失败或未启用，降级到原批量处理方式
3. 保证系统稳定性

```typescript
// 优先使用流式 ASR 结果
if (session.streamingASR) {
  text = await session.streamingASR.finish();
}
// 降级方案
if (!text.trim()) {
  const wavBuffer = this.decodeOpusChunksToWav(session);
  text = await this.asrService.transcribeWav(wavBuffer, asrOptions);
}
```

## 技术细节

### 音频队列机制

流式 ASR 类内部实现了音频队列：

```typescript
class AliyunStreamingASR {
  private audioQueue: Buffer[] = [];
  private taskStarted = false;

  pushAudio(pcmChunk: Buffer): void {
    this.audioQueue.push(pcmChunk); // 先入队
    if (this.taskStarted) {
      this.processQueue(); // 连接建立后才发送
    }
  }
}
```

**关键点**：

- 音频块先入队列，不会丢失
- WebSocket 连接建立后自动开始处理队列
- 控制发送速率（每 50ms 发送一个块），避免过快

### 降级方案

如果流式 ASR 出现问题，系统会自动降级：

1. **流式 ASR 启动失败**：记录错误，但继续缓存音频块
2. **流式 ASR 识别失败**：在 `handleAudioEnd` 时使用原批量处理方式
3. **非阿里云 ASR**：完全使用原批量处理方式

这确保了系统的稳定性和向后兼容。

## 性能提升

### 延迟对比

**优化前的时间线**：

```
[音频开始] -------- [收集音频块] -------- [音频结束]
                                              ↓
                                         [连接 ASR]
                                              ↓
                                         [发送全部音频]
                                              ↓
                                         [等待结果]
                                              ↓
                                         [返回文本]
总延迟 = 音频时长 + 连接时间 + 传输时间 + 识别时间
```

**优化后的时间线**：

```
[音频开始] -------- [收集音频块] -------- [音频结束]
     ↓                  ↓                      ↓
[连接 ASR]         [边收边发]            [等待最后结果]
                                              ↓
                                         [返回文本]
总延迟 = 连接时间（与音频时长重叠） + 识别时间
```

**预期提升**：

- 对于 3 秒音频：延迟减少约 2-3 秒
- 对于 5 秒音频：延迟减少约 4-5 秒
- 对于 10 秒音频：延迟减少约 9-10 秒

## 适用范围

优化仅对**阿里云 ASR** 生效：

- 全局配置 `ASR_PROVIDER=aliyun` 时自动启用
- 角色配置 `asr_provider: 'aliyun'` 时自动启用
- 其他 ASR 提供商（讯飞、OpenAI）保持原批量处理方式

## 配置要求

无需额外配置，只要已配置阿里云 ASR 即可：

```env
ASR_PROVIDER=aliyun
ALIYUN_ASR_API_KEY=sk-xxxxxxxxxxxxx
ALIYUN_ASR_MODEL=fun-asr-realtime
ALIYUN_ASR_BASE_URL=wss://dashscope.aliyuncs.com/api-ws/v1/inference
```

## 测试建议

### 1. 功能测试

```bash
# 重启服务
cd app/robot-cloud/后端
npm run dev
```

### 2. 验证流式处理

观察日志输出，应该看到：

```
[流式ASR] WebSocket 连接成功
[流式ASR] 已发送开始消息
[流式ASR] 任务已启动，开始处理队列
[流式ASR] 音频块入队，队列长度: 1 chunk大小: 640
[流式ASR] 发送音频块，大小: 640 剩余队列: 0
[流式ASR] 识别结果: 你好
[流式ASR] 任务完成，最终文本: 你好机器狗
```

### 3. 性能测试

使用机器狗发送不同长度的音频，记录：

- ASR 总耗时
- 识别准确率
- 是否有丢包或错误

### 4. 降级测试

1. 配置错误的 API Key，验证降级到批量处理
2. 网络断开时发送音频，验证错误处理
3. 切换到讯飞 ASR，验证原流程正常工作

## 注意事项

1. **网络延迟影响**：如果到阿里云的网络延迟很高，流式处理的优势会减少
2. **资源消耗**：流式处理会为每个音频会话保持一个 WebSocket 连接
3. **音频格式**：当前支持 Opus -> PCM 解码，其他格式需要扩展
4. **并发限制**：注意阿里云 ASR 的并发连接限制

## 后续优化方向

1. **连接池**：复用 WebSocket 连接，减少连接开销
2. **预连接**：在语音唤醒时就建立连接，进一步减少延迟
3. **部分结果**：利用阿里云的中间结果，实现更实时的反馈
4. **其他 ASR**：为讯飞等其他支持流式的 ASR 也实现类似优化

## 相关代码文件

- `app/robot-cloud/后端/src/modules/机器人交互/aliyun-streaming-asr.ts` - 流式 ASR 类
- `app/robot-cloud/后端/src/modules/websocket/service.ts` - WebSocket 服务（音频处理部分）
- `app/robot-cloud/后端/src/modules/机器人交互/asr-service.ts` - 原 ASR 服务（降级使用）

---

**优化完成时间**: 2026-02-09
**优化人员**: GitHub Copilot
