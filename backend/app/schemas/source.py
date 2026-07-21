from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class SourceBase(BaseModel):
    name: str
    base_url: str
    scrape_url: str
    source_type: str
    is_active: bool = True
    polling_interval_minutes: int

class SourceCreate(SourceBase):
    pass

class Source(SourceBase):
    id: int
    last_checked_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    last_error: Optional[str] = None
    consecutive_failures: int
    health_status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
