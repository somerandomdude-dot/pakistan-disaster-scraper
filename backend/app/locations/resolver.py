from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Iterable

from app.locations.index import (
    IndexMatch,
    LocationEntity,
    LocationIndex,
    RIVER_TO_PRIMARY_DISTRICTS,
    STATION_TO_DISTRICT,
    get_location_index,
    is_valid_pakistan_coords,
)


SEVERITY_LEVEL_RANK: dict[str, int] = {
    "exceptionally high": 5,
    "very high": 4,
    "high": 3,
    "medium": 2,
    "low": 1,
    "below low": 0,
}


@dataclass(slots=True)
class PrimaryLocation:
    district: str | None
    city: str | None
    province: str | None
    latitude: float | None
    longitude: float | None
    source: str  # STRUCTURED, TITLE_EXTRACTION, DESCRIPTION_EXTRACTION, RIVER_MAPPING, DISTRICT_POPULATION_FALLBACK, UNRESOLVED
    confidence: str  # HIGH, MEDIUM, LOW
    is_inferred: bool
    label: str  # Human-readable badge text
    method: str  # Explanatory rule details

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class LocationResolver:
    """Deterministic, prioritized location resolver for alerts and advisories.

    Priority Order:
    1. Structured scraper location data (highest priority, source-provided)
    2. Explicit district and city names in advisory title
    3. Explicit district and city names in advisory description (with deterministic tie-breaking)
    4. River / barrage / hydrological station mappings
    5. Fallback to most-populated city within genuine matched district
    6. Unresolved (never silently defaulting to Lahore or Karachi)
    """

    def __init__(self, index: LocationIndex | None = None):
        self.index = index or get_location_index()

    def resolve(
        self,
        *,
        structured_locations: Iterable[Any] = (),
        title: str = "",
        description: str = "",
        raw_text: str = "",
        structured_advisory: dict[str, Any] | None = None,
        extracted: dict[str, Any] | None = None,
    ) -> PrimaryLocation:
        # 1. Check structured scraper location data
        structured_result = self._resolve_structured(structured_locations)
        if structured_result is not None:
            return structured_result

        # 2. Check explicit title matches
        title_result = self._resolve_from_text(title, text_source="TITLE")
        if title_result is not None:
            return title_result

        # 3. Check explicit description matches with district grouping and tie-breaking
        description_result = self._resolve_from_description(
            description=description,
            raw_text=raw_text,
            structured_advisory=structured_advisory,
        )
        if description_result is not None:
            return description_result

        # 4. Check river / barrage / hydrological station mappings
        river_result = self._resolve_from_rivers_and_stations(
            description=description,
            raw_text=raw_text,
            structured_advisory=structured_advisory,
        )
        if river_result is not None:
            return river_result

        # 5. Unresolved (never invent coordinates or fall back to Lahore/Karachi)
        return PrimaryLocation(
            district=None,
            city=None,
            province=None,
            latitude=None,
            longitude=None,
            source="UNRESOLVED",
            confidence="LOW",
            is_inferred=False,
            label="Unresolved location",
            method="NO_DETERMINISTIC_MATCH",
        )

    def _resolve_structured(self, structured_locations: Iterable[Any]) -> PrimaryLocation | None:
        for loc in structured_locations:
            if isinstance(loc, dict):
                raw_location = (
                    loc.get("raw_location")
                    or loc.get("city")
                    or loc.get("district")
                    or ""
                ).strip()
                loc_lat = loc.get("latitude")
                loc_lng = loc.get("longitude")
                loc_district = loc.get("district")
                loc_city = loc.get("city")
                loc_province = loc.get("province")
            else:
                raw_location = (
                    getattr(loc, "raw_location", None)
                    or getattr(loc, "city", None)
                    or getattr(loc, "district", None)
                    or ""
                ).strip()
                loc_lat = getattr(loc, "latitude", None)
                loc_lng = getattr(loc, "longitude", None)
                loc_district = getattr(loc, "district", None)
                loc_city = getattr(loc, "city", None)
                loc_province = getattr(loc, "province", None)

            if raw_location:
                entity = self.index.lookup(raw_location)
                if entity:
                    if entity.entity_type in {"CITY", "TOWN", "VILLAGE", "LOCALITY"}:
                        district, province, _ = self.index.parent_names(entity)
                        lat, lng = self._validated_coords(loc_lat, loc_lng, entity.latitude, entity.longitude)
                        return PrimaryLocation(
                            district=district,
                            city=entity.canonical_name,
                            province=province,
                            latitude=lat,
                            longitude=lng,
                            source="STRUCTURED",
                            confidence="HIGH",
                            is_inferred=False,
                            label="Source-provided",
                            method="STRUCTURED_SCRAPER_CITY",
                        )
                    if entity.entity_type == "DISTRICT":
                        district = entity.canonical_name
                        _, province, _ = self.index.parent_names(entity)
                        top_city = self.index.get_district_top_city(entity.numeric_id)
                        city_name = (
                            top_city.canonical_name
                            if top_city and top_city.entity_type in {"CITY", "TOWN"}
                            else None
                        )
                        lat, lng = self._validated_coords(
                            loc_lat,
                            loc_lng,
                            top_city.latitude if top_city else entity.latitude,
                            top_city.longitude if top_city else entity.longitude,
                        )
                        return PrimaryLocation(
                            district=district,
                            city=city_name,
                            province=province,
                            latitude=lat,
                            longitude=lng,
                            source="STRUCTURED",
                            confidence="HIGH",
                            is_inferred=False,
                            label="Source-provided",
                            method="STRUCTURED_SCRAPER_DISTRICT",
                        )
                    if entity.entity_type in {"PROVINCE", "TERRITORY"}:
                        # Check if coordinates provided with province
                        if is_valid_pakistan_coords(loc_lat, loc_lng):
                            return PrimaryLocation(
                                district=loc_district,
                                city=loc_city,
                                province=entity.canonical_name,
                                latitude=loc_lat,
                                longitude=loc_lng,
                                source="STRUCTURED",
                                confidence="HIGH",
                                is_inferred=False,
                                label="Source-provided",
                                method="STRUCTURED_SCRAPER_PROVINCE_WITH_COORDS",
                            )

            if is_valid_pakistan_coords(loc_lat, loc_lng):
                return PrimaryLocation(
                    district=loc_district,
                    city=loc_city,
                    province=loc_province,
                    latitude=loc_lat,
                    longitude=loc_lng,
                    source="STRUCTURED",
                    confidence="HIGH",
                    is_inferred=False,
                    label="Source-provided",
                    method="STRUCTURED_SCRAPER_EXPLICIT_COORDS",
                )

        return None

    def _resolve_from_text(self, text: str, text_source: str) -> PrimaryLocation | None:
        if not text or not text.strip():
            return None

        matches = self.index.scan(text)
        if not matches:
            return None

        cities = [
            m.entity
            for m in matches
            if m.entity.entity_type in {"CITY", "TOWN", "LOCALITY"}
        ]
        districts = [
            m.entity
            for m in matches
            if m.entity.entity_type == "DISTRICT"
        ]
        tehsils = [
            m.entity
            for m in matches
            if m.entity.entity_type == "TEHSIL"
        ]

        if cities:
            # Pick highest-population city mentioned
            best_city = max(
                cities,
                key=lambda c: (
                    1 if c.entity_type == "CITY" else 0,
                    c.population_rounded_thousands or 0,
                ),
            )
            district, province, _ = self.index.parent_names(best_city)
            if not district and districts:
                district = districts[0].canonical_name
            lat, lng = self._validated_coords(None, None, best_city.latitude, best_city.longitude)
            return PrimaryLocation(
                district=district,
                city=best_city.canonical_name,
                province=province,
                latitude=lat,
                longitude=lng,
                source="TITLE_EXTRACTION" if text_source == "TITLE" else "DESCRIPTION_EXTRACTION",
                confidence="HIGH",
                is_inferred=True,
                label=f"Extracted from {text_source.lower()}",
                method=f"{text_source}_EXPLICIT_CITY",
            )

        if tehsils:
            best_tehsil = tehsils[0]
            district, province, _ = self.index.parent_names(best_tehsil)
            top_city = (
                self.index.get_district_top_city(best_tehsil.district_id)
                if best_tehsil.district_id
                else None
            )
            city_name = top_city.canonical_name if top_city else best_tehsil.canonical_name
            lat, lng = self._validated_coords(
                None,
                None,
                top_city.latitude if top_city else best_tehsil.latitude,
                top_city.longitude if top_city else best_tehsil.longitude,
            )
            return PrimaryLocation(
                district=district,
                city=city_name,
                province=province,
                latitude=lat,
                longitude=lng,
                source="TITLE_EXTRACTION" if text_source == "TITLE" else "DESCRIPTION_EXTRACTION",
                confidence="HIGH",
                is_inferred=True,
                label=f"Extracted from {text_source.lower()}",
                method=f"{text_source}_EXPLICIT_TEHSIL",
            )

        if districts:
            best_district = max(
                districts,
                key=lambda d: (d.population_rounded_thousands or 0),
            )
            _, province, _ = self.index.parent_names(best_district)
            top_city = self.index.get_district_top_city(best_district.numeric_id)
            city_name = (
                top_city.canonical_name
                if top_city and top_city.entity_type in {"CITY", "TOWN"}
                else None
            )
            lat, lng = self._validated_coords(
                None,
                None,
                top_city.latitude if top_city else best_district.latitude,
                top_city.longitude if top_city else best_district.longitude,
            )
            return PrimaryLocation(
                district=best_district.canonical_name,
                city=city_name,
                province=province,
                latitude=lat,
                longitude=lng,
                source="TITLE_EXTRACTION" if text_source == "TITLE" else "DESCRIPTION_EXTRACTION",
                confidence="HIGH",
                is_inferred=True,
                label=f"Extracted from {text_source.lower()}",
                method=f"{text_source}_EXPLICIT_DISTRICT",
            )

        return None

    def _resolve_from_description(
        self,
        *,
        description: str,
        raw_text: str,
        structured_advisory: dict[str, Any] | None,
    ) -> PrimaryLocation | None:
        target_text = f"{description}\n{raw_text}".strip()
        if not target_text:
            return None

        matches = self.index.scan(target_text)
        if not matches:
            return None

        # Build candidate district map: district_numeric_id -> candidate data
        candidate_districts: dict[int, dict[str, Any]] = {}

        for match in matches:
            entity = match.entity
            if entity.entity_type == "DISTRICT":
                dist_id = entity.numeric_id
                entry = candidate_districts.setdefault(dist_id, {
                    "entity": entity,
                    "cities": [],
                    "tehsils": [],
                    "mention_count": 0,
                    "max_severity_rank": 0,
                })
                entry["mention_count"] += 1
            elif entity.entity_type in {"CITY", "TOWN", "LOCALITY"} and entity.district_id:
                dist_id = entity.district_id
                dist_entity = self.index.get_district_entity(dist_id)
                if dist_entity:
                    entry = candidate_districts.setdefault(dist_id, {
                        "entity": dist_entity,
                        "cities": [],
                        "tehsils": [],
                        "mention_count": 0,
                        "max_severity_rank": 0,
                    })
                    entry["cities"].append(entity)
                    entry["mention_count"] += 1
            elif entity.entity_type == "TEHSIL" and entity.district_id:
                dist_id = entity.district_id
                dist_entity = self.index.get_district_entity(dist_id)
                if dist_entity:
                    entry = candidate_districts.setdefault(dist_id, {
                        "entity": dist_entity,
                        "cities": [],
                        "tehsils": [],
                        "mention_count": 0,
                        "max_severity_rank": 0,
                    })
                    entry["tehsils"].append(entity)
                    entry["mention_count"] += 1

        if not candidate_districts:
            return None

        # Determine river / station severity ranks for candidate districts
        if structured_advisory:
            for cond in structured_advisory.get("river_conditions", []):
                station = (cond.get("station") or "").casefold()
                river = (cond.get("river") or "").casefold()
                level = (cond.get("level") or "").casefold()
                rank = SEVERITY_LEVEL_RANK.get(level, 0)
                if rank == 0:
                    continue

                mapped_dist = STATION_TO_DISTRICT.get(station)
                if mapped_dist:
                    dist_ent = self.index.get_district_entity(mapped_dist)
                    if dist_ent and dist_ent.numeric_id in candidate_districts:
                        candidate_districts[dist_ent.numeric_id]["max_severity_rank"] = max(
                            candidate_districts[dist_ent.numeric_id]["max_severity_rank"],
                            rank,
                        )

        # Deterministic District Tie-Breaking:
        # Rule A: Prefer district with explicitly matched city
        # Rule B: Prefer district with highest river/station severity rank
        # Rule C: Prefer district with highest mention count
        # Rule D: Lexicographical order by canonical district name
        sorted_candidates = sorted(
            candidate_districts.values(),
            key=lambda c: (
                1 if len(c["cities"]) > 0 else 0,
                c["max_severity_rank"],
                c["mention_count"],
                -len(c["entity"].canonical_name),  # Consistent secondary tie-break
                c["entity"].canonical_name,
            ),
            reverse=True,
        )

        winning = sorted_candidates[0]
        dist_entity: LocationEntity = winning["entity"]
        district = dist_entity.canonical_name
        _, province, _ = self.index.parent_names(dist_entity)

        if winning["cities"]:
            best_city: LocationEntity = max(
                winning["cities"],
                key=lambda c: (
                    1 if c.entity_type == "CITY" else 0,
                    c.population_rounded_thousands or 0,
                ),
            )
            lat, lng = self._validated_coords(None, None, best_city.latitude, best_city.longitude)
            return PrimaryLocation(
                district=district,
                city=best_city.canonical_name,
                province=province,
                latitude=lat,
                longitude=lng,
                source="DESCRIPTION_EXTRACTION",
                confidence="MEDIUM",
                is_inferred=True,
                label="Extracted from description",
                method="DESCRIPTION_EXPLICIT_CITY",
            )

        # Fallback to most-populated city in genuine matched district
        top_city = self.index.get_district_top_city(dist_entity.numeric_id)
        city_name = (
            top_city.canonical_name
            if top_city and top_city.entity_type in {"CITY", "TOWN"}
            else None
        )
        lat, lng = self._validated_coords(
            None,
            None,
            top_city.latitude if top_city else dist_entity.latitude,
            top_city.longitude if top_city else dist_entity.longitude,
        )
        return PrimaryLocation(
            district=district,
            city=city_name,
            province=province,
            latitude=lat,
            longitude=lng,
            source="DISTRICT_POPULATION_FALLBACK",
            confidence="MEDIUM",
            is_inferred=True,
            label="District population fallback",
            method="DESCRIPTION_DISTRICT_TOP_CITY",
        )

    def _resolve_from_rivers_and_stations(
        self,
        *,
        description: str,
        raw_text: str,
        structured_advisory: dict[str, Any] | None,
    ) -> PrimaryLocation | None:
        target_text = f"{description}\n{raw_text}".casefold()
        candidates: list[tuple[int, int, str, str]] = []  # (severity_rank, is_station, district_name, station/river_name)

        # 1. From structured river conditions
        if structured_advisory:
            for cond in structured_advisory.get("river_conditions", []):
                station = (cond.get("station") or "").strip().casefold()
                river = (cond.get("river") or "").strip().casefold()
                level = (cond.get("level") or "").strip().casefold()
                rank = SEVERITY_LEVEL_RANK.get(level, 1)

                if station and station in STATION_TO_DISTRICT:
                    candidates.append((rank, 2, STATION_TO_DISTRICT[station], station))
                elif river and river in RIVER_TO_PRIMARY_DISTRICTS:
                    for d_name in RIVER_TO_PRIMARY_DISTRICTS[river]:
                        candidates.append((rank, 1, d_name, river))

        # 2. From text station scan
        for station_key, dist_name in STATION_TO_DISTRICT.items():
            if station_key in target_text:
                candidates.append((1, 2, dist_name, station_key))

        # 3. From text river scan
        for river_key, dist_list in RIVER_TO_PRIMARY_DISTRICTS.items():
            if f"river {river_key}" in target_text or f"{river_key} river" in target_text:
                for d_name in dist_list[:2]:
                    candidates.append((1, 1, d_name, river_key))

        if not candidates:
            return None

        # Sort candidates by severity rank desc, is_station desc, district name asc
        candidates.sort(key=lambda item: (item[0], item[1], -len(item[2]), item[2]), reverse=True)
        _, is_station, best_district_name, matched_source = candidates[0]

        dist_entity = self.index.get_district_entity(best_district_name)
        if not dist_entity:
            return None

        _, province, _ = self.index.parent_names(dist_entity)
        top_city = self.index.get_district_top_city(dist_entity.numeric_id)
        city_name = (
            top_city.canonical_name
            if top_city and top_city.entity_type in {"CITY", "TOWN"}
            else None
        )
        lat, lng = self._validated_coords(
            None,
            None,
            top_city.latitude if top_city else dist_entity.latitude,
            top_city.longitude if top_city else dist_entity.longitude,
        )

        return PrimaryLocation(
            district=dist_entity.canonical_name,
            city=city_name,
            province=province,
            latitude=lat,
            longitude=lng,
            source="RIVER_MAPPING",
            confidence="MEDIUM" if is_station == 2 else "LOW",
            is_inferred=True,
            label="Derived from river / barrage mapping",
            method=f"RIVER_STATION_MAPPING:{matched_source}",
        )

    @staticmethod
    def _validated_coords(
        preferred_lat: float | None,
        preferred_lng: float | None,
        fallback_lat: float | None,
        fallback_lng: float | None,
    ) -> tuple[float | None, float | None]:
        if is_valid_pakistan_coords(preferred_lat, preferred_lng):
            return preferred_lat, preferred_lng
        if is_valid_pakistan_coords(fallback_lat, fallback_lng):
            return fallback_lat, fallback_lng
        return None, None
