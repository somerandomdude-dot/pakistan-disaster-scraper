import pytest
from datetime import datetime, timezone, timedelta
from app.services.alert_time import (
    get_effective_alert_timestamp,
    compute_rolling_cutoff,
    format_pakistan_window_label,
    is_valid_pakistan_coordinate,
    parse_datetime_safe,
    PKT_TIMEZONE,
)


def test_parse_datetime_safe():
    # ISO string
    dt = parse_datetime_safe("2026-08-02T11:00:00Z")
    assert dt == datetime(2026, 8, 2, 11, 0, 0, tzinfo=timezone.utc)

    # Naive datetime
    naive = datetime(2026, 8, 2, 11, 0, 0)
    dt2 = parse_datetime_safe(naive)
    assert dt2 == datetime(2026, 8, 2, 11, 0, 0, tzinfo=timezone.utc)

    # Invalid input
    assert parse_datetime_safe("invalid-date") is None
    assert parse_datetime_safe(None) is None


def test_is_valid_pakistan_coordinate():
    # Islamabad
    assert is_valid_pakistan_coordinate(33.6844, 73.0479) is True
    # Karachi
    assert is_valid_pakistan_coordinate(24.8607, 67.0011) is True
    # Null Island (0,0)
    assert is_valid_pakistan_coordinate(0, 0) is False
    # London (outside Pakistan)
    assert is_valid_pakistan_coordinate(51.5074, -0.1278) is False
    # None or string error
    assert is_valid_pakistan_coordinate(None, 73.0) is False
    assert is_valid_pakistan_coordinate("abc", 73.0) is False


def test_get_effective_alert_timestamp_priority():
    # Priority: issued_at > starts_at > retrieved_at > created_at (updated_at ignored)
    data = {
        "issued_at": datetime(2026, 8, 1, 10, 0, 0, tzinfo=timezone.utc),
        "starts_at": datetime(2026, 7, 30, 10, 0, 0, tzinfo=timezone.utc),
        "created_at": datetime(2026, 7, 28, 10, 0, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 8, 2, 10, 0, 0, tzinfo=timezone.utc), # Stale update
    }
    eff_dt = get_effective_alert_timestamp(data)
    assert eff_dt == datetime(2026, 8, 1, 10, 0, 0, tzinfo=timezone.utc)


def test_get_effective_alert_timestamp_fallback():
    # Missing issued_at -> falls back to starts_at
    data = {
        "starts_at": datetime(2026, 7, 30, 8, 0, 0, tzinfo=timezone.utc),
        "created_at": datetime(2026, 7, 28, 8, 0, 0, tzinfo=timezone.utc),
        "updated_at": datetime(2026, 8, 2, 8, 0, 0, tzinfo=timezone.utc),
    }
    eff_dt = get_effective_alert_timestamp(data)
    assert eff_dt == datetime(2026, 7, 30, 8, 0, 0, tzinfo=timezone.utc)


def test_compute_rolling_cutoff_168_hours():
    ref_time = datetime(2026, 8, 2, 11, 0, 0, tzinfo=timezone.utc) # 16:00 PKT
    cutoff, max_future = compute_rolling_cutoff(reference_time=ref_time, days=7)

    # 7 days = 168 hours
    expected_cutoff = ref_time - timedelta(days=7)
    expected_max = ref_time + timedelta(minutes=15)

    assert cutoff == expected_cutoff
    assert max_future == expected_max
    assert (ref_time - cutoff).total_seconds() == 7 * 24 * 3600


def test_format_pakistan_window_label():
    ref_time = datetime(2026, 8, 2, 11, 0, 0, tzinfo=timezone.utc) # 16:00 PKT
    label = format_pakistan_window_label(reference_time=ref_time, days=7)
    assert "PKT" in label
    assert "26 Jul 2026" in label
    assert "2 Aug 2026" in label
