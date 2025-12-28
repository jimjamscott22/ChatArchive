from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_chatgpt_export(payload: Any) -> list[dict[str, Any]]:
    conversations = None
    if isinstance(payload, dict):
        conversations = payload.get("conversations")
    elif isinstance(payload, list):
        conversations = payload

    if conversations is None:
        raise ValueError("Unrecognized ChatGPT export format")

    parsed = []
    for item in conversations:
        title = item.get("title")
        created_at = item.get("create_time")
        created_dt = None
        if created_at is not None:
            try:
                created_dt = datetime.fromtimestamp(created_at)
            except (OSError, TypeError, ValueError):
                created_dt = None
        parsed.append(
            {
                "source": "chatgpt",
                "title": title,
                "created_at": created_dt,
                "raw_json": json.dumps(item),
            }
        )
    return parsed
