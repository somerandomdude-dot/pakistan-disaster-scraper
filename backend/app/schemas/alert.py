from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List

class AlertLocationBase(BaseModel):
    province: Optional[str] = None
    district: Optional[str] = None
    city: Optional[str] = None
    raw_location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    match_confidence: Optional[str] = None

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
    locations: List[AlertLocationCreate] = []

class Alert(AlertBase):
    id: int
    source_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    locations: List[AlertLocation] = []

    model_config = ConfigDict(from_attributes=True)
