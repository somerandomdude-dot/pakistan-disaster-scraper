from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, JSON, func
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
    effective_event_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    status = Column(String, nullable=False, default="pending", index=True) # pending, approved, active, expired, cancelled, rejected
    source_url = Column(String, nullable=False)
    raw_text = Column(Text, nullable=True)
    structured_advisory = Column(JSON, nullable=True)
    content_hash = Column(String, nullable=False, index=True)
    validation_errors = Column(Text, nullable=True) # JSON array of errors if rejected/incomplete
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    source = relationship("Source")
    locations = relationship("AlertLocation", back_populates="alert", cascade="all, delete-orphan")
    revisions = relationship("AlertRevision", back_populates="alert", cascade="all, delete-orphan")
    location_mentions = relationship(
        "AlertLocationMention", back_populates="alert", cascade="all, delete-orphan"
    )
    location_resolution_record = relationship(
        "AlertLocationResolution", back_populates="alert", cascade="all, delete-orphan", uselist=False
    )

    @property
    def location_resolution(self):
        return self.location_resolution_record.as_dict() if self.location_resolution_record else None

    @property
    def primary_location(self) -> dict | None:
        res = self.location_resolution
        return res.get("primary_location") if res else None

    @property
    def resolved_district(self) -> str | None:
        primary = self.primary_location
        return primary.get("district") if primary else None

    @property
    def resolved_city(self) -> str | None:
        primary = self.primary_location
        return primary.get("city") if primary else None

    @property
    def resolved_province(self) -> str | None:
        primary = self.primary_location
        return primary.get("province") if primary else None

    @property
    def latitude(self) -> float | None:
        primary = self.primary_location
        return primary.get("latitude") if primary else None

    @property
    def longitude(self) -> float | None:
        primary = self.primary_location
        return primary.get("longitude") if primary else None

    @property
    def resolution_source(self) -> str | None:
        primary = self.primary_location
        return primary.get("source") if primary else None

    @property
    def resolution_confidence(self) -> str | None:
        primary = self.primary_location
        return primary.get("confidence") if primary else None

    @property
    def is_inferred(self) -> bool | None:
        primary = self.primary_location
        return primary.get("is_inferred") if primary else None
