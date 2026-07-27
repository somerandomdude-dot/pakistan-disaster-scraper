#!/usr/bin/env python3
"""Populate persisted structured sections for existing FFD alerts."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.database.models.alert import Alert
from app.database.session import SessionLocal
from app.main import ensure_alert_schema, init_sources
from app.processing.ffd_advisory_parser import (
    PARSER_NAME,
    parse_ffd_advisory,
    severity_from_reported_level,
)


def backfill(dry_run: bool = False) -> tuple[int, int]:
    init_sources()
    ensure_alert_schema()
    processed = 0
    skipped = 0
    with SessionLocal() as db:
        for alert in db.query(Alert).order_by(Alert.id).yield_per(100):
            existing = alert.structured_advisory or {}
            parsed = parse_ffd_advisory(alert.raw_text, alert.source_url)
            expected_severity = severity_from_reported_level(parsed)
            if (
                existing.get("parser_name") == PARSER_NAME
                and alert.normalized_severity == expected_severity
            ):
                skipped += 1
                continue
            if parsed is None:
                skipped += 1
                continue
            processed += 1
            if not dry_run:
                alert.structured_advisory = parsed
                alert.normalized_severity = expected_severity
        if not dry_run:
            db.commit()
        else:
            db.rollback()
    return processed, skipped


if __name__ == "__main__":
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("--dry-run", action="store_true")
    arguments = argument_parser.parse_args()
    processed_count, skipped_count = backfill(arguments.dry_run)
    print(
        f"processed={processed_count} skipped={skipped_count} "
        f"dry_run={arguments.dry_run}"
    )
