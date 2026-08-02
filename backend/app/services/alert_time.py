import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Callable, Optional
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

PKT_TIMEZONE = ZoneInfo("Asia/Karachi")
DEFAULT_CLOCK_SKEW_TOLERANCE = timedelta(minutes=15)
DEFAULT_ROLLING_WINDOW_DAYS = 7

PAKISTAN_LAT_MIN = 23.0
PAKISTAN_LAT_MAX = 38.0
PAKISTAN_LNG_MIN = 60.0
PAKISTAN_LNG_MAX = 78.5


def is_valid_pakistan_coordinate(latitude: Any, longitude: Any) -> bool:
    """Validate latitude and longitude are finite numbers inside Pakistan's boundary box and not (0,0)."""
    try:
        if latitude is None or longitude is None:
            return False
        lat = float(latitude)
        lng = float(longitude)
        if lat == 0.0 and lng == 0.0:
            return False
        return (
            PAKISTAN_LAT_MIN <= lat <= PAKISTAN_LAT_MAX
            and PAKISTAN_LNG_MIN <= lng <= PAKISTAN_LNG_MAX
        )
    except (ValueError, TypeError):
        return False


def parse_datetime_safe(value: Any) -> Optional[datetime]:
    """Safely parse a datetime object or ISO-8601 string into a UTC-aware datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(value, tz=timezone.utc)
        except Exception:
            return None
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned:
            return None
        try:
            # Handle standard ISO formats, including with Z suffix
            normalized = cleaned.replace("Z", "+00:00")
            dt = datetime.fromisoformat(normalized)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except Exception:
            try:
                from dateutil import parser
                dt = parser.parse(cleaned)
                if dt.tzinfo is None:
                    return dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(timezone.utc)
            except Exception:
                return None
    return None


def get_effective_alert_timestamp(
    alert: Any,
    custom_logger: Optional[logging.Logger] = None,
) -> Optional[datetime]:
    """
    Determine the primary effective event timestamp for an alert using strict priority:
    1. issued_at
    2. starts_at
    3. retrieved_at
    4. created_at

    CRITICAL RULE: updated_at MUST NEVER be used as the primary date,
    ensuring editing an old alert cannot make it appear recent again.
    """
    log = custom_logger or logger

    def _get_val(field: str) -> Any:
        if isinstance(alert, dict):
            return alert.get(field)
        return getattr(alert, field, None)

    # 1. issued_at
    issued_at = parse_datetime_safe(_get_val("issued_at"))
    if issued_at is not None:
        return issued_at

    # 2. starts_at
    starts_at = parse_datetime_safe(_get_val("starts_at"))
    if starts_at is not None:
        return starts_at

    # 3. retrieved_at
    retrieved_at = parse_datetime_safe(_get_val("retrieved_at"))
    if retrieved_at is not None:
        return retrieved_at

    # 4. created_at
    created_at = parse_datetime_safe(_get_val("created_at"))
    if created_at is not None:
        return created_at

    alert_id = _get_val("id") or _get_val("source_alert_id") or "unknown"
    log.warning(
        "Alert %s has no valid timestamp (checked issued_at, starts_at, retrieved_at, created_at); excluded from map.",
        alert_id,
    )
    return None


def compute_rolling_cutoff(
    reference_time: Optional[datetime] = None,
    days: int = DEFAULT_ROLLING_WINDOW_DAYS,
    skew_tolerance: timedelta = DEFAULT_CLOCK_SKEW_TOLERANCE,
    time_provider: Optional[Callable[[], datetime]] = None,
) -> tuple[datetime, datetime]:
    """
    Computes rolling UTC time window for map alerts:
    (cutoff_utc, max_future_utc)

    Window is [current_utc_time - days, current_utc_time + skew_tolerance]
    """
    if reference_time is not None:
        now_utc = parse_datetime_safe(reference_time) or datetime.now(timezone.utc)
    elif time_provider is not None:
        now_utc = parse_datetime_safe(time_provider()) or datetime.now(timezone.utc)
    else:
        now_utc = datetime.now(timezone.utc)

    cutoff_utc = now_utc - timedelta(days=days)
    max_future_utc = now_utc + skew_tolerance
    return cutoff_utc, max_future_utc


def format_pakistan_time(dt: datetime) -> str:
    """Format UTC datetime into Pakistan Standard Time string (e.g., '2 Aug 2026, 4:00 PM PKT')."""
    utc_dt = parse_datetime_safe(dt)
    if not utc_dt:
        return ""
    pkt_dt = utc_dt.astimezone(PKT_TIMEZONE)
    return pkt_dt.strftime("%d %b %Y, %I:%M %p PKT").lstrip("0")


def format_pakistan_window_label(
    reference_time: Optional[datetime] = None,
    days: int = DEFAULT_ROLLING_WINDOW_DAYS,
) -> str:
    """Returns human-readable range string: e.g. '26 Jul 2026, 4:00 PM to 2 Aug 2026, 4:00 PM PKT'."""
    cutoff, now = compute_rolling_cutoff(reference_time, days=days)
    start_str = format_pakistan_time(cutoff).replace(" PKT", "")
    end_str = format_pakistan_time(now - DEFAULT_CLOCK_SKEW_TOLERANCE)
    return f"{start_str} to {end_str}"
