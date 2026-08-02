from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, func
from typing import List, Optional
from datetime import datetime, timezone
from app.database.session import get_db
from app.database.models.alert import Alert
from app.database.models.alert_location import AlertLocation
from app.database.models.source import Source
from app.schemas.alert import (
    Alert as AlertSchema,
    AlertRawText,
    AlertMapItem,
    AlertMapResponse,
    AlertLocation as AlertLocationSchema,
)
from app.services.alert_time import (
    compute_rolling_cutoff,
    get_effective_alert_timestamp,
    format_pakistan_window_label,
    is_valid_pakistan_coordinate,
)

router = APIRouter()

# Severity ordering used for client-side sort hint (returned in X-Severity-Order header)
SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "unknown": 4}


@router.get("/map", response_model=AlertMapResponse)
def get_map_alerts(
    days: int = Query(7, ge=1, le=90, description="Rolling window in days (default 7)"),
    hours: Optional[int] = Query(None, ge=1, le=2160, description="Rolling window in hours"),
    issued_from: Optional[datetime] = Query(None, description="Optional custom reference datetime"),
    province: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    hazard_type: Optional[str] = None,
    severity: Optional[str] = None,
    source: Optional[str] = None,
    status: Optional[str] = None,
    show_cancelled: bool = Query(False, description="Include cancelled alerts if True"),
    limit: int = Query(500, le=1000),
    db: Session = Depends(get_db),
):
    """
    Return disaster alerts strictly within the rolling window (default: 7 days / 168 hours).
    Older alerts and invalid/rejected records are excluded.
    Only includes alerts with valid geographical coordinates in Pakistan.
    """
    window_days = (hours / 24.0) if hours is not None else float(days)
    cutoff_utc, max_future_utc = compute_rolling_cutoff(
        reference_time=issued_from, days=window_days
    )

    query = db.query(Alert).options(
        selectinload(Alert.locations),
        selectinload(Alert.location_resolution_record),
        selectinload(Alert.source),
    )

    # Exclude rejected/invalid alerts
    query = query.filter(Alert.status.not_in(["rejected", "invalid"]))

    # Exclude cancelled by default
    if not show_cancelled:
        query = query.filter(Alert.status != "cancelled")

    if status:
        query = query.filter(Alert.status == status)

    if hazard_type:
        query = query.filter(Alert.hazard_type == hazard_type)

    if severity:
        query = query.filter(Alert.normalized_severity == severity)

    if source:
        query = query.join(Alert.source).filter(
            or_(Source.name.ilike(f"%{source}%"), Source.source_type.ilike(f"%{source}%"))
        )

    # Rolling window filter using effective timestamp fallback
    effective_expr = func.coalesce(
        Alert.effective_event_at, Alert.issued_at, Alert.starts_at, Alert.created_at
    )
    query = query.filter(effective_expr >= cutoff_utc, effective_expr <= max_future_utc)

    if province or district or city:
        query = query.join(Alert.locations)
        if province:
            query = query.filter(AlertLocation.province.ilike(f"%{province}%"))
        if district:
            query = query.filter(AlertLocation.district.ilike(f"%{district}%"))
        if city:
            query = query.filter(AlertLocation.city.ilike(f"%{city}%"))

    alerts_db = query.order_by(effective_expr.desc()).limit(limit).all()

    map_items: list[AlertMapItem] = []
    for a in alerts_db:
        eff_dt = a.effective_event_at or get_effective_alert_timestamp(a)
        if not eff_dt or eff_dt < cutoff_utc or eff_dt > max_future_utc:
            continue

        # Find primary coordinates
        lat = a.latitude
        lng = a.longitude
        if not is_valid_pakistan_coordinate(lat, lng):
            # Fallback to first valid location item
            valid_loc = next(
                (
                    loc
                    for loc in (a.locations or [])
                    if is_valid_pakistan_coordinate(loc.latitude, loc.longitude)
                ),
                None,
            )
            if valid_loc:
                lat = valid_loc.latitude
                lng = valid_loc.longitude
            else:
                # No valid coordinates in Pakistan, skip from map
                continue

        source_name = a.source.name if a.source else "Official Source"
        map_items.append(
            AlertMapItem(
                id=a.id,
                alert_id=a.id,
                title=a.title,
                description=a.description,
                hazard_type=a.hazard_type,
                official_severity=a.official_severity,
                normalized_severity=a.normalized_severity,
                status=a.status,
                source_name=source_name,
                source_url=a.source_url or "",
                effective_event_at=eff_dt,
                issued_at=a.issued_at,
                starts_at=a.starts_at,
                expires_at=a.expires_at,
                latitude=float(lat),
                longitude=float(lng),
                province=a.resolved_province or (a.locations[0].province if a.locations else None),
                district=a.resolved_district or (a.locations[0].district if a.locations else None),
                city=a.resolved_city or (a.locations[0].city if a.locations else None),
                is_inferred=a.is_inferred,
                resolution_source=a.resolution_source,
                resolution_confidence=a.resolution_confidence,
                locations=[
                    AlertLocationSchema.model_validate(loc) for loc in (a.locations or [])
                ],
            )
        )

    # Sort map items by severity then newest first
    map_items.sort(
        key=lambda m: (
            SEVERITY_ORDER.get(m.normalized_severity, 99),
            -(m.effective_event_at.timestamp() if m.effective_event_at else 0),
        )
    )

    return AlertMapResponse(
        days=int(window_days),
        window_start_utc=cutoff_utc,
        window_end_utc=max_future_utc,
        window_label_pkt=format_pakistan_window_label(reference_time=issued_from, days=window_days),
        total_count=len(map_items),
        alerts=map_items,
    )


def _list_payload(alerts: list[Alert]) -> list[AlertSchema]:
    """Keep large raw documents out of list polling responses."""
    return [
        AlertSchema.model_validate(alert).model_copy(update={"raw_text": None})
        for alert in alerts
    ]


@router.get("/active", response_model=List[AlertSchema])
def get_active_alerts(
    province: Optional[str] = None,
    district: Optional[str] = None,
    hazard_type: Optional[str] = None,
    severity: Optional[str] = None,
    search: Optional[str] = Query(None, description="Full-text search across title and description"),
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
):
    """
    Return currently active/pending alerts.
    Filters: province, district, hazard_type, severity, search (title/description).
    Expired alerts are excluded automatically.
    Results are sorted by severity (critical → low) then newest first.
    """
    query = db.query(Alert).options(
        selectinload(Alert.locations),
        selectinload(Alert.location_resolution_record),
        selectinload(Alert.source),
    ).filter(Alert.status.in_(["active", "pending"]))

    # Filter out expired alerts
    now = datetime.now(timezone.utc)
    query = query.filter((Alert.expires_at == None) | (Alert.expires_at > now))

    if hazard_type:
        query = query.filter(Alert.hazard_type == hazard_type)
    if severity:
        query = query.filter(Alert.normalized_severity == severity)

    # Full-text search across title and description
    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(Alert.title.ilike(term), Alert.description.ilike(term))
        )

    if province or district:
        query = query.join(Alert.locations)
        if province:
            query = query.filter(AlertLocation.province == province)
        if district:
            query = query.filter(AlertLocation.district == district)

    alerts = query.order_by(Alert.issued_at.desc()).limit(limit).all()

    # Secondary in-Python sort: critical → high → medium → low → unknown
    alerts.sort(key=lambda a: (SEVERITY_ORDER.get(a.normalized_severity or "unknown", 99), -(a.issued_at.timestamp() if a.issued_at else 0)))
    return _list_payload(alerts)


@router.get("/history", response_model=List[AlertSchema])
def get_alert_history(
    limit: int = Query(100, le=500),
    hazard_type: Optional[str] = None,
    search: Optional[str] = Query(None, description="Full-text search across title and description"),
    db: Session = Depends(get_db),
):
    """Return all alerts regardless of status/expiry — useful for historical review."""
    query = db.query(Alert).options(
        selectinload(Alert.locations),
        selectinload(Alert.location_resolution_record),
        selectinload(Alert.source),
    )

    if hazard_type:
        query = query.filter(Alert.hazard_type == hazard_type)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(Alert.title.ilike(term), Alert.description.ilike(term))
        )

    alerts = query.order_by(Alert.issued_at.desc()).limit(limit).all()
    return _list_payload(alerts)


from fastapi.responses import Response
import os
from app.services.text_export_service import TextExportService, LATEST_DIR


@router.get("/{alert_id}/raw-text", response_model=AlertRawText)
def get_alert_raw_text(alert_id: int, db: Session = Depends(get_db)):
    row = db.query(Alert.id, Alert.raw_text).filter(Alert.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")
    return AlertRawText(alert_id=row.id, raw_text=row.raw_text)


@router.get("/{alert_id}/export")
def get_alert_text_export(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).options(
        selectinload(Alert.locations),
        selectinload(Alert.location_resolution_record),
        selectinload(Alert.source),
    ).filter(Alert.id == alert_id).first()
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
    alert = db.query(Alert).options(
        selectinload(Alert.locations),
        selectinload(Alert.location_resolution_record),
        selectinload(Alert.source),
    ).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert
