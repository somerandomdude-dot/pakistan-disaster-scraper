import re
import unicodedata
from typing import Iterable


_DISTRICT_AFFIXES = (
    re.compile(r"^(?:district|distt?|zila)\s+", re.IGNORECASE),
    re.compile(r"\s+(?:district|distt?|zila)$", re.IGNORECASE),
)
_COMMON_EXPANSIONS = {
    "distt": "district",
    "dist": "district",
    "d g khan": "dera ghazi khan",
    "d i khan": "dera ismail khan",
}


def _fold(value: str) -> str:
    value = unicodedata.normalize("NFKC", value or "").casefold()
    value = value.replace("’", "'").replace("‘", "'").replace("`", "'")
    value = re.sub(r"[-‐‑‒–—_/]+", " ", value)
    value = re.sub(r"[^\w\s\u0600-\u06ff']+", " ", value, flags=re.UNICODE)
    value = value.replace("'", " ")
    return re.sub(r"\s+", " ", value).strip()


def normalize_text(value: str) -> str:
    """Normalize arbitrary advisory text without deleting semantic tokens."""
    return _fold(value)


def normalize_location_name(value: str) -> str:
    """Normalize a location or alias for deterministic exact lookup."""
    normalized = _fold(value)
    for pattern in _DISTRICT_AFFIXES:
        normalized = pattern.sub("", normalized).strip()
    normalized = _COMMON_EXPANSIONS.get(normalized, normalized)
    return re.sub(r"\s+", " ", normalized).strip()


def unique_normalized(values: Iterable[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        normalized = normalize_location_name(value)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result

