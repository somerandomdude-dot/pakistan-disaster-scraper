from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.database.session import get_db
from app.database.models.alert import Alert
from app.database.models.alert_location import AlertLocation
from app.schemas.alert import Alert as AlertSchema

router = APIRouter()

@router.get("/active", response_model=List[AlertSchema])
def get_active_alerts(
    province: Optional[str] = None,
    district: Optional[str] = None,
    hazard_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(50, le=100),
    db: Session = Depends(get_db)
):
    query = db.query(Alert).filter(Alert.status.in_(["active", "pending"]))
    # Pending is included for MVP since approval workflow is manual
    
    # Filter out expired alerts
    now = datetime.now(timezone.utc)
    query = query.filter((Alert.expires_at == None) | (Alert.expires_at > now))
    
    if hazard_type:
        query = query.filter(Alert.hazard_type == hazard_type)
    if severity:
        query = query.filter(Alert.normalized_severity == severity)
        
    if province or district:
        query = query.join(Alert.locations)
        if province:
            query = query.filter(AlertLocation.province == province)
        if district:
            query = query.filter(AlertLocation.district == district)
            
    alerts = query.order_by(Alert.issued_at.desc()).limit(limit).all()
    return alerts

@router.get("/history", response_model=List[AlertSchema])
def get_alert_history(limit: int = Query(100, le=500), db: Session = Depends(get_db)):
    alerts = db.query(Alert).order_by(Alert.issued_at.desc()).limit(limit).all()
    return alerts

from fastapi.responses import Response
import os
from app.services.text_export_service import TextExportService, LATEST_DIR

@router.get("/{alert_id}/export")
def get_alert_text_export(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
        
    export_path = TextExportService.get_latest_export_path(alert_id)
    if not export_path or not os.path.exists(export_path):
        raise HTTPException(status_code=404, detail="Export file not found for this alert")
        
    abs_export = os.path.abspath(export_path)
    abs_latest = os.path.abspath(LATEST_DIR)
    if not abs_export.startswith(abs_latest):
        raise HTTPException(status_code=403, detail="Access denied")
        
    with open(abs_export, "r", encoding="ascii", errors="ignore") as f:
        content = f.read()
        
    return Response(content=content, media_type="text/plain")

@router.get("/{alert_id}", response_model=AlertSchema)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
