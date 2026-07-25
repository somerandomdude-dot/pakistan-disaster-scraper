#!/usr/bin/env python3
"""Backfill typed, versioned location resolutions for existing alerts."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database.models.alert import Alert
from app.database.session import SessionLocal
from app.locations.matcher import TypedLocationMatcher
from app.processing.alert_processor import AlertProcessor
from app.processing.location_matcher import LocationMatcher
from app.schemas.alert import AlertCreate
from app.main import ensure_location_schema, init_sources


def backfill(dry_run: bool = False) -> tuple[int, int]:
    init_sources()
    ensure_location_schema()
    matcher = TypedLocationMatcher()
    adapter = LocationMatcher._to_alert_locations
    processed = 0
    skipped = 0
    db = SessionLocal()
    try:
        processor = AlertProcessor(db)
        for alert in db.query(Alert).order_by(Alert.id).yield_per(100):
            cache_key = matcher.cache_key(alert.content_hash)
            if (
                alert.location_resolution_record
                and alert.location_resolution_record.cache_key == cache_key
            ):
                skipped += 1
                continue
            resolution = matcher.extract(
                structured_locations=list(alert.locations),
                title=alert.title,
                description=alert.description or "",
                raw_text=alert.raw_text or "",
            )
            payload = AlertCreate(
                source_id=alert.source_id,
                source_alert_id=alert.source_alert_id,
                title=alert.title,
                description=alert.description,
                hazard_type=alert.hazard_type,
                official_severity=alert.official_severity,
                normalized_severity=alert.normalized_severity,
                issued_at=alert.issued_at,
                starts_at=alert.starts_at,
                expires_at=alert.expires_at,
                status=alert.status,
                source_url=alert.source_url,
                raw_text=alert.raw_text,
                content_hash=alert.content_hash,
                validation_errors=alert.validation_errors,
                locations=adapter(resolution),
                location_resolution=resolution,
                location_cache_key=cache_key,
            )
            if not dry_run:
                processor._replace_locations(alert, payload)
                processor._save_resolution(alert, payload)
            processed += 1
            if processed % 100 == 0 and not dry_run:
                db.commit()
        if dry_run:
            db.rollback()
        else:
            db.commit()
        return processed, skipped
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    processed_count, skipped_count = backfill(args.dry_run)
    print(f"processed={processed_count} skipped={skipped_count} dry_run={args.dry_run}")

