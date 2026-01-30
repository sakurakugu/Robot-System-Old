import sys
import json
import asyncio
import base64
import edge_tts


def 输出(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def 添加百分比后缀(n: int) -> str:
    s = int(n)
    return f"{'+' if s >= 0 else ''}{s}%"


def 添加Hz后缀(n: int) -> str:
    s = int(n)
    return f"{'+' if s >= 0 else ''}{s}Hz"


async def 处理请求(payload):
    req_id = payload.get("id") or ""
    text = payload.get("text", "")
    voice = payload.get("voice", "zh-CN-XiaoxiaoNeural")
    speed = payload.get("speed", 0)
    pitch = payload.get("pitch", 0)
    volume = payload.get("volume", 0)

    rate_opt = 添加百分比后缀(speed)
    pitch_opt = 添加Hz后缀(pitch)
    volume_opt = 添加百分比后缀(volume)

    communicate = edge_tts.Communicate(
        text,
        voice=voice,
        rate=rate_opt,
        pitch=pitch_opt,
        volume=volume_opt,
    )

    输出({"type": "start", "id": req_id, "format": "mp3"})

    seq = 0
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            seq += 1
            base64_audio = base64.b64encode(chunk["data"]).decode("ascii")
            输出({"type": "chunk", "id": req_id, "seq": seq, "data": base64_audio})

    输出({"type": "end", "id": req_id, "duration": 0, "format": "mp3"})


async def main():
    while True:
        line = await asyncio.to_thread(sys.stdin.readline)
        if not line:
            break
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
        except Exception as e:
            输出({"type": "error", "id": "", "message": str(e)})
            continue
        try:
            await 处理请求(payload)
        except Exception as e:
            输出({"type": "error", "id": payload.get("id") or "", "message": str(e)})


if __name__ == "__main__":
    asyncio.run(main())
