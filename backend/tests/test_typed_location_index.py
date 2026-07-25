import hashlib
import inspect
import json
import time
from pathlib import Path

import msgpack
import pytest
import zstandard as zstd

from app.locations.index import LocationIndex
from app.locations.matcher import TypedLocationMatcher
from app.locations.normalization import normalize_location_name
from app.schemas.alert import AlertLocationCreate
from scripts.build_pakistan_location_index import (
    ENTITY_TYPES,
    METADATA_PATH,
    RUNTIME_PATH,
    build_runtime,
    load_source_dataset,
    validate_dataset,
)


@pytest.fixture(scope="module")
def index():
    return LocationIndex.load()


@pytest.fixture(scope="module")
def matcher(index):
    return TypedLocationMatcher(index)


def names(result, collection):
    return {item["canonical_name"] for item in result[collection]}


def test_generated_index_loads_and_has_explicit_types(index):
    assert len(index.locations) == 187736
    assert all(entity.entity_type in ENTITY_TYPES for entity in index.locations.values())


def test_source_dataset_passes_full_validation():
    dataset, _ = load_source_dataset()
    report = validate_dataset(dataset)
    assert report["valid"] is True
    assert report["errors"] == []


def test_required_exclusion_entities_are_typed(index):
    assert index.lookup("Pakistan").entity_type == "COUNTRY"
    assert index.lookup("PMD").entity_type == "GOVERNMENT_AGENCY"
    assert index.lookup("NDMA").entity_type == "GOVERNMENT_AGENCY"
    assert index.lookup("Islamabad Office").entity_type == "ISSUING_OFFICE"


def test_islamabad_city_is_distinct_from_office_and_territory(matcher):
    result = matcher.extract(description="Heavy rain is expected in Islamabad.")
    assert "Islamabad" in names(result, "cities")
    assert "Islamabad Capital Territory" in names(result, "provinces")
    assert not result["ignored_entities"]


def test_three_step_type_mapping_and_ignore_filter(matcher):
    result = matcher.extract(
        description=(
            "PMD and NDMA issued an alert from Islamabad Office for Lahore city, "
            "Kasur District, Punjab and the River Indus in Pakistan."
        )
    )
    assert "Lahore" in names(result, "cities")
    assert "Kasur" in names(result, "districts")
    assert "Punjab" in names(result, "provinces")
    assert "Indus" in names(result, "geographic_features")
    ignored_types = {item["entity_type"] for item in result["ignored_entities"]}
    assert {"COUNTRY", "GOVERNMENT_AGENCY", "ISSUING_OFFICE"} <= ignored_types


def test_pattoki_resolves_parent_hierarchy_in_o1_maps(index, matcher):
    pattoki = index.lookup("Pattoki")
    assert pattoki.entity_type == "CITY"
    assert index.entity(index.city_to_district[pattoki.numeric_id]).canonical_name == "Kasur"
    assert index.entity(index.city_to_province[pattoki.numeric_id]).canonical_name == "Punjab"
    result = matcher.extract(description="Flooding is possible near Pattoki.")
    city = next(item for item in result["cities"] if item["canonical_name"] == "Pattoki")
    assert city["district"] == "Kasur"
    assert city["province"] == "Punjab"


def test_exact_verified_and_roman_urdu_aliases(index):
    assert index.lookup("LHR").canonical_name == "Lahore"
    assert index.lookup("Patoki").canonical_name == "Pattoki"
    assert index.lookup("لاہور").canonical_name == "Lahore"


def test_shared_normalization_handles_affixes_and_punctuation():
    assert normalize_location_name("District Kasur") == "kasur"
    assert normalize_location_name("Kasur District") == "kasur"
    assert normalize_location_name("  Dera-Ghazi Khan ") == "dera ghazi khan"


def test_multiword_match_and_short_fragments_are_safe(matcher):
    result = matcher.extract(description="Rain is expected in Dera Ghazi Khan.")
    assert "Dera Ghazi Khan" in names(result, "cities")
    false_result = matcher.extract(description="The bad weather may contain tan dust particles.")
    assert "Badin" not in names(false_result, "cities")
    assert "Multan" not in names(false_result, "cities")


def test_duplicate_mentions_are_deduplicated(matcher):
    result = matcher.extract(
        title="Pattoki alert",
        description="Pattoki and Pattoki may be affected.",
        raw_text="Pattoki",
    )
    assert [item["canonical_name"] for item in result["cities"]].count("Pattoki") == 1


def test_structured_location_has_priority(matcher):
    result = matcher.extract(
        structured_locations=[AlertLocationCreate(raw_location="Pattoki")],
        title="Pattoki rain alert",
    )
    pattoki = next(item for item in result["cities"] if item["canonical_name"] == "Pattoki")
    assert pattoki["text_source"] == "STRUCTURED_SCRAPER_FIELD"
    assert pattoki["evidence_score"] == 100


def test_aho_scan_reports_offsets_and_methods(index):
    matches = index.scan("Alert for Lahore and Dera Ghazi Khan")
    lahore = next(match for match in matches if match.entity.canonical_name == "Lahore")
    assert lahore.start_offset >= 0
    assert lahore.end_offset > lahore.start_offset
    assert lahore.match_method in {"EXACT_CANONICAL", "EXACT_ALIAS"}


def test_runtime_checksum_and_parent_ids_are_valid(index):
    metadata = json.loads(METADATA_PATH.read_text("utf-8"))
    assert hashlib.sha256(RUNTIME_PATH.read_bytes()).hexdigest() == metadata["runtime_sha256"]
    assert all(
        parent_id in index.locations
        for entity in index.locations.values()
        for parent_id in (
            entity.province_id, entity.district_id, entity.tehsil_id,
            entity.division_id, entity.parent_id,
        )
        if parent_id is not None
    )


def test_compressed_index_round_trip():
    payload = zstd.ZstdDecompressor().decompress(RUNTIME_PATH.read_bytes())
    decoded = msgpack.unpackb(payload, raw=False, strict_map_key=False)
    assert decoded["format_version"] == 1
    assert len(decoded["locations"]) == 187736


def test_small_index_generation_is_reproducible():
    record = {
        "id": "city_test", "canonical_name": "Test City", "normalized_name": "test city",
        "type": "CITY", "province_id": None, "district_id": None, "tehsil_id": None,
        "division_id": None, "parent_id": None, "latitude": None, "longitude": None,
        "population_value": None, "aliases": ["Testville"],
    }
    dataset = {"dataset_version": "test-1", "records": [record]}
    first = msgpack.packb(build_runtime(dataset), use_bin_type=True)
    second = msgpack.packb(build_runtime(dataset), use_bin_type=True)
    assert first == second


def test_invalid_coordinates_are_rejected_and_missing_remain_null():
    invalid = {
        "dataset_version": "bad",
        "records": [{
            "id": "bad", "canonical_name": "Bad", "normalized_name": "bad",
            "type": "CITY", "province_id": None, "district_id": None,
            "tehsil_id": None, "division_id": None, "parent_id": None,
            "latitude": 90.0, "longitude": 200.0, "population_value": None,
            "aliases": [], "hierarchy_exception": "test exception",
        }],
    }
    assert validate_dataset(invalid)["valid"] is False
    assert LocationIndex.load().lookup("PMD").latitude is None


def test_runtime_scan_does_not_iterate_complete_location_dataset():
    source = inspect.getsource(LocationIndex.scan)
    assert "self.locations.values()" not in source
    assert "self.automaton" in source


def test_common_extraction_meets_twenty_millisecond_target(matcher):
    text = (
        "PMD reports heavy rain in Pattoki, Lahore and Kasur District. "
        "NDMA advises residents near the River Indus to remain alert."
    )
    matcher.extract(title="Punjab weather alert", description=text)
    started = time.perf_counter()
    for _ in range(100):
        matcher.extract(title="Punjab weather alert", description=text)
    average_ms = (time.perf_counter() - started) * 1000 / 100
    assert average_ms < 20

