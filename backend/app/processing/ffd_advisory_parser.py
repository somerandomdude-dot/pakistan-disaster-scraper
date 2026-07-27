"""Deterministic parser for Flood Forecasting Division PDF text.

The original PDF extraction is preserved on the alert.  This module only
creates a structured, display-oriented representation from facts that are
explicitly present in that extracted text.
"""

from __future__ import annotations

import re
from typing import Any, Iterable


PARSER_NAME = "ffd-deterministic-v4"
FLOOD_LEVELS = (
    "Exceptionally High",
    "Very High",
    "Below Low",
    "High",
    "Medium",
    "Low",
)
RIVERS = ("Indus", "Kabul", "Jhelum", "Chenab", "Ravi", "Sutlej")
LEVEL_RANK = {
    "below low": 0,
    "low": 1,
    "medium": 2,
    "high": 3,
    "very high": 4,
    "exceptionally high": 5,
}


def _canonical_level(value: str) -> str:
    return _normalise(value).title().replace(" To ", " to ")


def severity_from_reported_level(advisory: dict[str, Any] | None) -> str:
    """Map an explicit current flood level to the dashboard severity scale."""
    level = (advisory or {}).get("highest_reported_level")
    if level in {"Exceptionally High", "Very High"}:
        return "critical"
    if level == "High":
        return "high"
    if level == "Medium":
        return "medium"
    if level in {"Low", "Below Low"}:
        return "low"
    return "unknown"


def _repair_mojibake(value: str) -> str:
    if not any(marker in value for marker in ("â€", "â†", "â‰", "â€™")):
        return value
    try:
        return value.encode("latin-1").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return value


def _normalise(value: str) -> str:
    return re.sub(r"\s+", " ", _repair_mojibake(value or "")).strip()


def _first_match(pattern: str, text: str, flags: int = re.IGNORECASE) -> str | None:
    match = re.search(pattern, text, flags)
    return _normalise(match.group(1)) if match else None


def _section(text: str, start: str, ends: Iterable[str]) -> str | None:
    start_match = re.search(start, text, re.IGNORECASE)
    if not start_match:
        return None
    tail = text[start_match.end() :]
    end_positions = []
    for end in ends:
        match = re.search(end, tail, re.IGNORECASE)
        if match:
            end_positions.append(match.start())
    value = tail[: min(end_positions)] if end_positions else tail
    value = _strip_repeated_administration(value)
    return _normalise(value) or None


def _strip_repeated_administration(value: str) -> str:
    value = re.sub(
        r"GOVERNMENT OF PAKISTAN MINISTRY OF DEFENCE.*?"
        r"Page\s+\d+\s+of\s+\d+",
        " ",
        value,
        flags=re.IGNORECASE | re.DOTALL,
    )
    return re.sub(r"\s+", " ", value).strip()


def _sentences(value: str | None) -> list[str]:
    if not value:
        return []
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z])", value)
    seen: set[str] = set()
    result = []
    for part in parts:
        sentence = _normalise(part).strip(" -")
        key = sentence.casefold()
        if sentence and key not in seen:
            seen.add(key)
            result.append(sentence)
    return result


def _river_conditions(text: str, context: str) -> list[dict[str, Any]]:
    glance = _section(
        text,
        r"Rivers\s+at\s+a\s+glance",
        (r"Flood\s+severity\s+scale", r"RAINFALL\s+FORECAST"),
    )
    rows: list[dict[str, Any]] = []
    seen: set[tuple[str, str | None]] = set()

    if glance:
        river_pattern = "|".join(RIVERS)
        matches = list(re.finditer(rf"\b({river_pattern})\b", glance, re.IGNORECASE))
        for index, match in enumerate(matches):
            river = match.group(1).title()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(glance)
            segment = glance[match.end() : end].strip()
            level_match = re.search(
                r"\b(Exceptionally\s+High|Very\s+High|Below\s+Low|High|Medium|Low)\b",
                segment,
                re.IGNORECASE,
            )
            if not level_match:
                continue
            level = _canonical_level(level_match.group(1))
            station_group = _first_match(r"\(([^)]+)\)", segment)
            stations = _split_stations(station_group) if station_group else [None]
            for station in stations:
                key = (river.casefold(), station.casefold() if station else None)
                if key in seen:
                    continue
                seen.add(key)
                trend, _ = _trend_and_note(river, station, context)
                rows.append(
                    {
                        "river": river,
                        "station": station,
                        "level": level,
                        "forecast_level": None,
                        "trend": trend,
                        "notes": None,
                        "current_inflow": None,
                        "current_outflow": None,
                    }
                )

    for condition in _hydrological_conditions(context):
        key = (
            condition["river"].casefold(),
            condition["station"].casefold(),
        )
        existing = next(
            (
                row
                for row in rows
                if (
                    row["river"].casefold(),
                    row["station"].casefold() if row["station"] else None,
                )
                == key
            ),
            None,
        )
        if existing:
            existing["level"] = condition["level"]
        else:
            trend, _ = _trend_and_note(
                condition["river"], condition["station"], context
            )
            condition.update(
                {
                    "forecast_level": None,
                    "trend": trend,
                    "notes": None,
                    "current_inflow": None,
                    "current_outflow": None,
                }
            )
            rows.append(condition)

    for forecast in _quantitative_forecasts(text):
        key = (forecast["river"].casefold(), forecast["station"].casefold())
        existing = next(
            (
                row
                for row in rows
                if row["station"]
                and (row["river"].casefold(), row["station"].casefold()) == key
            ),
            None,
        )
        if existing:
            existing["forecast_level"] = forecast["forecast_level"]
            existing["current_inflow"] = forecast["current_inflow"]
            existing["current_outflow"] = forecast["current_outflow"]
            if not existing["trend"]:
                existing["trend"] = forecast["trend"]
        else:
            rows.append(
                {
                    "river": forecast["river"],
                    "station": forecast["station"],
                    "level": None,
                    "forecast_level": forecast["forecast_level"],
                    "trend": forecast["trend"],
                    "notes": None,
                    "current_inflow": forecast["current_inflow"],
                    "current_outflow": forecast["current_outflow"],
                }
            )
    return rows


def _split_stations(value: str) -> list[str]:
    return [
        station.strip(" ,.;")
        for station in re.split(r"\s*(?:&|,|\band\b)\s*", value, flags=re.IGNORECASE)
        if station.strip(" ,.;")
    ]


def _hydrological_conditions(context: str) -> list[dict[str, Any]]:
    river_pattern = "|".join(RIVERS)
    conditions: list[dict[str, Any]] = []
    for sentence in _sentences(context):
        level_match = re.search(
            r"\b(Exceptionally\s+High|Very\s+High|Below\s+Low|High|Medium|Low)"
            r"\s+flood\s+level\b",
            sentence,
            re.IGNORECASE,
        )
        if not level_match:
            continue
        level = _canonical_level(level_match.group(1))
        fact_text = sentence[: level_match.start()]
        station_pattern = (
            rf"\bRiver\s+({river_pattern})\s+at\s+(.+?)"
            rf"(?=(?:,\s*|\s+and\s+)River\s+(?:{river_pattern})\s+at"
            r"|\s+(?:is|are)\s+in\b|$)"
        )
        for match in re.finditer(station_pattern, fact_text, re.IGNORECASE):
            river = match.group(1).title()
            for station in _split_stations(match.group(2)):
                conditions.append(
                    {
                        "river": river,
                        "station": station,
                        "level": level,
                        "notes": None,
                    }
                )
    return conditions


def _quantitative_forecasts(text: str) -> list[dict[str, Any]]:
    section = _section(
        text,
        r"\b4\.\s*QUANTITATIVE FLOOD FORECAST(?:\s+OF GAUGING STATIONS)?",
        (r"\bSpatial\s*:", r"\b5\.\s*HOW CLOSE IS EACH RIVER"),
    )
    if not section:
        return []
    section = re.sub(
        r"RIVERS\s+Stations\s+Actual Observations.*?Season\s+2026",
        " ",
        section,
        flags=re.IGNORECASE,
    )
    river_pattern = "|".join(RIVERS)
    row_pattern = re.compile(
        rf"\b({river_pattern})\s*([A-Za-z][A-Za-z.\s]*?)\s+"
        r"(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\b",
        re.IGNORECASE,
    )
    matches = list(row_pattern.finditer(section))
    forecasts: list[dict[str, Any]] = []
    for index, match in enumerate(matches):
        river = match.group(1).title()
        station = _normalise(match.group(2)).strip(" ,.;")
        if not station or len(station) > 40:
            continue
        end = matches[index + 1].start() if index + 1 < len(matches) else len(section)
        forecast_text = section[match.end() : end]
        level_match = re.search(
            r"\b("
            r"(?:Below\s+Low|Low|Medium|High|Very\s+High|Exceptionally\s+High)"
            r"(?:\s+to\s+(?:Low|Medium|High|Very\s+High|Exceptionally\s+High))?"
            r")\b",
            forecast_text,
            re.IGNORECASE,
        )
        if not level_match:
            continue
        before_level = forecast_text[: level_match.start()]
        if re.search(r"\bNo\s+sig(?:nificant)?\.?\s+change\b", before_level, re.IGNORECASE):
            trend = "No significant change"
        elif re.search(r"\bF\b", before_level):
            trend = "Decreasing"
        elif re.search(r"\bR\b", before_level):
            trend = "Increasing"
        else:
            trend = None
        forecasts.append(
            {
                "river": river,
                "station": station,
                "forecast_level": _canonical_level(level_match.group(1)),
                "trend": trend,
                "current_inflow": float(match.group(3)),
                "current_outflow": float(match.group(4)),
            }
        )
    return forecasts


def _trend_and_note(
    river: str, station: str | None, context: str
) -> tuple[str | None, str | None]:
    candidates = _sentences(context)
    specific = [
        sentence
        for sentence in candidates
        if (station and re.search(rf"\b{re.escape(station)}\b", sentence, re.IGNORECASE))
        or re.search(rf"\bRiver\s+{re.escape(river)}\b", sentence, re.IGNORECASE)
    ]
    for sentence in specific:
        if re.search(r"\b(decreas(?:e|ing)|fall(?:ing)?)\b", sentence, re.IGNORECASE):
            return "Decreasing", sentence
        if re.search(r"\b(increas(?:e|ing)|ris(?:e|ing))\b", sentence, re.IGNORECASE):
            return "Increasing", sentence
        if re.search(r"\bno\s+sig(?:nificant)?\.?\s+change\b", sentence, re.IGNORECASE):
            return "No significant change", sentence
    return None, None


def _warning_details(warning: str | None) -> dict[str, Any] | None:
    if not warning:
        return None
    timings = []
    for match in re.finditer(
        r"\b("
        r"up\s*to\s+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+"
        r"|within\s+(?:the\s+)?next\s+\d+(?:-\w+)?\s+hours?"
        r"|during\s+(?:the\s+)?next\s+\d+(?:-\w+)?\s+hours?"
        r")\b",
        warning,
        re.IGNORECASE,
    ):
        value = _normalise(match.group(1))
        if value.casefold() not in {item.casefold() for item in timings}:
            timings.append(value)

    rivers = [
        river
        for river in RIVERS
        if re.search(rf"\b{river}\b", warning, re.IGNORECASE)
    ]
    ranges = []
    for match in re.finditer(
        r"\b((?:Below\s+Low|Low|Medium|High|Very\s+High|Exceptionally\s+High)"
        r"(?:\s+to\s+(?:Low|Medium|High|Very\s+High|Exceptionally\s+High))?"
        r"\s+(?:flows?|flood\s+level))\b",
        warning,
        re.IGNORECASE,
    ):
        value = _normalise(match.group(1))
        if value.casefold() not in {item.casefold() for item in ranges}:
            ranges.append(value)

    return {
        "text": warning,
        "expected_timing": timings,
        "rivers": rivers,
        "expected_flood_ranges": ranges,
    }


def parse_ffd_advisory(
    raw_text: str | None, source_url: str | None = None
) -> dict[str, Any] | None:
    """Return structured FFD bulletin data, or ``None`` for unrelated text."""
    text = _normalise(raw_text or "")
    if not text or not re.search(
        r"\b(?:DAILY FLOOD BULLETIN|FLOOD FORECASTING DIVISION)\b",
        text,
        re.IGNORECASE,
    ):
        return None

    title = _first_match(
        r"\b((?:DAILY\s+)?FLOOD\s+BULLETIN)(?:\s+\d{1,2}-[A-Z]{3}-\d{4})?",
        text,
    )
    hydrological = _section(
        text,
        r"(?:I|1)\s*:\s*HYDROLOGICAL SITUATION"
        r"(?:\s+at\s+\d{4}\s+PST)?(?:\s+AND\s+OUTLOOK)?",
        (r"\bWARNING\s*:", r"\bII\s*:\s*METEOROLOGICAL FEATURES"),
    )
    warning = _section(
        text,
        r"\bWARNING\s*:",
        (
            r"GOVERNMENT OF PAKISTAN",
            r"\bII\s*:\s*METEOROLOGICAL FEATURES",
            r"\b2\.\s*WEEKLY WEATHER OUTLOOK",
        ),
    )
    forecast_24 = _section(
        text,
        r"\bIII\s*:\s*WEATHER FORECAST FOR 24-HOURS",
        (r"\bIV\s*:\s*WEATHER OUTLOOK FOR NEXT 48-HOURS", r"GOVERNMENT OF PAKISTAN"),
    )
    forecast_48 = _section(
        text,
        r"\bIV\s*:\s*WEATHER OUTLOOK FOR NEXT 48-HOURS",
        (r"GOVERNMENT OF PAKISTAN", r"\b2\.\s*WEEKLY WEATHER OUTLOOK"),
    )
    river_conditions = _river_conditions(
        text, " ".join(part for part in (hydrological, warning) if part)
    )

    metadata = {
        "number": _first_match(r"\bBULLETIN\s+No\s*:\s*([A-Z]?\s*\d+/\d+)", text),
        "issue_date": _first_match(r"\bDated\s*:\s*([^|]+?)\s+Time\s*:", text),
        "issue_time": _first_match(
            r"\bTime\s*:\s*([^|]+?)(?=\s+www\.|\s+Email\s*:|$)", text
        ),
        "page": _first_match(r"\bPage\s+(\d+\s+of\s+\d+)", text),
        "issuing_department": (
            "Flood Forecasting Division"
            if re.search(r"\bFLOOD FORECASTING DIVISION\b", text, re.IGNORECASE)
            else None
        ),
        "department": (
            "Pakistan Meteorological Department"
            if re.search(r"\bPAKISTAN METEOROLOGICAL DEPARTMENT\b", text, re.IGNORECASE)
            else None
        ),
        "division": (
            "Defence Division"
            if re.search(r"\bDEFENCE DIVISION\b", text, re.IGNORECASE)
            else None
        ),
        "office_address": _first_match(
            r"FLOOD FORECASTING DIVISION\s+(.+?)(?=\s+BULLETIN\s+No\s*:)", text
        ),
        "email": _first_match(r"\bEmail\s*:\s*([^\s|]+)", text),
        "telephone": _first_match(
            r"\bDuty Officer\s+24/7Hrs\s*:\s*([^|]+?)(?=\s+All rights|$)", text
        ),
    }
    metadata = {key: value for key, value in metadata.items() if value is not None}

    highest_level = None
    levels = [row["level"] for row in river_conditions if row.get("level")]
    if levels:
        highest_level = max(levels, key=lambda value: LEVEL_RANK[value.casefold()])

    structured_sections = sum(
        bool(value)
        for value in (river_conditions, forecast_24, forecast_48, hydrological, warning)
    )
    missing_sections = [
        label
        for label, value in (
            ("river conditions", river_conditions),
            ("24-hour rainfall forecast", forecast_24),
            ("hydrological situation", hydrological),
            ("warning", warning),
            ("bulletin metadata", metadata.get("number")),
        )
        if not value
    ]
    return {
        "parser_name": PARSER_NAME,
        "validation_status": (
            "structured"
            if structured_sections >= 3 and len(missing_sections) <= 1
            else "partial"
        ),
        "missing_sections": missing_sections,
        "title": title.title() if title else None,
        "advisory_type": title.title() if title else None,
        "highest_reported_level": highest_level,
        "bulletin": metadata,
        "river_conditions": river_conditions,
        "rainfall_forecast": {
            "next_24_hours": forecast_24,
            "next_48_hours": forecast_48,
        },
        "hydrological_summary": _sentences(hydrological),
        "warning": _warning_details(warning),
        "source": {
            "name": metadata.get("issuing_department"),
            "url": source_url,
            "department": metadata.get("department"),
            "document_type": "PDF",
        },
    }
