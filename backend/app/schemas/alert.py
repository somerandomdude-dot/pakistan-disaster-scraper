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
    status: str
    source_url: str
    raw_text: Optional[str] = None
    content_hash: str
    validation_errors: Optional[str] = None

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

    model_config = ConfigDict(from_attributes=True)
