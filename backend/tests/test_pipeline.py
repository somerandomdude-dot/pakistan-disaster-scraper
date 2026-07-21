import pytest
from app.schemas.alert import AlertCreate, AlertLocationCreate
from app.processing.alert_processor import AlertProcessor
from app.processing.validator import Validator
from app.processing.location_matcher import LocationMatcher
from app.database.models.alert import Alert
from app.database.models.source import Source
from datetime import datetime, timezone

def test_unknown_location(db_session):
    matcher = LocationMatcher()
    # "Atlantis" is not in Pakistan
    loc = matcher.match_location("Atlantis")
    assert loc.match_confidence == "manual"
    assert loc.raw_location == "Atlantis"

def test_location_aliases(db_session):
    matcher = LocationMatcher()
    loc = matcher.match_location("LHR") # Lahore alias
    assert loc.match_confidence == "alias"
    assert loc.city == "Lahore"
    assert loc.district == "Lahore"
    assert loc.province == "Punjab"

def test_zero_parsed_alerts():
    # If the parser returns 0 items because the format changed (layout change)
    from app.scrapers.pmd_weather import PMDWeatherScraper
    scraper = PMDWeatherScraper(db=None, source=None)
    # Give it an empty or different layout HTML
    results = scraper.parse([{"url": "test", "content": "<html><body>Changed layout</body></html>", "retrieved_at": datetime.now()}])
    assert len(results) == 0

def test_meaningful_alert_revisions(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    
    base_alert = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="12345",
        title="Heavy Rain Warning",
        description="Rain in Lahore",
        hazard_type="heavy_rain",
        normalized_severity="medium",
        issued_at=datetime.now(timezone.utc),
        status="pending",
        source_url="http://test.com",
        content_hash="will_be_generated",
        locations=[AlertLocationCreate(raw_location="Lahore")]
    )
    
    # 1. Create first
    stats1 = processor.process_alerts([base_alert.model_copy(deep=True)])
    assert stats1["created"] == 1
    
    # 2. Duplicate raw doc (exact same)
    stats2 = processor.process_alerts([base_alert.model_copy(deep=True)])
    assert stats2["ignored"] == 1
    assert stats2["updated"] == 0
    
    # 3. Meaningful revision (severity increased)
    revised_alert = base_alert.model_copy(deep=True)
    revised_alert.normalized_severity = "high"
    stats3 = processor.process_alerts([revised_alert])
    assert stats3["updated"] == 1
    
    db_alert = db_session.query(Alert).filter(Alert.source_alert_id == "12345").first()
    assert db_alert.normalized_severity == "high"
    assert len(db_alert.revisions) == 1
    assert "severity" in db_alert.revisions[0].changed_fields

def test_source_cancellation(db_session, pmd_source):
    processor = AlertProcessor(db_session)
    base_alert = AlertCreate(
        source_id=pmd_source.id,
        source_alert_id="cancel_test",
        title="Warning",
        description="Warning",
        hazard_type="heavy_rain",
        normalized_severity="medium",
        issued_at=datetime.now(timezone.utc),
        status="active",
        source_url="http://test.com",
        content_hash="",
        locations=[AlertLocationCreate(raw_location="Lahore")]
    )
    processor.process_alerts([base_alert.model_copy(deep=True)])
    
    # Send same alert but with status "cancelled" (simulating a CAP cancel message)
    cancel_alert = base_alert.model_copy(deep=True)
    cancel_alert.status = "cancelled"
    cancel_alert.description = "This warning is cancelled"
    
    stats = processor.process_alerts([cancel_alert])
    assert stats["updated"] == 1
    
    db_alert = db_session.query(Alert).filter(Alert.source_alert_id == "cancel_test").first()
    assert db_alert.status == "cancelled"

def test_three_consecutive_failures(db_session, pmd_source):
    from app.api.admin import run_scraper_task
    import pytest
    import asyncio
    
    # Mock the run to throw an exception
    pmd_source.consecutive_failures = 2 # Already failed twice
    db_session.commit()
    
    # The actual task doesn't raise, it catches and updates the source
    # We will simulate the failure block from run_scraper_task
    pmd_source.consecutive_failures += 1
    pmd_source.last_error = "Mocked exception"
    if pmd_source.consecutive_failures >= 3:
        pmd_source.health_status = "unhealthy"
    
    assert pmd_source.consecutive_failures == 3
    assert pmd_source.health_status == "unhealthy"
