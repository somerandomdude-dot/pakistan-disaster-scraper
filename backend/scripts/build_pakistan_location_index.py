#!/usr/bin/env python3
"""Import, validate, compact, and benchmark the Pakistan location index."""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
import sys
import time
import urllib.request
import zipfile
from collections import Counter, defaultdict, deque
from pathlib import Path
from typing import Any

import msgpack
import zstandard as zstd


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.locations.normalization import normalize_location_name, normalize_text, unique_normalized


SOURCE_PATH = BACKEND_ROOT / "app/data/source/pakistan_locations.json"
SOURCE_RECORDS_DIR = SOURCE_PATH.parent / "records"
GENERATED_DIR = BACKEND_ROOT / "app/data/generated"
RUNTIME_PATH = GENERATED_DIR / "pakistan_locations.msgpack.zst"
METADATA_PATH = GENERATED_DIR / "location_index_metadata.json"
REPORT_PATH = GENERATED_DIR / "location_validation_report.json"
GEONAMES_URL = "https://download.geonames.org/export/dump/PK.zip"
ALTERNATE_NAMES_URL = "https://download.geonames.org/export/dump/alternatenames/PK.zip"
DATASET_VERSION = "geonames-pk-2026.07+curated-3"

ENTITY_TYPES = [
    "COUNTRY", "PROVINCE", "TERRITORY", "DIVISION", "DISTRICT", "TEHSIL",
    "CITY", "TOWN", "VILLAGE", "LOCALITY", "REGION", "RIVER", "DAM",
    "BARRAGE", "COASTAL_AREA", "ISSUING_OFFICE", "GOVERNMENT_AGENCY",
    "WEATHER_OFFICE", "UNKNOWN",
]
TYPE_IDS = {name: index + 1 for index, name in enumerate(ENTITY_TYPES)}

MANUAL_ENTITIES = [
    {
        "id": "country_pakistan", "canonical_name": "Pakistan", "type": "COUNTRY",
        "aliases": ["Islamic Republic of Pakistan"], "source": "curated exclusion entity",
    },
    {
        "id": "agency_pmd", "canonical_name": "Pakistan Meteorological Department",
        "type": "GOVERNMENT_AGENCY", "aliases": ["PMD", "Pak Met Department"],
        "source": "curated exclusion entity",
    },
    {
        "id": "agency_ndma", "canonical_name": "National Disaster Management Authority",
        "type": "GOVERNMENT_AGENCY", "aliases": ["NDMA"],
        "source": "curated exclusion entity",
    },
    {
        "id": "agency_ffd", "canonical_name": "Flood Forecasting Division",
        "type": "GOVERNMENT_AGENCY", "aliases": ["FFD"],
        "source": "curated exclusion entity",
    },
    {
        "id": "office_islamabad", "canonical_name": "Islamabad Office",
        "type": "ISSUING_OFFICE", "aliases": ["Islamabad Forecasting Office"],
        "source": "curated exclusion entity",
    },
    {
        "id": "office_rmc", "canonical_name": "Regional Meteorological Centre",
        "type": "WEATHER_OFFICE", "aliases": ["Regional Meteorological Center", "RMC"],
        "source": "curated exclusion entity",
    },
]


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "PakistanDisasterIndexBuilder/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        return response.read()


def first_text_file(archive_bytes: bytes) -> tuple[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        names = sorted(name for name in archive.namelist() if name.lower().endswith(".txt"))
        if not names:
            raise ValueError("Archive contains no text file")
        return names[0], archive.read(names[0])


def geonames_type(feature_class: str, feature_code: str, name: str, population: int) -> str | None:
    upper_name = name.upper()
    if feature_code == "PCLI":
        return "COUNTRY"
    if feature_code == "ADM1":
        return "TERRITORY" if any(x in upper_name for x in ("ISLAMABAD", "AZAD", "GILGIT")) else "PROVINCE"
    if feature_code == "ADM2":
        return "DIVISION" if "DIVISION" in upper_name else "DISTRICT"
    if feature_code == "ADM3":
        return "TEHSIL"
    if feature_class == "P":
        if feature_code in {"PPLC", "PPLA", "PPLA2", "PPLA3", "PPLA4"} or population >= 100_000:
            return "CITY"
        if population >= 10_000:
            return "TOWN"
        if feature_code in {"PPLL", "PPLX", "PPLQ"}:
            return "LOCALITY"
        return "VILLAGE"
    if feature_code.startswith("STM") or feature_code in {"WADI", "CNL"}:
        return "RIVER"
    if feature_code.startswith("DAM"):
        return "BARRAGE" if "BARRAGE" in upper_name else "DAM"
    if feature_code in {"RGN", "AREA", "BSND"}:
        return "REGION"
    if feature_code in {"CST", "BAY", "GULF"}:
        return "COASTAL_AREA"
    return None


def parse_geonames(payload: bytes) -> list[dict[str, Any]]:
    _, raw = first_text_file(payload)
    records: list[dict[str, Any]] = []
    for line in raw.decode("utf-8").splitlines():
        columns = line.split("\t")
        if len(columns) < 19:
            continue
        geoname_id, name, ascii_name, alternate_names = columns[:4]
        latitude, longitude = columns[4], columns[5]
        feature_class, feature_code = columns[6], columns[7]
        country_code, _, admin1, admin2, admin3, admin4 = columns[8:14]
        population = int(columns[14] or 0)
        if country_code != "PK":
            continue
        entity_type = geonames_type(feature_class, feature_code, name, population)
        if entity_type is None:
            continue
        original_name = name
        if feature_code == "ADM1":
            name = {
                "Punjab Province": "Punjab",
                "Sindh Province": "Sindh",
                "Islamabad": "Islamabad Capital Territory",
            }.get(name, name)
        if entity_type == "DISTRICT" and name.endswith(" District"):
            name = name[:-9].strip()
        aliases = [original_name] if original_name != name else []
        if ascii_name and ascii_name not in {name, original_name}:
            aliases.append(ascii_name)
        aliases.extend(alias for alias in alternate_names.split(",") if alias and len(alias) <= 120)
        parsed_latitude = float(latitude) if latitude else None
        parsed_longitude = float(longitude) if longitude else None
        coordinate_review = None
        if (
            parsed_latitude is not None
            and not (22.0 <= parsed_latitude <= 38.8 and 60.0 <= parsed_longitude <= 78.8)
        ):
            parsed_latitude = None
            parsed_longitude = None
            coordinate_review = "GeoNames coordinate failed Pakistan plausibility validation"
        records.append({
            "id": f"geonames_{geoname_id}",
            "geonames_id": int(geoname_id),
            "canonical_name": name,
            "normalized_name": normalize_location_name(name),
            "type": entity_type,
            "province_id": None,
            "division_id": None,
            "district_id": None,
            "tehsil_id": None,
            "parent_id": None,
            "latitude": parsed_latitude,
            "longitude": parsed_longitude,
            "aliases": aliases[:12],
            "urdu_name": None,
            "population_value": population or None,
            "population_year": None,
            "population_source": "GeoNames gazetteer",
            "population_is_estimate": True if population else None,
            "admin_codes": [admin1 or None, admin2 or None, admin3 or None, admin4 or None],
            "feature_code": feature_code,
            "source": "GeoNames PK country dump, CC BY 4.0",
            "hierarchy_exception": None,
            "review_notes": coordinate_review,
        })
    return records


def apply_alternate_names(records: list[dict[str, Any]], payload: bytes) -> None:
    by_geonames = {record.get("geonames_id"): record for record in records}
    _, raw = first_text_file(payload)
    for line in raw.decode("utf-8").splitlines():
        columns = line.split("\t")
        if len(columns) < 4:
            continue
        _, geonames_id, language, alternate_name = columns[:4]
        if not geonames_id.isdigit() or int(geonames_id) not in by_geonames:
            continue
        record = by_geonames[int(geonames_id)]
        if language == "ur":
            record["urdu_name"] = record["urdu_name"] or alternate_name
        if language in {"en", "ur", ""} and 1 < len(alternate_name) <= 120:
            record["aliases"].append(alternate_name)


def assign_hierarchy(records: list[dict[str, Any]]) -> None:
    admin1: dict[str, str] = {}
    admin2: dict[tuple[str, str], str] = {}
    admin3: dict[tuple[str, str, str], str] = {}
    for record in records:
        a1, a2, a3, _ = record["admin_codes"]
        if record["type"] in {"PROVINCE", "TERRITORY"} and a1:
            admin1[a1] = record["id"]
        elif record["type"] in {"DISTRICT", "DIVISION"} and a1 and a2:
            admin2[(a1, a2)] = record["id"]
        elif record["type"] == "TEHSIL" and a1 and a2 and a3:
            admin3[(a1, a2, a3)] = record["id"]

    for record in records:
        a1, a2, a3, _ = record["admin_codes"]
        province_id = admin1.get(a1)
        district_id = admin2.get((a1, a2))
        tehsil_id = admin3.get((a1, a2, a3))
        record["province_id"] = province_id
        if record["type"] not in {"DISTRICT", "DIVISION"}:
            record["district_id"] = district_id
        if record["type"] not in {"TEHSIL"}:
            record["tehsil_id"] = tehsil_id
        if record["type"] in {"DISTRICT", "DIVISION"}:
            record["parent_id"] = province_id
        elif record["type"] == "TEHSIL":
            record["district_id"] = district_id
            record["parent_id"] = district_id or province_id
            if not district_id:
                record["type"] = "UNKNOWN"
                record["hierarchy_exception"] = "GeoNames ADM3 record has no verifiable ADM2 parent"
                record["review_notes"] = "Excluded from TEHSIL matching until its district is verified"
        elif record["type"] in {"CITY", "TOWN", "VILLAGE", "LOCALITY"}:
            record["parent_id"] = tehsil_id or district_id or province_id
            if not district_id:
                record["hierarchy_exception"] = "GeoNames source has no ADM2 code for this populated place"
        elif record["type"] not in {"PROVINCE", "TERRITORY", "COUNTRY"}:
            record["parent_id"] = district_id or province_id


def apply_curated_aliases(records: list[dict[str, Any]]) -> None:
    verified = {
        "Lahore": ["LHR"],
        "Karachi": ["KHI"],
        "Islamabad": ["ISB"],
        "Rawalpindi": ["Pindi"],
        "Pattoki": ["Patoki", "Pattoki City"],
        "Dera Ghazi Khan": ["DG Khan", "D.G. Khan"],
        "Dera Ismail Khan": ["DI Khan", "D.I. Khan"],
    }
    for record in records:
        if record["type"] in {"CITY", "TOWN"} and record["canonical_name"] in verified:
            record["aliases"].extend(verified[record["canonical_name"]])


def apply_local_curations(dataset: dict[str, Any]) -> None:
    dataset["dataset_version"] = DATASET_VERSION
    for record in dataset["records"]:
        if record["type"] == "DISTRICT" and record["canonical_name"].endswith(" District"):
            old_name = record["canonical_name"]
            record["canonical_name"] = old_name[:-9].strip()
            record["normalized_name"] = normalize_location_name(record["canonical_name"])
            record["aliases"] = list(dict.fromkeys([old_name, *record.get("aliases", [])]))
    apply_curated_aliases(dataset["records"])
    for record in dataset["records"]:
        record["aliases"] = list(dict.fromkeys(record.get("aliases", [])))


def import_geonames() -> dict[str, Any]:
    geonames_zip = download(GEONAMES_URL)
    alternate_zip = download(ALTERNATE_NAMES_URL)
    records = parse_geonames(geonames_zip)
    apply_alternate_names(records, alternate_zip)
    assign_hierarchy(records)
    apply_curated_aliases(records)
    for record in records:
        record["aliases"] = [
            alias for alias in dict.fromkeys(record["aliases"])
            if normalize_location_name(alias) != record["normalized_name"]
        ][:16]
    for entity in MANUAL_ENTITIES:
        records.append({
            **entity,
            "normalized_name": normalize_location_name(entity["canonical_name"]),
            "province_id": None, "division_id": None, "district_id": None,
            "tehsil_id": None, "parent_id": None, "latitude": None,
            "longitude": None, "urdu_name": None, "population_value": None,
            "population_year": None, "population_source": None,
            "population_is_estimate": None, "hierarchy_exception": None,
            "review_notes": None,
        })
    records.sort(key=lambda item: item["id"])
    return {
        "dataset_version": DATASET_VERSION,
        "license": "GeoNames data is licensed under CC BY 4.0",
        "sources": [
            {"url": GEONAMES_URL, "sha256": sha256_bytes(geonames_zip)},
            {"url": ALTERNATE_NAMES_URL, "sha256": sha256_bytes(alternate_zip)},
        ],
        "records": records,
    }


def validate_dataset(dataset: dict[str, Any]) -> dict[str, Any]:
    errors: list[str] = []
    warnings: list[str] = []
    records = dataset.get("records", [])
    by_id: dict[str, dict[str, Any]] = {}
    normalized_to_ids: dict[str, set[str]] = defaultdict(set)
    for index, record in enumerate(records):
        record_id = record.get("id")
        if not record_id or record_id in by_id:
            errors.append(f"record[{index}] has missing or duplicate id: {record_id}")
            continue
        by_id[record_id] = record
        if record.get("type") not in TYPE_IDS:
            errors.append(f"{record_id}: invalid explicit type {record.get('type')}")
        if not record.get("canonical_name") or not record.get("normalized_name"):
            errors.append(f"{record_id}: missing canonical or normalized name")
        latitude, longitude = record.get("latitude"), record.get("longitude")
        if (latitude is None) != (longitude is None):
            errors.append(f"{record_id}: incomplete coordinate pair")
        if latitude is not None and not (22.0 <= latitude <= 38.8 and 60.0 <= longitude <= 78.8):
            errors.append(f"{record_id}: implausible Pakistan coordinates {latitude},{longitude}")
        population = record.get("population_value")
        if population is not None and population < 0:
            errors.append(f"{record_id}: negative population")
        for value in [record.get("canonical_name", ""), *record.get("aliases", [])]:
            normalized = normalize_location_name(value)
            if normalized:
                normalized_to_ids[normalized].add(record_id)

    for record_id, record in by_id.items():
        for parent_field in ("parent_id", "province_id", "division_id", "district_id", "tehsil_id"):
            parent_id = record.get(parent_field)
            if parent_id and parent_id not in by_id:
                errors.append(f"{record_id}: {parent_field} references missing {parent_id}")
        if record["type"] == "DISTRICT" and not record.get("province_id"):
            errors.append(f"{record_id}: district has no province/territory")
        if record["type"] == "TEHSIL" and not record.get("district_id"):
            errors.append(f"{record_id}: tehsil has no district")
        if record["type"] == "CITY" and not record.get("district_id") and not record.get("hierarchy_exception"):
            errors.append(f"{record_id}: city has no district or documented exception")
        visited: set[str] = set()
        cursor = record
        while cursor.get("parent_id"):
            parent_id = cursor["parent_id"]
            if parent_id in visited:
                errors.append(f"{record_id}: circular parent relationship")
                break
            visited.add(parent_id)
            cursor = by_id.get(parent_id, {})

    ambiguous = {
        alias: sorted(ids)
        for alias, ids in normalized_to_ids.items()
        if len(ids) > 1
    }
    for alias, ids in ambiguous.items():
        warnings.append(f"ambiguous alias '{alias}' resolves to {len(ids)} records")
    return {
        "valid": not errors,
        "record_count": len(records),
        "errors": errors,
        "warning_count": len(warnings),
        "warnings": warnings[:500],
        "ambiguous_alias_count": len(ambiguous),
        "ambiguous_aliases": dict(list(sorted(ambiguous.items()))[:500]),
    }


def build_automaton(patterns: list[str]) -> list[list[Any]]:
    states: list[list[Any]] = [[{}, 0, []]]
    for pattern_id, pattern in enumerate(patterns):
        state = 0
        for char in pattern:
            next_state = states[state][0].get(char)
            if next_state is None:
                next_state = len(states)
                states[state][0][char] = next_state
                states.append([{}, 0, []])
            state = next_state
        states[state][2].append(pattern_id)
    queue: deque[int] = deque()
    for child in states[0][0].values():
        queue.append(child)
    while queue:
        state = queue.popleft()
        for char, child in states[state][0].items():
            queue.append(child)
            failure = states[state][1]
            while failure and char not in states[failure][0]:
                failure = states[failure][1]
            states[child][1] = states[failure][0].get(char, 0)
            states[child][2].extend(states[states[child][1]][2])
    return states


def build_runtime(dataset: dict[str, Any]) -> dict[str, Any]:
    records = dataset["records"]
    string_to_numeric = {record["id"]: index + 1 for index, record in enumerate(records)}
    exact_candidates: dict[str, set[int]] = defaultdict(set)
    alias_patterns: set[tuple[str, int]] = set()
    compact_records = []
    for record in records:
        numeric_id = string_to_numeric[record["id"]]
        canonical_normalized = normalize_location_name(record["canonical_name"])
        aliases = unique_normalized(record.get("aliases", []))
        exact_candidates[canonical_normalized].add(numeric_id)
        for alias in aliases:
            exact_candidates[alias].add(numeric_id)
            alias_patterns.add((alias, numeric_id))
        population = record.get("population_value")
        compact_records.append([
            numeric_id,
            TYPE_IDS[record["type"]],
            record["canonical_name"],
            string_to_numeric.get(record.get("province_id")),
            string_to_numeric.get(record.get("district_id")),
            string_to_numeric.get(record.get("tehsil_id")),
            string_to_numeric.get(record.get("division_id")),
            string_to_numeric.get(record.get("parent_id")),
            record.get("latitude"),
            record.get("longitude"),
            int(math.floor(population / 1000 + 0.5)) if population is not None else None,
            canonical_normalized,
            record["id"],
        ])
    patterns = sorted(exact_candidates)
    pattern_candidates = [sorted(exact_candidates[pattern]) for pattern in patterns]
    canonical_pairs = {
        (normalize_location_name(record["canonical_name"]), string_to_numeric[record["id"]])
        for record in records
    }
    pattern_methods = [
        [
            1 if (pattern, candidate) in canonical_pairs else 2
            for candidate in candidates
        ]
        for pattern, candidates in zip(patterns, pattern_candidates)
    ]
    province_to_districts: dict[int, list[int]] = defaultdict(list)
    district_to_cities: dict[int, list[int]] = defaultdict(list)
    for row in compact_records:
        numeric_id, type_id, _, province_id, district_id = row[:5]
        entity_type = ENTITY_TYPES[type_id - 1]
        if entity_type == "DISTRICT" and province_id:
            province_to_districts[province_id].append(numeric_id)
        if entity_type in {"CITY", "TOWN", "VILLAGE", "LOCALITY"} and district_id:
            district_to_cities[district_id].append(numeric_id)
    return {
        "format_version": 1,
        "dataset_version": dataset["dataset_version"],
        "entity_types": ENTITY_TYPES,
        "locations": compact_records,
        "patterns": patterns,
        "pattern_candidates": pattern_candidates,
        "pattern_methods": pattern_methods,
        "automaton": build_automaton(patterns),
        "province_to_districts": {key: value for key, value in sorted(province_to_districts.items())},
        "district_to_cities": {key: value for key, value in sorted(district_to_cities.items())},
    }


def benchmark_runtime(runtime: dict[str, Any], iterations: int = 1000) -> dict[str, float]:
    states = runtime["automaton"]
    patterns = runtime["patterns"]
    text = normalize_text(
        "Heavy rain may affect Pattoki, Kasur District and Lahore. "
        "Pakistan Meteorological Department Islamabad Office issued the advisory."
    )
    start = time.perf_counter()
    matches = 0
    for _ in range(iterations):
        state = 0
        for char in text:
            while state and char not in states[state][0]:
                state = states[state][1]
            state = states[state][0].get(char, 0)
            matches += len(states[state][2])
    elapsed_ms = (time.perf_counter() - start) * 1000
    return {
        "iterations": iterations,
        "total_ms": round(elapsed_ms, 3),
        "average_scan_ms": round(elapsed_ms / iterations, 5),
        "matches_observed": matches,
        "pattern_count": len(patterns),
    }


def benchmark_extraction(runtime: dict[str, Any], iterations: int = 250) -> dict[str, float]:
    from app.locations.index import LocationIndex
    from app.locations.matcher import TypedLocationMatcher

    matcher = TypedLocationMatcher(LocationIndex(runtime, 0.0))
    samples = (
        ("Punjab weather alert", "Heavy rain may affect Pattoki, Kasur District and Lahore."),
        ("Flood advisory", "Communities near the River Indus and Sukkur Barrage should remain alert."),
        ("Agency bulletin", "PMD Islamabad Office and NDMA issued advice for Pakistan."),
    )
    timings = []
    for index in range(iterations):
        title, description = samples[index % len(samples)]
        started = time.perf_counter()
        matcher.extract(title=title, description=description)
        timings.append((time.perf_counter() - started) * 1000)
    ordered = sorted(timings)
    return {
        "iterations": iterations,
        "average_ms": round(sum(timings) / len(timings), 5),
        "p95_ms": round(ordered[int(len(ordered) * 0.95) - 1], 5),
        "maximum_ms": round(max(timings), 5),
    }


def write_json(path: Path, value: Any) -> bytes:
    payload = (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return payload


def write_source_dataset(dataset: dict[str, Any]) -> bytes:
    records = dataset["records"]
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        if record["type"] == "VILLAGE":
            group = f"villages_{record.get('province_id') or 'unresolved'}"
        else:
            group = "administrative_places_features"
        groups[group].append(record)
    SOURCE_RECORDS_DIR.mkdir(parents=True, exist_ok=True)
    record_files: list[str] = []
    combined = bytearray()
    for group, group_records in sorted(groups.items()):
        relative = f"records/{group}.json"
        path = SOURCE_PATH.parent / relative
        payload = (
            json.dumps(group_records, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
        ).encode("utf-8")
        path.write_bytes(payload)
        record_files.append(relative)
        combined.extend(payload)
    manifest = {key: value for key, value in dataset.items() if key != "records"}
    manifest["record_count"] = len(records)
    manifest["records_files"] = record_files
    manifest_bytes = write_json(SOURCE_PATH, manifest)
    return manifest_bytes + bytes(combined)


def load_source_dataset() -> tuple[dict[str, Any], bytes]:
    manifest_bytes = SOURCE_PATH.read_bytes()
    manifest = json.loads(manifest_bytes)
    if "records" in manifest:
        return manifest, manifest_bytes
    records: list[dict[str, Any]] = []
    combined = bytearray(manifest_bytes)
    for relative in manifest.get("records_files", []):
        payload = (SOURCE_PATH.parent / relative).read_bytes()
        combined.extend(payload)
        records.extend(json.loads(payload))
    records.sort(key=lambda item: item["id"])
    return {**manifest, "records": records}, bytes(combined)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--import-geonames", action="store_true")
    parser.add_argument("--curate-local", action="store_true")
    args = parser.parse_args()

    if args.import_geonames:
        dataset = import_geonames()
        source_bytes = write_source_dataset(dataset)
    elif args.curate_local:
        dataset, _ = load_source_dataset()
        apply_local_curations(dataset)
        source_bytes = write_source_dataset(dataset)
    else:
        dataset, source_bytes = load_source_dataset()

    report = validate_dataset(dataset)
    write_json(REPORT_PATH, report)
    if not report["valid"]:
        for error in report["errors"][:100]:
            print(error, file=sys.stderr)
        raise SystemExit(f"Dataset validation failed with {len(report['errors'])} errors")

    runtime = build_runtime(dataset)
    packed = msgpack.packb(runtime, use_bin_type=True)
    compressed = zstd.ZstdCompressor(level=19, write_checksum=True).compress(packed)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    RUNTIME_PATH.write_bytes(compressed)
    decoded = msgpack.unpackb(zstd.ZstdDecompressor().decompress(compressed), raw=False, strict_map_key=False)
    if decoded["dataset_version"] != runtime["dataset_version"] or len(decoded["locations"]) != len(runtime["locations"]):
        raise SystemExit("Generated runtime index failed round-trip verification")

    counts = Counter(record["type"] for record in dataset["records"])
    benchmark = benchmark_runtime(runtime)
    extraction_benchmark = benchmark_extraction(runtime)
    metadata = {
        "dataset_version": dataset["dataset_version"],
        "source_sha256": sha256_bytes(source_bytes),
        "runtime_sha256": sha256_bytes(compressed),
        "record_count": len(dataset["records"]),
        "type_counts": dict(sorted(counts.items())),
        "uncompressed_source_bytes": len(source_bytes),
        "msgpack_bytes": len(packed),
        "compressed_bytes": len(compressed),
        "compression": "MessagePack + Zstandard level 19",
        "validation_report": REPORT_PATH.name,
        "benchmark": benchmark,
        "extraction_benchmark": extraction_benchmark,
    }
    write_json(METADATA_PATH, metadata)
    print(json.dumps(metadata, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
