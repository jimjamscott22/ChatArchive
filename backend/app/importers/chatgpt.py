from __future__ import annotations

import json
from datetime import datetime
from typing import Any


def parse_chatgpt_export(payload: dict[str, Any]) -> list[dict[str, Any]]:
    conversations = payload.get("conversations")
    if conversations is None:
        if isinstance(payload, list):
            conversations = payload
        else:
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
