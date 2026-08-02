from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Any, Optional, List
from pydantic import Field

class AlertLocationBase(BaseModel):
    province: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    raw_location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    match_confidence: Optional[str] = None
    location_id: Optional[str] = None
    entity_type: Optional[str] = None
    canonical_name: Optional[str] = None
    tehsil: Optional[str] = None
    matched_text: Optional[str] = None
    text_source: Optional[str] = None
    match_method: Optional[str] = None
    start_offset: Optional[int] = None
    end_offset: Optional[int] = None
    evidence_score: Optional[int] = None

class AlertLocationCreate(AlertLocationBase):
    pass

class AlertLocation(AlertLocationBase):
    id: int
    alert_id: int

    model_config = ConfigDict(from_attributes=True)

class AlertBase(BaseModel):
    source_alert_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    hazard_type: str
    official_severity: Optional[str] = None
    normalized_severity: str
    issued_at: datetime
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    effective_event_at: Optional[datetime] = None
    status: str
    source_url: str
    raw_text: Optional[str] = None
    structured_advisory: Optional[dict[str, Any]] = None
    content_hash: str
    validation_errors: Optional[str] = None
    resolved_district: Optional[str] = None
    resolved_city: Optional[str] = None
    resolved_province: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    resolution_source: Optional[str] = None
    resolution_confidence: Optional[str] = None
    is_inferred: Optional[bool] = None

class AlertCreate(AlertBase):
    source_id: int
    locations: List[AlertLocationCreate] = Field(default_factory=list)
    location_resolution: Optional[dict[str, Any]] = None
    location_cache_key: Optional[str] = None

class Alert(AlertBase):
    id: int
    source_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    locations: List[AlertLocation] = Field(default_factory=list)
    location_resolution: Optional[dict[str, Any]] = None
    primary_location: Optional[dict[str, Any]] = None
    source: Optional["AlertSource"] = None

    model_config = ConfigDict(from_attributes=True)


class AlertSource(BaseModel):
    name: str
    base_url: str

    model_config = ConfigDict(from_attributes=True)


class AlertMapItem(BaseModel):
    id: int
    alert_id: int
    title: str
    description: Optional[str] = None
    hazard_type: str
    official_severity: Optional[str] = None
    normalized_severity: str
    status: str
    source_name: str
    source_url: str
    effective_event_at: datetime
    issued_at: Optional[datetime] = None
    starts_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    latitude: float
    longitude: float
    province: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    is_inferred: Optional[bool] = None
    resolution_source: Optional[str] = None
    resolution_confidence: Optional[str] = None
    locations: List[AlertLocation] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class AlertMapResponse(BaseModel):
    days: int
    window_start_utc: datetime
    window_end_utc: datetime
    window_label_pkt: str
    total_count: int
    alerts: List[AlertMapItem]


Alert.model_rebuild()


class AlertRawText(BaseModel):
    alert_id: int
    raw_text: Optional[str] = None

