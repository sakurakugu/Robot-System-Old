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