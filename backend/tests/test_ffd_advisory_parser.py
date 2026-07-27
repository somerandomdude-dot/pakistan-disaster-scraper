from datetime import datetime, timezone

from app.database.models.alert import Alert
from app.database.models.source import Source
from app.processing.alert_processor import AlertProcessor
from app.processing.ffd_advisory_parser import parse_ffd_advisory
from app.scrapers.ffd_bulletins import FFDBulletinScraper
from app.schemas.alert import Alert as AlertResponse
from app.schemas.alert import AlertCreate


SAMPLE_TEXT = """
DAILY FLOOD BULLETIN 23-JUL-2026
Rivers at a glance
INDUS Low (Tarbela & Chashma) KABUL Low (Nowshera) JHELUM Below Low
CHENAB High (Khanki & Qadirabad) RAVI Below Low SUTLEJ Below Low
Flood severity scale — and what each level requires
Below Low Low Medium High Very High Exceptionally High
1. RIVERS SITUATION AND QUALITATIVE FLOOD FORECAST
I: HYDROLOGICAL SITUATION at 0600 PST AND OUTLOOK
River Chenab at Khanki and Qadirabad is in High flood level.
River Chenab at Khanki and Qadirabad is in High flood level.
All other major rivers are flowing in their normal flows.
WARNING:
River flows are likely to increase significantly upto 25th July.
Currently High to medium level flows in River Chenab are expected to decrease
during the next 24 hours.
GOVERNMENT OF PAKISTAN MINISTRY OF DEFENCE (DEFENCE DIVISION)
PAKISTAN METEOROLOGICAL DEPARTMENT FLOOD FORECASTING DIVISION
46-JAIL ROAD LAHORE-54000 BULLETIN No: 039/26 Dated: 23rd July-2026
Time: 12:15 hours (PST) www.ffd.pmd.gov.pk | Email: ffdlhr@yahoo.com |
Duty Officer 24/7Hrs: 04299200139, 04299205367-70
All rights reserved — no part may be reproduced without permission. Page 1 of 8
III: WEATHER FORECAST FOR 24-HOURS
Scattered to widespread rain-wind/thunderstorm is expected over upper Punjab.
IV: WEATHER OUTLOOK FOR NEXT 48-HOURS
Wet spell is likely to continue.
GOVERNMENT OF PAKISTAN MINISTRY OF DEFENCE (DEFENCE DIVISION)
Page 2 of 8
"""


def test_extracts_title_number_issue_date_time_and_contact_metadata():
    parsed = parse_ffd_advisory(SAMPLE_TEXT, "https://ffd.pmd.gov.pk/bulletin/1/download")
    assert parsed["title"] == "Daily Flood Bulletin"
    assert parsed["bulletin"] == {
        "number": "039/26",
        "issue_date": "23rd July-2026",
        "issue_time": "12:15 hours (PST)",
        "page": "1 of 8",
        "issuing_department": "Flood Forecasting Division",
        "department": "Pakistan Meteorological Department",
        "division": "Defence Division",
        "office_address": "46-JAIL ROAD LAHORE-54000",
        "email": "ffdlhr@yahoo.com",
        "telephone": "04299200139, 04299205367-70",
    }


def test_extracts_multiple_stations_and_flood_levels_without_invention():
    parsed = parse_ffd_advisory(SAMPLE_TEXT)
    conditions = parsed["river_conditions"]
    assert ("Indus", "Tarbela", "Low") in {
        (row["river"], row["station"], row["level"]) for row in conditions
    }
    assert ("Indus", "Chashma", "Low") in {
        (row["river"], row["station"], row["level"]) for row in conditions
    }
    assert ("Chenab", "Khanki", "High") in {
        (row["river"], row["station"], row["level"]) for row in conditions
    }
    jhelum = next(row for row in conditions if row["river"] == "Jhelum")
    assert jhelum["station"] is None
    assert jhelum["trend"] is None
    assert parsed["highest_reported_level"] == "High"


def test_extracts_multi_river_hydrological_station_groups():
    text = SAMPLE_TEXT.replace(
        "River Chenab at Khanki and Qadirabad is in High flood level.",
        "River Indus at Tarbela and Chashma, river Kabul at Nowshera, "
        "river Chenab at Chiniot Bridge and river Ravi at Balloki "
        "are in Low flood level.",
    )
    parsed = parse_ffd_advisory(text)
    current = {
        (row["river"], row["station"], row["level"])
        for row in parsed["river_conditions"]
        if row["level"]
    }
    assert ("Indus", "Chashma", "Low") in current
    assert ("Kabul", "Nowshera", "Low") in current
    assert ("Chenab", "Chiniot Bridge", "Low") in current
    assert ("Ravi", "Balloki", "Low") in current


def test_extracts_quantitative_forecast_levels_trends_and_flows():
    quantitative = """
    4. QUANTITATIVE FLOOD FORECAST OF GAUGING STATIONS
    RIVERS Stations Actual Observations at 0600 PST Quantitative Forecast for
    Next 24-hrs (Inflow) Qualitative Forecasted Flood Level (Inflow)
    Max Flood Peaks Inflow Outflow Historical Flood Season 2026
    INDUS Chashma 311.3 302.5 310 F 270 Low 1038.9 EH (2010) 313.8
    CHENAB Khanki 261.5 256.1 260 F 160 Medium to High 1086.4 EH (1959) 261.5
    CHENAB Trimmu 94.7 81.3 100 R 140 Below Low 944.3 EH (1928) 94.7
    SUTLEJ Sulemanki 16.9 6.3 No sig. change Below Low 598.9 EH (1955) 19.1
    Spatial: Isolated=20 to 30% of area
    """
    parsed = parse_ffd_advisory(f"{SAMPLE_TEXT} {quantitative}")
    rows = {
        (row["river"], row["station"]): row
        for row in parsed["river_conditions"]
        if row["station"]
    }
    assert rows[("Chenab", "Khanki")]["forecast_level"] == "Medium to High"
    assert rows[("Chenab", "Khanki")]["trend"] == "Decreasing"
    assert rows[("Chenab", "Khanki")]["current_inflow"] == 261.5
    assert rows[("Chenab", "Khanki")]["current_outflow"] == 256.1
    assert rows[("Chenab", "Trimmu")]["trend"] == "Increasing"
    assert rows[("Sutlej", "Sulemanki")]["trend"] == "No significant change"


def test_severity_uses_current_conditions_not_the_flood_scale_legend():
    class Source:
        id = 4

    item = {
        "source_alert_id": "ffd-severity",
        "title": "Flood Forecasting Division Bulletin",
        "description": SAMPLE_TEXT,
        "hazard_type": "flood",
        "issued_at_raw": datetime.now(timezone.utc),
        "source_url": "https://ffd.pmd.gov.pk/bulletin/1/download",
        "raw_text": SAMPLE_TEXT,
        "raw_locations": [],
    }
    [alert] = FFDBulletinScraper(db=None, source=Source()).normalize([item])
    assert "Exceptionally High" in SAMPLE_TEXT
    assert alert.normalized_severity == "high"


def test_separates_forecasts_hydrology_warning_and_removes_page_footer():
    parsed = parse_ffd_advisory(SAMPLE_TEXT)
    assert "upper Punjab" in parsed["rainfall_forecast"]["next_24_hours"]
    assert parsed["rainfall_forecast"]["next_48_hours"] == "Wet spell is likely to continue."
    assert len(parsed["hydrological_summary"]) == 2
    assert "GOVERNMENT OF PAKISTAN" not in parsed["warning"]["text"]
    assert parsed["warning"]["expected_timing"] == [
        "upto 25th July",
        "during the next 24 hours",
    ]
    assert "Chenab" in parsed["warning"]["rivers"]


def test_raw_text_is_not_modified_and_duplicate_hydrology_is_removed():
    original = SAMPLE_TEXT
    parsed = parse_ffd_advisory(original)
    assert SAMPLE_TEXT == original
    assert parsed["hydrological_summary"].count(
        "River Chenab at Khanki and Qadirabad is in High flood level."
    ) == 1


def test_missing_fields_remain_absent_and_malformed_text_has_fallback():
    parsed = parse_ffd_advisory("FLOOD FORECASTING DIVISION damaged PDF text")
    assert parsed["validation_status"] == "partial"
    assert "river conditions" in parsed["missing_sections"]
    assert parsed["bulletin"]["issuing_department"] == "Flood Forecasting Division"
    assert parsed["river_conditions"] == []
    assert parsed["highest_reported_level"] is None
    assert parsed["warning"] is None
    assert parse_ffd_advisory("Unrelated weather advisory") is None


def test_structured_advisory_is_persisted_during_processing(db_session, client):
    source = Source(
        name="FFD Bulletins",
        base_url="https://ffd.pmd.gov.pk/",
        scrape_url="https://ffd.pmd.gov.pk/bulletins",
        source_type="PDF",
        is_active=True,
        polling_interval_minutes=5,
    )
    db_session.add(source)
    db_session.commit()
    alert = AlertCreate(
        source_id=source.id,
        source_alert_id="ffd-structured-test",
        title="Flood Forecasting Division Bulletin",
        description=SAMPLE_TEXT[:500],
        hazard_type="flood",
        normalized_severity="high",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="https://ffd.pmd.gov.pk/bulletin/1/download",
        raw_text=SAMPLE_TEXT,
        content_hash="pending",
    )
    assert AlertProcessor(db_session).process_alerts([alert])["created"] == 1
    stored = db_session.query(Alert).filter_by(
        source_alert_id="ffd-structured-test"
    ).one()
    assert stored.structured_advisory["parser_name"] == "ffd-deterministic-v4"
    assert stored.structured_advisory["bulletin"]["number"] == "039/26"
    response = AlertResponse.model_validate(stored)
    assert response.source.name == "FFD Bulletins"
    assert response.structured_advisory["river_conditions"][0]["river"] == "Indus"
    list_response = client.get("/api/v1/alerts/active")
    listed = next(item for item in list_response.json() if item["id"] == stored.id)
    assert listed["structured_advisory"]["bulletin"]["number"] == "039/26"
    assert listed["raw_text"] is None
    raw_response = client.get(f"/api/v1/alerts/{stored.id}/raw-text")
    assert raw_response.status_code == 200
    assert raw_response.json()["raw_text"] == SAMPLE_TEXT
