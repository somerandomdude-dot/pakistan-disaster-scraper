from datetime import datetime
from enum import StrEnum
from typing import Optional

from pydantic import BaseModel, Field


class GeoIPDetectionMethod(StrEnum):
    IP = "ip"
    LOCAL_DEVELOPMENT = "local_development"
    PRIVATE_IP_FALLBACK = "private_ip_fallback"
    GEOIP_NOT_FOUND_FALLBACK = "geoip_not_found_fallback"
    GEOIP_DATABASE_MISSING_FALLBACK = "geoip_database_missing_fallback"
    GEOIP_DATABASE_ERROR_FALLBACK = "geoip_database_error_fallback"
    INVALID_IP_FALLBACK = "invalid_ip_fallback"
    DEFAULT = "default"


class UserLocationResponse(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    city: Optional[str] = None
    subdivision: Optional[str] = None
    country: Optional[str] = None
    country_code: Optional[str] = None
    detection_method: GeoIPDetectionMethod
    is_fallback: bool


class NearbyDistanceBasis(BaseModel):
    location_name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    location_type: str


class NearbyAlertItem(BaseModel):
    id: int
    title: str
    severity: str
    hazard_type: str
    status: str
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    distance_km: float = Field(ge=0)
    source: str
    issued_at: datetime
    distance_basis: NearbyDistanceBasis


class NearbyAlertsPagination(BaseModel):
    limit: int
    offset: int
    returned: int


class NearbyAlertsResponse(BaseModel):
    user_location: UserLocationResponse
    alerts: list[NearbyAlertItem]
    pagination: NearbyAlertsPagination
