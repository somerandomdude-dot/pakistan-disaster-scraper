"""Compatibility adapter from scraper AlertCreate objects to typed extraction."""

from app.locations.matcher import TypedLocationMatcher
from app.schemas.alert import AlertCreate, AlertLocationCreate


class LocationMatcher:
    def __init__(self):
        self.matcher = TypedLocationMatcher()

    def match_location(self, raw_loc: str) -> AlertLocationCreate:
        result = self.matcher.extract(
            structured_locations=[AlertLocationCreate(raw_location=raw_loc)]
        )
        locations = self._to_alert_locations(result)
        if locations:
            location = locations[0]
            location.match_confidence = (
                "exact" if location.match_method == "EXACT_CANONICAL" else "alias"
            )
            return location
        return AlertLocationCreate(
            raw_location=raw_loc,
            match_confidence="manual",
        )

    def process(self, alert: AlertCreate) -> AlertCreate:
        result = self.matcher.extract(
            structured_locations=alert.locations,
            title=alert.title,
            description=alert.description or "",
            raw_text=alert.raw_text or "",
            structured_advisory=alert.structured_advisory,
        )
        alert.locations = self._to_alert_locations(result)
        alert.location_resolution = result
        alert.location_cache_key = self.matcher.cache_key(alert.content_hash or "")
        return alert

    @staticmethod
    def _to_alert_locations(result: dict) -> list[AlertLocationCreate]:
        output: list[AlertLocationCreate] = []
        for collection in ("cities", "tehsils", "districts", "divisions", "provinces", "geographic_features"):
            for item in result[collection]:
                output.append(AlertLocationCreate(
                    location_id=item["location_id"],
                    entity_type=item["entity_type"],
                    canonical_name=item["canonical_name"],
                    province=item.get("province") or (
                        item["canonical_name"] if item["entity_type"] in {"PROVINCE", "TERRITORY"} else None
                    ),
                    district=item.get("district") or (
                        item["canonical_name"] if item["entity_type"] == "DISTRICT" else None
                    ),
                    tehsil=item.get("tehsil") or (
                        item["canonical_name"] if item["entity_type"] == "TEHSIL" else None
                    ),
                    city=item["canonical_name"] if item["entity_type"] in {"CITY", "TOWN", "VILLAGE", "LOCALITY"} else None,
                    raw_location=item["matched_text"],
                    matched_text=item["matched_text"],
                    latitude=item.get("latitude"),
                    longitude=item.get("longitude"),
                    match_confidence=str(item["confidence"]),
                    text_source=item["text_source"],
                    match_method=item["match_method"],
                    start_offset=item["start_offset"],
                    end_offset=item["end_offset"],
                    evidence_score=item["evidence_score"],
                ))
        return output


matcher_instance = LocationMatcher()
