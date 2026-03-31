import json
import os
from typing import Any

from dotenv import load_dotenv
from openai import OpenAI

from prompts import 系统提示词


def 创建客户端() -> OpenAI:
    load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise ValueError("未找到 OPENAI_API_KEY，请先配置 .env")

    base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").strip()
    return OpenAI(api_key=api_key, base_url=base_url)


def 获取模型名() -> str:
    return os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip()


def 解析动作(text: str) -> dict[str, Any]:
    client = 创建客户端()
    response = client.chat.completions.create(
        model=获取模型名(),
        temperature=0,
        messages=[
            {"role": "system", "content": 系统提示词},
            {"role": "user", "content": text},
        ],
    )
    content = response.choices[0].message.content or ""
    return json.loads(content)
