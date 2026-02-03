- 现在要改成如果摇杆的指令如果有下一个指令，上一个还没执行的话就直接吞掉
- 在操作页面新增“调试标记”的工具栏按钮，点击后会在当前位置新增一个标记，用于记录当前的各种信息，并在日志中做出明显的标记，后续可以通过标记来快速定位。该按钮可以在操作设置页面中关闭

- 支持在前端通过GUI修改机器人的配置

- 要支持ctrl+d的退出信号（机器狗端）

- 现在这个传输的是base64，之后要改成直接传输二进制数据(到时候先问问推荐将音频上传改成opus二进制数据传输吗)

```python
def 构建音频帧消息(
    robot_uuid: str,        # 机器人 UUID
    session_id: str,        # 会话 ID
    seq: int,               # 音频帧序号
    audio_bytes: bytes,     # 音频数据（Opus 编码）
    frame_duration_ms: int, # 音频帧持续时间（毫秒）
    sample_rate: int,       # 采样率（赫兹）
    channels: int,          # 声道数
) -> Dict[str, Any]:
    """ 构建音频帧消息 """
    return {
        "type": "audio_chunk",
        "robotId": robot_uuid,
        "timestamp": int(time.time() * 1000),
        "data": {
            "format": "opus",
            "sampleRate": sample_rate,
            "channels": channels,
            "frameDurationMs": frame_duration_ms,
            "sessionId": session_id,
            "seq": seq,
            "buffer": base64.b64encode(audio_bytes).decode("ascii"),
        },
    }
```

- 到时候ws连接改成一个端口，但是多个连接，像是配置之类的也要瘦身

1. 有声音识别不准（从实时转写改成一次性收集完再发送）
2. 收音太广（要降噪）
^ 改成了直接让大模型过滤无意义的词语

3. 视觉识别
4. 移植操作等页面到手机上
5. 改一下动作的提示词
6. sdk和遥控切换
8. 下面的bug
9. 走路速度等调整

新增5%的电量的时候，让机器狗趴下

[robot-cloud:backend] error: 音频处理失败 {"error":"Opus解码失败","robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c1dc9-6518-7637-ae11-823433de6a31","stack":"Error: Opus解码失败\n at WebSocketService.decodeOpusChunksToWav (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:875:13)\n at WebSocketService.handleAudioEnd (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:826:30)\n at WebSocketService.handleMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:258:22)\n at WebSocket.<anonymous> (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:174:12)\n at WebSocket.emit (node:events:508:28)\n at Receiver.receiverOnMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\websocket.js:1225:20)\n at Receiver.emit (node:events:508:28)\n at Receiver.dataMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:596:14)\n at Receiver.getData (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:496:10)\n at Receiver.startLoop (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:167:16)","timestamp":"2026-02-02T17:55:07"}
[robot-cloud:backend] error: 音频处理失败 {"error":"Opus解码失败","robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c1dc9-71a9-766b-928e-807ee4c8dd5e","stack":"Error: Opus解码失败\n at WebSocketService.decodeOpusChunksToWav (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:875:13)\n at WebSocketService.handleAudioEnd (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:826:30)\n at WebSocketService.handleMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:258:22)\n at WebSocket.<anonymous> (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:174:12)\n at WebSocket.emit (node:events:508:28)\n at Receiver.receiverOnMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\websocket.js:1225:20)\n at Receiver.emit (node:events:508:28)\n at Receiver.dataMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:596:14)\n at Receiver.getData (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:496:10)\n at Receiver.startLoop (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:167:16)","timestamp":"2026-02-02T17:55:09"}
[robot-cloud:backend] error: 音频处理失败 {"error":"Opus解码失败","robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c1dc9-7720-7a43-846a-ffdbe316e324","stack":"Error: Opus解码失败\n at WebSocketService.decodeOpusChunksToWav (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:875:13)\n at WebSocketService.handleAudioEnd (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:826:30)\n at WebSocketService.handleMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:258:22)\n at WebSocket.<anonymous> (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\src\\modules\\websocket\\service.ts:174:12)\n at WebSocket.emit (node:events:508:28)\n at Receiver.receiverOnMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\websocket.js:1225:20)\n at Receiver.emit (node:events:508:28)\n at Receiver.dataMessage (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:596:14)\n at Receiver.getData (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:496:10)\n at Receiver.startLoop (D:\\elric\\Code\\Repos\\robot-dog\\app\\robot-cloud\\后端\\node_modules\\ws\\lib\\receiver.js:167:16)","timestamp":"2026-02-02T17:55:11"}

3. （注意：动作"wave、shake_hand、dance"因安全原因无法执行） 还是会说出来

4. LLM调用失败: getaddrinfo ENOTFOUND dashscope.aliyuncs.com

5. 知识库
