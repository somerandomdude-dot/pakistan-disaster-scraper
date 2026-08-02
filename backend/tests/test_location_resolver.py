import pytest

from app.locations.index import LocationIndex, is_valid_pakistan_coords
from app.locations.matcher import TypedLocationMatcher
from app.locations.resolver import LocationResolver, PrimaryLocation
from app.schemas.alert import AlertLocationCreate


@pytest.fixture(scope="module")
def index():
    return LocationIndex.load()


@pytest.fixture(scope="module")
def resolver(index):
    return LocationResolver(index)


@pytest.fixture(scope="module")
def matcher(index):
    return TypedLocationMatcher(index)


def test_structured_scraper_location_has_highest_priority(resolver):
    # Even if title mentions Lahore, structured location is Kasur
    res: PrimaryLocation = resolver.resolve(
        structured_locations=[AlertLocationCreate(raw_location="Kasur")],
        title="Weather Advisory for Lahore",
        description="Rain in Multan and Rawalpindi",
    )
    assert res.district == "Kasur"
    assert res.province == "Punjab"
    assert res.source == "STRUCTURED"
    assert res.confidence == "HIGH"
    assert res.is_inferred is False
    assert res.label == "Source-provided"
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_structured_scraper_city_resolves_district_and_verified_coords(resolver):
    res: PrimaryLocation = resolver.resolve(
        structured_locations=[AlertLocationCreate(raw_location="Pattoki")],
        title="Rain in Islamabad",
    )
    assert res.city == "Pattoki"
    assert res.district == "Kasur"
    assert res.province == "Punjab"
    assert res.source == "STRUCTURED"
    assert res.is_inferred is False
    assert res.latitude == pytest.approx(31.02021, rel=1e-3)
    assert res.longitude == pytest.approx(73.85333, rel=1e-3)


def test_title_explicit_city_takes_precedence_over_description(resolver):
    res: PrimaryLocation = resolver.resolve(
        title="Flash flood warning for Mingora",
        description="Heavy rain expected in Multan, Lahore, and Faisalabad",
    )
    assert res.city == "Mingora"
    assert res.district == "Swat"
    assert res.source == "TITLE_EXTRACTION"
    assert res.confidence == "HIGH"
    assert res.is_inferred is True
    assert res.label == "Extracted from title"
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_title_district_resolves_child_city_fallback(resolver):
    res: PrimaryLocation = resolver.resolve(
        title="Heavy rain in Mianwali District",
        description="Scattered thunderstorms across the region",
    )
    assert res.district == "Mianwali"
    assert res.city == "Mianwali"
    assert res.province == "Punjab"
    assert res.source == "TITLE_EXTRACTION"
    assert res.is_inferred is True
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_description_rule_a_prefers_district_with_explicit_city(resolver):
    # Description mentions three districts: Kasur District, Mianwali District, Multan District.
    # Only Kasur has an explicitly mentioned city (Pattoki).
    res: PrimaryLocation = resolver.resolve(
        title="Punjab Weather Update",
        description="Alert for Kasur District, Mianwali District, and Multan District. Heavy downpour reported in Pattoki.",
    )
    assert res.district == "Kasur"
    assert res.city == "Pattoki"
    assert res.source == "DESCRIPTION_EXTRACTION"
    assert res.is_inferred is True
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_description_rule_b_prefers_district_with_higher_river_severity(resolver):
    # Both Gujranwala (Khanki) and Mianwali (Chashma) are mentioned in text.
    # Structured advisory has Khanki at High flood and Chashma at Low flood.
    structured_advisory = {
        "river_conditions": [
            {"river": "Indus", "station": "Chashma", "level": "Low"},
            {"river": "Chenab", "station": "Khanki", "level": "High"},
        ]
    }
    res: PrimaryLocation = resolver.resolve(
        title="Daily Flood Report",
        description="River flows affecting Mianwali District and Gujranwala District.",
        structured_advisory=structured_advisory,
    )
    # Gujranwala has High flood station (Khanki) -> rank 3 vs rank 1
    assert "Gujr" in res.district
    assert res.source == "DISTRICT_POPULATION_FALLBACK" or res.source == "DESCRIPTION_EXTRACTION"
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_description_rule_c_prefers_district_with_higher_mention_count(resolver):
    res: PrimaryLocation = resolver.resolve(
        title="Flood Advisory",
        description="Alert for Swat District. Swat emergency declared. Swat roads flooded. Minor showers in Lasbela District.",
    )
    assert res.district == "Swat"
    assert res.is_inferred is True
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_river_station_mapping_fallback(resolver):
    # No explicit city or district name in title or description, only station "Tarbela"
    structured_advisory = {
        "river_conditions": [
            {"river": "Indus", "station": "Tarbela", "level": "Medium"},
        ]
    }
    res: PrimaryLocation = resolver.resolve(
        title="River Discharge Bulletin",
        description="Water level monitoring update.",
        structured_advisory=structured_advisory,
    )
    assert res.district in {"Haripur", "Harīpur"}
    assert res.source == "RIVER_MAPPING"
    assert res.confidence == "MEDIUM"
    assert res.is_inferred is True
    assert res.label == "Derived from river / barrage mapping"
    assert is_valid_pakistan_coords(res.latitude, res.longitude)


def test_unresolved_never_defaults_to_lahore_or_karachi(resolver):
    res: PrimaryLocation = resolver.resolve(
        title="National Advisory",
        description="General advisory on changing seasonal patterns.",
    )
    assert res.district is None
    assert res.city is None
    assert res.province is None
    assert res.latitude is None
    assert res.longitude is None
    assert res.source == "UNRESOLVED"
    assert res.confidence == "LOW"
    assert res.is_inferred is False
    assert res.label == "Unresolved location"


def test_typed_matcher_includes_primary_location_in_result(matcher):
    result = matcher.extract(
        title="Heavy rain in Mingora, Swat",
        description="Residents should take safety precautions.",
    )
    assert "primary_location" in result
    primary = result["primary_location"]
    assert primary["district"] == "Swat"
    assert primary["city"] == "Mingora"
    assert primary["source"] == "TITLE_EXTRACTION"
    assert primary["is_inferred"] is True
    assert primary["latitude"] is not None
    assert primary["longitude"] is not None
