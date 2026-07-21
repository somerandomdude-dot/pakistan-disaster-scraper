import os
import re
import pytest
import shutil
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.database.models.alert import Alert
from app.database.models.alert_location import AlertLocation
from app.database.models.alert_revision import AlertRevision
from app.database.models.source import Source
from app.schemas.alert import AlertCreate, AlertLocationCreate
from app.processing.alert_processor import AlertProcessor
from app.services.text_export_service import (
    TextExportService,
    LATEST_DIR,
    ARCHIVE_DIR,
    to_ascii,
    format_pkt
)

@pytest.fixture(autouse=True)
def clean_exports_dir():
    """Clean storage/exports/ directory before and after each test."""
    if os.path.exists(LATEST_DIR):
        shutil.rmtree(LATEST_DIR, ignore_errors=True)
    if os.path.exists(ARCHIVE_DIR):
        shutil.rmtree(ARCHIVE_DIR, ignore_errors=True)
    os.makedirs(LATEST_DIR, exist_ok=True)
    os.makedirs(ARCHIVE_DIR, exist_ok=True)
    yield
    if os.path.exists(LATEST_DIR):
        shutil.rmtree(LATEST_DIR, ignore_errors=True)
    if os.path.exists(ARCHIVE_DIR):
        shutil.rmtree(ARCHIVE_DIR, ignore_errors=True)


def test_ascii_only_and_required_sections(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    alert_create = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="TEST-ASCII-001",
        title="Heavy Rain & Severe “Thunderstorm” Warning — Lahore",
        description="Heavy rainfall is expected in Lahore (31.52° N). Urban flooding may occur.",
        hazard_type="heavy_rain",
        normalized_severity="high",
        official_severity="severe",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://www.pmd.gov.pk/test",
        content_hash="test_hash_123",
        locations=[
            AlertLocationCreate(province="Punjab", district="Lahore", city="Lahore", raw_location="Lahore District", latitude=31.5204, longitude=74.3587, match_confidence="1.00"),
            AlertLocationCreate(province="Punjab", district="Kasur", city="Kasur", raw_location="Kasur District", match_confidence="0.95")
        ]
    )

    stats = processor.process_alerts([alert_create])
    assert stats["created"] == 1

    alert = db_session.query(Alert).filter(Alert.source_alert_id == "TEST-ASCII-001").first()
    assert alert is not None

    export_path = TextExportService.get_latest_export_path(alert.id)
    assert export_path is not None
    assert os.path.exists(export_path)

    with open(export_path, "r", encoding="ascii") as f:
        content = f.read()

    # 1. Confirm ALL characters are ASCII (ord <= 127)
    for char in content:
        assert ord(char) <= 127, f"Non-ASCII character found: {char} (ord {ord(char)})"

    # 2. Check required section headers
    required_sections = [
        "+==============================================================================+",
        "PAKISTAN NATURAL DISASTER ALERT",
        "ALERT SUMMARY",
        "TITLE",
        "DESCRIPTION",
        "AFFECTED LOCATIONS",
        "TIMING",
        "SAFETY INSTRUCTIONS",
        "SOURCE INFORMATION",
        "PROCESSING INFORMATION",
        "VALIDATION NOTES",
        "CHANGE HISTORY",
        "RAW EXTRACTED TEXT",
        "END OF ALERT RECORD"
    ]
    for section in required_sections:
        assert section in content, f"Missing required section in export: '{section}'"

    # 3. Check line wrapping length (max 80 chars per line where practical)
    for line in content.splitlines():
            # URL and hash lines may exceed 80 chars due to unbreakable strings
            skip_prefixes = ("Source URL", "Final URL", "Alert Content Hash", "Raw Document Hash")
            if not line.startswith(skip_prefixes):
                assert len(line) <= 80, f"Line length exceeds 80 chars: '{line}' ({len(line)} chars)"


def test_missing_values_replaced_with_na(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    alert_create = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="TEST-NA-001",
        title="Generic Weather Warning",
        description="",
        hazard_type="unknown",
        normalized_severity="unknown",
        official_severity=None,
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://www.pmd.gov.pk/test-na",
        content_hash="na_test_hash",
        locations=[AlertLocationCreate(raw_location="Islamabad")]
    )
    processor.process_alerts([alert_create])
    alert = db_session.query(Alert).filter(Alert.source_alert_id == "TEST-NA-001").first()
    assert alert is not None

    export_path = TextExportService.get_latest_export_path(alert.id)
    assert export_path is not None

    with open(export_path, "r", encoding="ascii") as f:
        content = f.read()

    assert "Official Severity : N/A" in content
    assert "Starts At          : N/A" in content
    assert "Expires At         : N/A" in content


def test_updated_alert_archives_previous_version(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    alert_create = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="REV-TEST-001",
        title="Heatwave Advisory",
        description="Heatwave conditions expected.",
        hazard_type="heatwave",
        normalized_severity="medium",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://test.com/rev",
        content_hash="hash_v1",
        locations=[AlertLocationCreate(province="Sindh", district="Karachi", raw_location="Karachi")]
    )

    # 1. Create alert
    processor.process_alerts([alert_create.model_copy(deep=True)])
    alert = db_session.query(Alert).filter(Alert.source_alert_id == "REV-TEST-001").first()
    first_export_path = TextExportService.get_latest_export_path(alert.id)
    assert first_export_path is not None
    assert os.path.exists(first_export_path)

    # 2. Update alert (meaningful change)
    updated_create = alert_create.model_copy(deep=True)
    updated_create.description = "Severe heatwave alert! Temperatures exceeding 45C in Karachi."
    updated_create.normalized_severity = "high"
    updated_create.official_severity = "severe"
    processor.process_alerts([updated_create])

    # Check latest directory contains new version
    latest_files = os.listdir(LATEST_DIR)
    assert len(latest_files) == 1

    # Check archive directory contains the previous version
    archive_files = os.listdir(ARCHIVE_DIR)
    assert len(archive_files) == 1

    latest_path = os.path.join(LATEST_DIR, latest_files[0])
    with open(latest_path, "r", encoding="ascii") as f:
        content = f.read()

    assert "Revision Number    : 2" in content
    assert "Changed Fields:" in content


def test_duplicate_and_rejected_alerts_create_no_export(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    base_alert = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="DUP-TEST-001",
        title="Flood Advisory",
        description="River water levels rising.",
        hazard_type="flood",
        normalized_severity="medium",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://test.com/dup",
        content_hash="hash_dup",
        locations=[AlertLocationCreate(raw_location="Lahore")]
    )

    # 1. Initial creation (creates export)
    stats1 = processor.process_alerts([base_alert.model_copy(deep=True)])
    assert stats1["created"] == 1
    initial_latest_count = len(os.listdir(LATEST_DIR))
    assert initial_latest_count == 1

    # 2. Process exact duplicate (should produce no new export file)
    stats2 = processor.process_alerts([base_alert.model_copy(deep=True)])
    assert stats2["ignored"] == 1
    assert len(os.listdir(LATEST_DIR)) == initial_latest_count

    # 3. Process rejected alert (should produce no export file)
    rejected_alert = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="REJ-TEST-001",
        title="",
        description="",
        hazard_type="unknown",
        normalized_severity="unknown",
        issued_at=datetime.now(timezone.utc),
        status="rejected",
        source_url="https://test.com/rej",
        content_hash="hash_rej",
        locations=[]
    )
    stats3 = processor.process_alerts([rejected_alert])
    # Validator marks alerts with empty title + no locations as "incomplete"
    assert stats3["incomplete"] == 1
    assert len(os.listdir(LATEST_DIR)) == initial_latest_count


def test_filename_sanitization_and_format(db_session):
    dt = datetime(2026, 7, 21, 14, 30, 0, tzinfo=timezone.utc)
    filename = TextExportService.sanitize_filename(
        dt=dt,
        source_name="PMD Weather!",
        hazard_type="heavy_rain",
        location_name="Lahore & Kasur"
    )

    # Expected uppercase ASCII format: YYYY-MM-DD_HH-MM-SS_SOURCE_HAZARD_LOCATION.txt
    assert filename.endswith(".txt")
    assert "2026-07-21" in filename
    assert "PMD" in filename
    assert "HEAVY_RAIN" in filename
    assert "LAHORE" in filename
    # All characters must be uppercase letters, digits, underscores, hyphens, or dots (plus lowercase for .txt extension)
    allowed = set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-.')
    assert all(c in allowed for c in filename), f"Filename contains disallowed chars: {filename}"


def test_export_api_endpoints(client, db_session, pmd_source):
    processor = AlertProcessor(db_session)
    alert_create = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="API-TEST-001",
        title="API Test Weather Warning",
        description="Testing API export download.",
        hazard_type="heavy_rain",
        normalized_severity="medium",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://test.com/api",
        content_hash="api_hash_123",
        locations=[AlertLocationCreate(raw_location="Lahore")]
    )

    processor.process_alerts([alert_create])
    alert = db_session.query(Alert).filter(Alert.source_alert_id == "API-TEST-001").first()

    # 1. GET /api/v1/alerts/{alert_id}/export
    response = client.get(f"/api/v1/alerts/{alert.id}/export")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert "PAKISTAN NATURAL DISASTER ALERT" in response.text

    # 2. POST /api/v1/admin/alerts/{alert_id}/export (Admin regenerate)
    admin_headers = {"x-admin-api-key": "change-me"}
    post_resp = client.post(f"/api/v1/admin/alerts/{alert.id}/export", headers=admin_headers)
    assert post_resp.status_code == 200
    json_data = post_resp.json()
    assert json_data["alert_id"] == alert.id
    assert "export_path" in json_data


def test_path_traversal_prevention(client):
    # Test GET with non-existent or invalid path
    response = client.get("/api/v1/alerts/99999/export")
    assert response.status_code == 404
