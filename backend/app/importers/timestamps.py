from __future__ import annotations

from datetime import datetime, timezone
from typing import Any


def to_naive_utc(dt: datetime) -> datetime:
    """Store timestamps as naive UTC, matching the naive DateTime columns."""
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def parse_unix_timestamp(value: int | float) -> datetime | None:
    try:
        seconds = float(value)
        if seconds > 1e12:  # milliseconds
            seconds /= 1000
        return datetime.fromtimestamp(seconds, tz=timezone.utc).replace(tzinfo=None)
    except (OverflowError, OSError, TypeError, ValueError):
        return None


def parse_flexible_timestamp(timestamp: Any) -> datetime | None:
    """Parse ISO-8601, offset-aware, and Unix timestamps into naive UTC."""
    if timestamp is None or timestamp is False:
        return None
    if isinstance(timestamp, datetime):
        return to_naive_utc(timestamp)
    if isinstance(timestamp, (int, float)):
        return parse_unix_timestamp(timestamp)
    if not isinstance(timestamp, str):
        return None

    text = timestamp.strip()
    if not text:
        return None

    text = text.replace("Z", "+00:00")
    try:
        return to_naive_utc(datetime.fromisoformat(text))
    except ValueError:
        pass

    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text.split("+")[0], fmt)
        except ValueError:
            continue

    return None
