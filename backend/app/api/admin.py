from fastapi import APIRouter, Depends, HTTPException, Header, BackgroundTasks
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database.session import get_db
from app.core.config import settings
from app.database.models.alert import Alert
from app.database.models.source import Source
from app.schemas.alert import Alert as AlertSchema

from app.scrapers.pmd_weather import PMDWeatherScraper
from app.scrapers.ndma_advisories import NDMAScraper
from app.scrapers.ffd_bulletins import FFDBulletinScraper
from app.scrapers.pmd_earthquake import PMDEarthquakeScraper
from app.processing.alert_processor import AlertProcessor

router = APIRouter()

def verify_admin_token(x_admin_api_key: str = Header(...)):
    if x_admin_api_key != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid admin API key")

@router.get("/alerts/pending", response_model=List[AlertSchema], dependencies=[Depends(verify_admin_token)])
def get_pending_alerts(db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.status == "pending").all()

@router.post("/alerts/{alert_id}/approve", dependencies=[Depends(verify_admin_token)])
def approve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "active"
    db.commit()
    return {"message": "Alert approved", "alert_id": alert.id}

@router.post("/alerts/{alert_id}/reject", dependencies=[Depends(verify_admin_token)])
def reject_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.status = "rejected"
    db.commit()
from app.services.text_export_service import TextExportService

@router.post("/alerts/{alert_id}/export", dependencies=[Depends(verify_admin_token)])
def regenerate_alert_export(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    path = TextExportService.export_alert(db, alert, action="REGENERATED")
    if not path:
        raise HTTPException(status_code=500, detail="Failed to generate alert text export")
        
    return {"message": "Export regenerated successfully", "alert_id": alert.id, "export_path": path}

async def run_scraper_task(source_id: int, db: Session):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        return
        
    scraper_cls = None
    if source.name == "PMD Weather":
        scraper_cls = PMDWeatherScraper
    elif "NDMA" in source.name:
        scraper_cls = NDMAScraper
    elif "Earthquake" in source.name or "Seismic" in source.name:
        scraper_cls = PMDEarthquakeScraper
    elif "FFD" in source.name or "Flood" in source.name:
        scraper_cls = FFDBulletinScraper
    
    if not scraper_cls:
        return
        
    scraper = scraper_cls(db, source)
    try:
        normalized_alerts = await scraper.run()
        if normalized_alerts:
            processor = AlertProcessor(db)
            stats = processor.process_alerts(normalized_alerts)
            
        source.last_success_at = datetime.now(timezone.utc)
        source.consecutive_failures = 0
        source.health_status = "healthy"
        source.last_error = None
    except Exception as e:
        source.consecutive_failures += 1
        source.last_error = str(e)
        if source.consecutive_failures >= 3:
            source.health_status = "unhealthy"
    finally:
        source.last_checked_at = datetime.now(timezone.utc)
        db.commit()

@router.post("/sources/{source_id}/run", dependencies=[Depends(verify_admin_token)])
async def trigger_source_scrape(source_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    source = db.query(Source).filter(Source.id == source_id).first()
    if not source:
        raise HTTPException(status_code=404, detail="Source not found")
        
    # Run synchronously for MVP testing so we get immediate results,
    # or background. We'll await it directly to ensure tests can see it.
    await run_scraper_task(source_id, db)
    return {"message": "Scraper executed for source", "source_id": source_id}
