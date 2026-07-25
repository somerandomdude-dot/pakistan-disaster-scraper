from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database.base import Base

class AlertLocation(Base):
    __tablename__ = "alert_locations"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    province = Column(String, nullable=True, index=True)
    district = Column(String, nullable=True, index=True)
    city = Column(String, nullable=True)
    raw_location = Column(String, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    match_confidence = Column(String, nullable=True) # exact, alias, fuzzy, manual
    location_id = Column(String, nullable=True, index=True)
    entity_type = Column(String, nullable=True, index=True)
    canonical_name = Column(String, nullable=True)
    tehsil = Column(String, nullable=True)
    matched_text = Column(String, nullable=True)
    text_source = Column(String, nullable=True)
    match_method = Column(String, nullable=True)
    start_offset = Column(Integer, nullable=True)
    end_offset = Column(Integer, nullable=True)
    evidence_score = Column(Integer, nullable=True)
    
    alert = relationship("Alert", back_populates="locations")
