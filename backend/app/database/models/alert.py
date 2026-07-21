from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base import Base

class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey("sources.id"), nullable=False)
    source_alert_id = Column(String, nullable=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    hazard_type = Column(String, nullable=False, index=True)
    official_severity = Column(String, nullable=True)
    normalized_severity = Column(String, nullable=False, index=True)
    
    issued_at = Column(DateTime(timezone=True), nullable=False, index=True)
    starts_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    status = Column(String, nullable=False, default="pending", index=True) # pending, approved, active, expired, cancelled, rejected
    source_url = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True)
    content_hash = Column(String, nullable=False, index=True)
    validation_errors = Column(Text, nullable=True) # JSON array of errors if rejected/incomplete
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    source = relationship("Source")
    locations = relationship("AlertLocation", back_populates="alert", cascade="all, delete-orphan")
    revisions = relationship("AlertRevision", back_populates="alert", cascade="all, delete-orphan")
