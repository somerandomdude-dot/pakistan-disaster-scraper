from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base import Base

class RawDocument(Base):
    __tablename__ = "raw_documents"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    content_type = Column(String, nullable=False)
    content_hash = Column(String, index=True, nullable=False)
    raw_text = Column(Text, nullable=True)  # Can be empty if large PDF, saved locally instead
    local_file_path = Column(String, nullable=True) # Path to locally saved raw response or PDF
    retrieved_at = Column(DateTime(timezone=True), nullable=False)
    http_status = Column(Integer, nullable=True)
    parsing_status = Column(String, nullable=False, default="pending") # pending, success, failed
    parsing_error = Column(Text, nullable=True)
    
    source = relationship("Source")
