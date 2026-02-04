- 现在要改成如果摇杆的指令如果有下一个指令，上一个还没执行的话就直接吞掉
- 在操作页面新增“调试标记”的工具栏按钮，点击后会在当前位置新增一个标记，用于记录当前的各种信息，并在日志中做出明显的标记，后续可以通过标记来快速定位。该按钮可以在操作设置页面中关闭

- 支持在前端通过GUI修改机器人的配置（让服务器端可以调部分）

- 要支持ctrl+d的退出信号（机器狗端）

- 现在这个传输的是base64，之后要改成直接传输二进制数据(到时候先问问推荐将音频上传改成opus二进制数据传输吗)

- 1. 查看当前相机的最高画质，然后让camera改成使用rtsp的，使用纯gstreamer（硬解）获取视频流，然后查看是否是可以硬解
     需求：1. 获取图片，只要对话时需要图片时获取一张（就是拍照，实时性0.5秒内）2. 有可能要将rtsp://192.168.234.1:8554/test推流到服务器（原封不动）

- 让现在的qwen-flash作为判断是否要进行视觉识别，然后让其回复{{vision}}，然后把用户发过去的话+图片发送给视觉大模型

todo: 动作从发送速度和角速度改成发送 步数||米、角度

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
7. 下面的bug
8. 走路速度等调整

新增5%的电量的时候，让机器狗趴下

move动作参数说明：

- vx: 前后速度（-0.3到0.3，正数向前，负数向后）
- vy: 左右速度（-0.2到0.2，正数向左，负数向右）
- yaw_rate: 转向角速度（-0.5到0.5，正数左转，负数右转）
- duration: 持续时间（秒），建议1-3秒

这个转换成角度还有步数/米

[robot-cloud:backend] warn: Opus解码失败 {"robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c22f7-98f8-7fbf-85c8-2a606aa8a0d9","timestamp":"2026-02-03T18:03:52"}
[robot-cloud:backend] warn: Opus解码失败 {"robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c22f7-d652-72c1-afc4-7b022716b8e2","timestamp":"2026-02-03T18:04:02"}
[robot-cloud:backend] warn: Opus解码失败 {"robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c22f7-fef3-72e9-9c52-bafc825199b7","timestamp":"2026-02-03T18:04:08"}
[robot-cloud:backend] warn: Opus解码失败 {"robotId":"019c1c9f-a0fa-72fa-a622-af4ed28aa2b1","service":"robot-cloud","sessionId":"019c22f8-1fcb-7925-98fb-ceb3def634c9","timestamp":"2026-02-03T18:04:16"}

3. （注意：动作"wave、shake_hand、dance"因安全原因无法执行） 还是会说出来

4. LLM调用失败: getaddrinfo ENOTFOUND dashscope.aliyuncs.com

5. 知识库
