import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.schemas.nearby_alert import NearbyAlertsPagination, NearbyAlertsResponse
from app.services.client_ip_service import extract_client_ip
from app.services.geoip_service import GeoIPService, geoip_service
from app.services.nearby_alert_service import NearbyAlertService

logger = logging.getLogger(__name__)
router = APIRouter()


def get_geoip_service(request: Request) -> GeoIPService:
    return getattr(request.app.state, "geoip_service", geoip_service)


@router.get("/nearby", response_model=NearbyAlertsResponse)
def get_nearby_alerts(
    request: Request,
    radius_km: Annotated[
        float | None,
        Query(ge=1, le=settings.NEARBY_ALERT_MAX_RADIUS_KM),
    ] = settings.NEARBY_ALERT_DEFAULT_RADIUS_KM,
    limit: Annotated[
        int,
        Query(ge=1, le=settings.NEARBY_ALERT_MAX_LIMIT),
    ] = settings.NEARBY_ALERT_DEFAULT_LIMIT,
    offset: Annotated[int, Query(ge=0)] = 0,
    severity: Annotated[str | None, Query(min_length=1, max_length=50)] = None,
    hazard_type: Annotated[str | None, Query(min_length=1, max_length=100)] = None,
    status: Annotated[str | None, Query(min_length=1, max_length=50)] = None,
    source: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    db: Session = Depends(get_db),
    locator: GeoIPService = Depends(get_geoip_service),
) -> NearbyAlertsResponse:
    client_ip = extract_client_ip(request, settings)
    user_location = locator.resolve(client_ip)

    try:
        alerts = NearbyAlertService(db).find(
            user_lat=user_location.latitude,
            user_lng=user_location.longitude,
            radius_km=radius_km,
            limit=limit,
            offset=offset,
            severity=severity,
            hazard_type=hazard_type,
            status=status,
            source=source,
        )
    except Exception:
        logger.exception("Nearby-alert database query failed")
        raise HTTPException(
            status_code=500,
            detail="Nearby alerts are temporarily unavailable.",
        ) from None

    return NearbyAlertsResponse(
        user_location=user_location.to_response(),
        alerts=alerts,
        pagination=NearbyAlertsPagination(
            limit=limit,
            offset=offset,
            returned=len(alerts),
        ),
    )
