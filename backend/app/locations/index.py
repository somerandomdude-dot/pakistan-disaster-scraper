from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

import msgpack
import zstandard as zstd

from app.locations.normalization import normalize_location_name, normalize_text


RUNTIME_INDEX_PATH = Path(__file__).resolve().parents[1] / "data/generated/pakistan_locations.msgpack.zst"
SHORT_VERIFIED_ALIASES = {"kp", "gb", "pb", "pmd", "ndma", "ffd", "isb", "lhr", "khi", "kpk", "ict", "ajk"}


@dataclass(frozen=True, slots=True)
class LocationEntity:
    numeric_id: int
    entity_type: str
    canonical_name: str
    province_id: int | None
    district_id: int | None
    tehsil_id: int | None
    division_id: int | None
    parent_id: int | None
    latitude: float | None
    longitude: float | None
    population_rounded_thousands: int | None
    normalized_name: str
    location_id: str


@dataclass(frozen=True, slots=True)
class IndexMatch:
    entity: LocationEntity
    matched_text: str
    start_offset: int
    end_offset: int
    match_method: str


class LocationIndex:
    """Read-only, startup-loaded access layer over the compact runtime arrays."""

    def __init__(self, payload: dict[str, Any], load_time_ms: float):
        self.dataset_version: str = payload["dataset_version"]
        self.load_time_ms = load_time_ms
        self.entity_types: list[str] = payload["entity_types"]
        self.patterns: list[str] = payload["patterns"]
        self.pattern_candidates: list[list[int]] = payload["pattern_candidates"]
        self.pattern_methods: list[list[int]] = payload["pattern_methods"]
        self.automaton: list[list[Any]] = payload["automaton"]
        self.locations: dict[int, LocationEntity] = {}
        self.location_ids: dict[str, int] = {}
        for row in payload["locations"]:
            entity = LocationEntity(
                numeric_id=row[0],
                entity_type=self.entity_types[row[1] - 1],
                canonical_name=row[2],
                province_id=row[3],
                district_id=row[4],
                tehsil_id=row[5],
                division_id=row[6],
                parent_id=row[7],
                latitude=row[8],
                longitude=row[9],
                population_rounded_thousands=row[10],
                normalized_name=row[11],
                location_id=row[12],
            )
            self.locations[entity.numeric_id] = entity
            self.location_ids[entity.location_id] = entity.numeric_id
        self.exact_lookup: dict[str, list[int]] = {
            pattern: candidates
            for pattern, candidates in zip(self.patterns, self.pattern_candidates)
        }
        self.city_to_district = {
            entity.numeric_id: entity.district_id
            for entity in self.locations.values()
            if entity.entity_type in {"CITY", "TOWN", "VILLAGE", "LOCALITY"} and entity.district_id
        }
        self.city_to_province = {
            entity.numeric_id: entity.province_id
            for entity in self.locations.values()
            if entity.entity_type in {"CITY", "TOWN", "VILLAGE", "LOCALITY"} and entity.province_id
        }
        self.tehsil_to_district = {
            entity.numeric_id: entity.district_id
            for entity in self.locations.values()
            if entity.entity_type == "TEHSIL" and entity.district_id
        }
        self.district_to_province = {
            entity.numeric_id: entity.province_id
            for entity in self.locations.values()
            if entity.entity_type == "DISTRICT" and entity.province_id
        }
        self.division_to_province = {
            entity.numeric_id: entity.province_id
            for entity in self.locations.values()
            if entity.entity_type == "DIVISION" and entity.province_id
        }

    @classmethod
    def load(cls, path: Path = RUNTIME_INDEX_PATH) -> "LocationIndex":
        started = time.perf_counter()
        compressed = path.read_bytes()
        unpacked = zstd.ZstdDecompressor().decompress(compressed)
        payload = msgpack.unpackb(unpacked, raw=False, strict_map_key=False)
        return cls(payload, (time.perf_counter() - started) * 1000)

    def entity(self, numeric_id: int | None) -> LocationEntity | None:
        return self.locations.get(numeric_id) if numeric_id else None

    def parent_names(self, entity: LocationEntity) -> tuple[str | None, str | None, str | None]:
        district = self.entity(entity.district_id)
        province = self.entity(entity.province_id)
        tehsil = self.entity(entity.tehsil_id)
        return (
            district.canonical_name if district else None,
            province.canonical_name if province else None,
            tehsil.canonical_name if tehsil else None,
        )

    def lookup(self, value: str, preferred_types: set[str] | None = None) -> LocationEntity | None:
        normalized = normalize_location_name(value)
        candidates = self.exact_lookup.get(normalized, [])
        return self._select_candidate(candidates, normalized, 0, preferred_types)

    def scan(self, text: str) -> list[IndexMatch]:
        normalized = normalize_text(text)
        if not normalized:
            return []
        state = 0
        matches: list[IndexMatch] = []
        seen: set[tuple[int, int, int]] = set()
        for end, char in enumerate(normalized):
            while state and char not in self.automaton[state][0]:
                state = self.automaton[state][1]
            state = self.automaton[state][0].get(char, 0)
            for pattern_id in self.automaton[state][2]:
                pattern = self.patterns[pattern_id]
                start = end - len(pattern) + 1
                if start < 0 or not self._word_boundaries(normalized, start, end + 1):
                    continue
                if len(pattern) < 3 and pattern not in SHORT_VERIFIED_ALIASES:
                    continue
                preferred = self._context_types(normalized, start, end + 1)
                candidate = self._select_candidate(
                    self.pattern_candidates[pattern_id],
                    pattern,
                    start,
                    preferred,
                )
                if candidate is None or not self._safe_text_candidate(candidate, pattern):
                    continue
                key = (candidate.numeric_id, start, end + 1)
                if key in seen:
                    continue
                seen.add(key)
                candidate_ids = self.pattern_candidates[pattern_id]
                candidate_index = candidate_ids.index(candidate.numeric_id)
                method_id = self.pattern_methods[pattern_id][candidate_index]
                matches.append(IndexMatch(
                    entity=candidate,
                    matched_text=normalized[start:end + 1],
                    start_offset=start,
                    end_offset=end + 1,
                    match_method="EXACT_CANONICAL" if method_id == 1 else "EXACT_ALIAS",
                ))
        return self._remove_contained_matches(matches)

    @staticmethod
    def _word_boundaries(text: str, start: int, end: int) -> bool:
        before_ok = start == 0 or not text[start - 1].isalnum()
        after_ok = end == len(text) or not text[end].isalnum()
        return before_ok and after_ok

    @staticmethod
    def _context_types(text: str, start: int, end: int) -> set[str] | None:
        context = text[max(0, start - 16):start].strip()
        suffix = text[end:end + 16].strip()
        if context.endswith(("district", "distt", "zila")) or suffix.startswith(
            ("district", "distt", "zila")
        ):
            return {"DISTRICT"}
        if context.endswith("tehsil"):
            return {"TEHSIL"}
        if context.endswith(("province", "territory")):
            return {"PROVINCE", "TERRITORY"}
        if context.endswith("division"):
            return {"DIVISION"}
        return None

    def _select_candidate(
        self,
        candidate_ids: Iterable[int],
        pattern: str,
        start_offset: int,
        preferred_types: set[str] | None = None,
    ) -> LocationEntity | None:
        candidates = [self.locations[item] for item in candidate_ids if item in self.locations]
        if preferred_types:
            preferred = [item for item in candidates if item.entity_type in preferred_types]
            if preferred:
                candidates = preferred
        type_priority = {
            "GOVERNMENT_AGENCY": 100, "ISSUING_OFFICE": 99, "WEATHER_OFFICE": 98,
            "CITY": 90, "TOWN": 85, "TEHSIL": 80, "DISTRICT": 75,
            "PROVINCE": 70, "TERRITORY": 70, "VILLAGE": 50, "LOCALITY": 45,
            "RIVER": 40, "DAM": 40, "BARRAGE": 40, "REGION": 30,
            "COASTAL_AREA": 30, "COUNTRY": 97, "DIVISION": 20, "UNKNOWN": 0,
        }
        if not candidates:
            return None
        return max(
            candidates,
            key=lambda item: (
                type_priority.get(item.entity_type, 0),
                item.population_rounded_thousands or -1,
                -item.numeric_id,
            ),
        )

    @staticmethod
    def _safe_text_candidate(entity: LocationEntity, pattern: str) -> bool:
        words = pattern.split()
        if entity.entity_type in {"VILLAGE", "LOCALITY"} and len(words) == 1 and len(pattern) < 6:
            return False
        if entity.entity_type == "UNKNOWN":
            return False
        return True

    @staticmethod
    def _remove_contained_matches(matches: list[IndexMatch]) -> list[IndexMatch]:
        ordered = sorted(matches, key=lambda item: (item.start_offset, -(item.end_offset - item.start_offset)))
        result: list[IndexMatch] = []
        for match in ordered:
            if any(
                match.start_offset >= existing.start_offset
                and match.end_offset <= existing.end_offset
                and match.entity.numeric_id != existing.entity.numeric_id
                for existing in result
            ):
                continue
            result.append(match)
        return result


@lru_cache(maxsize=1)
def get_location_index() -> LocationIndex:
    return LocationIndex.load()


def warm_location_index() -> LocationIndex:
    return get_location_index()
