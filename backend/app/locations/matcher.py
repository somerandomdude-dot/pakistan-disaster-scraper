from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from typing import Any, Iterable

from app.locations.index import IndexMatch, LocationEntity, LocationIndex, get_location_index


EXTRACTION_ALGORITHM_VERSION = "typed-aho-1"
IGNORED_TYPES = {"COUNTRY", "ISSUING_OFFICE", "GOVERNMENT_AGENCY", "WEATHER_OFFICE"}
COLLECTION_BY_TYPE = {
    "CITY": "cities", "TOWN": "cities", "VILLAGE": "cities", "LOCALITY": "cities",
    "TEHSIL": "tehsils", "DISTRICT": "districts", "DIVISION": "divisions",
    "PROVINCE": "provinces", "TERRITORY": "provinces", "REGION": "geographic_features",
    "RIVER": "geographic_features", "DAM": "geographic_features",
    "BARRAGE": "geographic_features", "COASTAL_AREA": "geographic_features",
}
EVIDENCE_WEIGHTS = {
    "STRUCTURED_SCRAPER_FIELD": 100,
    "TITLE": 80,
    "DESCRIPTION": 60,
    "SAFETY_INSTRUCTIONS": 40,
    "RAW_TEXT": 20,
}


@dataclass(slots=True)
class LocationMention:
    location_id: str
    canonical_name: str
    entity_type: str
    matched_text: str
    start_offset: int
    end_offset: int
    text_source: str
    district: str | None
    province: str | None
    tehsil: str | None
    latitude: float | None
    longitude: float | None
    confidence: float
    match_method: str
    evidence_score: int
    derived_from: str | None = None


class TypedLocationMatcher:
    def __init__(self, index: LocationIndex | None = None):
        self.index = index or get_location_index()
        self.dataset_version = self.index.dataset_version
        self.algorithm_version = EXTRACTION_ALGORITHM_VERSION

    def cache_key(self, content_hash: str) -> str:
        raw = f"{content_hash}:{self.dataset_version}:{self.algorithm_version}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    def extract(
        self,
        *,
        structured_locations: Iterable[Any] = (),
        title: str = "",
        description: str = "",
        safety_instructions: str = "",
        raw_text: str = "",
    ) -> dict[str, Any]:
        mentions: list[LocationMention] = []
        unresolved: list[dict[str, Any]] = []
        for location in structured_locations:
            raw_location = getattr(location, "raw_location", "") or ""
            entity = self.index.lookup(raw_location)
            if entity:
                mentions.append(self._mention(
                    entity,
                    matched_text=raw_location,
                    start_offset=0,
                    end_offset=len(raw_location),
                    text_source="STRUCTURED_SCRAPER_FIELD",
                    match_method=(
                        "EXACT_CANONICAL"
                        if entity.normalized_name == raw_location.strip().casefold()
                        else "NORMALISED_EXACT"
                    ),
                ))
            elif raw_location:
                unresolved.append({
                    "matched_text": raw_location,
                    "text_source": "STRUCTURED_SCRAPER_FIELD",
                    "reason": "No deterministic typed index match",
                })

        sources = (
            ("TITLE", title),
            ("DESCRIPTION", description),
            ("SAFETY_INSTRUCTIONS", safety_instructions),
            ("RAW_TEXT", raw_text),
        )
        for text_source, text in sources:
            for match in self.index.scan(text or ""):
                mentions.append(self._from_index_match(match, text_source))

        deduplicated: dict[str, LocationMention] = {}
        ignored: dict[str, LocationMention] = {}
        for mention in mentions:
            target = ignored if mention.entity_type in IGNORED_TYPES else deduplicated
            existing = target.get(mention.location_id)
            if existing is None or mention.evidence_score > existing.evidence_score:
                target[mention.location_id] = mention

        result: dict[str, Any] = {
            "cities": [], "tehsils": [], "districts": [], "divisions": [],
            "provinces": [], "geographic_features": [],
            "ignored_entities": [asdict(item) for item in ignored.values()],
            "unresolved_matches": unresolved,
            "mentions": [asdict(item) for item in mentions],
            "dataset_version": self.dataset_version,
            "algorithm_version": self.algorithm_version,
        }
        for mention in deduplicated.values():
            collection = COLLECTION_BY_TYPE.get(mention.entity_type)
            if collection:
                result[collection].append(asdict(mention))
        self._add_resolved_parents(result)
        for key in ("cities", "tehsils", "districts", "divisions", "provinces", "geographic_features"):
            result[key] = sorted(
                {item["location_id"]: item for item in result[key]}.values(),
                key=lambda item: (-item["evidence_score"], item["canonical_name"]),
            )
        return result

    def _mention(
        self,
        entity: LocationEntity,
        *,
        matched_text: str,
        start_offset: int,
        end_offset: int,
        text_source: str,
        match_method: str,
        derived_from: str | None = None,
    ) -> LocationMention:
        district, province, tehsil = self.index.parent_names(entity)
        evidence_score = EVIDENCE_WEIGHTS[text_source]
        confidence = 1.0 if match_method in {"EXACT_CANONICAL", "EXACT_ALIAS"} else 0.95
        return LocationMention(
            location_id=entity.location_id,
            canonical_name=entity.canonical_name,
            entity_type=entity.entity_type,
            matched_text=matched_text,
            start_offset=start_offset,
            end_offset=end_offset,
            text_source=text_source,
            district=district,
            province=province,
            tehsil=tehsil,
            latitude=entity.latitude,
            longitude=entity.longitude,
            confidence=confidence,
            match_method=match_method,
            evidence_score=evidence_score,
            derived_from=derived_from,
        )

    def _from_index_match(self, match: IndexMatch, text_source: str) -> LocationMention:
        return self._mention(
            match.entity,
            matched_text=match.matched_text,
            start_offset=match.start_offset,
            end_offset=match.end_offset,
            text_source=text_source,
            match_method=match.match_method,
        )

    def _add_resolved_parents(self, result: dict[str, Any]) -> None:
        existing = {
            item["location_id"]
            for key in ("districts", "provinces")
            for item in result[key]
        }
        for city in list(result["cities"]) + list(result["tehsils"]):
            numeric_id = self.index.location_ids.get(city["location_id"])
            entity = self.index.entity(numeric_id)
            if not entity:
                continue
            for parent_id, collection in (
                (entity.district_id, "districts"),
                (entity.province_id, "provinces"),
            ):
                parent = self.index.entity(parent_id)
                if not parent or parent.location_id in existing:
                    continue
                derived = self._mention(
                    parent,
                    matched_text=city["matched_text"],
                    start_offset=city["start_offset"],
                    end_offset=city["end_offset"],
                    text_source=city["text_source"],
                    match_method="TOKEN_MATCH",
                    derived_from=city["location_id"],
                )
                result[collection].append(asdict(derived))
                existing.add(parent.location_id)

    @staticmethod
    def compact_json(result: dict[str, Any]) -> str:
        return json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True)

