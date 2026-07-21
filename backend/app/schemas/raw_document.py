from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional

class RawDocumentBase(BaseModel):
    url: str
    content_type: str
    content_hash: str
    raw_text: Optional[str] = None
    local_file_path: Optional[str] = None
    retrieved_at: datetime
    http_status: Optional[int] = None
    parsing_status: str = "pending"
    parsing_error: Optional[str] = None

class RawDocumentCreate(RawDocumentBase):
    source_id: int

class RawDocument(RawDocumentBase):
    id: int
    source_id: int

    model_config = ConfigDict(from_attributes=True)
