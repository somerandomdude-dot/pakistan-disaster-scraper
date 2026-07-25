from sqlalchemy import Column, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database.base import Base


class AlertLocationMention(Base):
    __tablename__ = "alert_location_mentions"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, index=True)
    location_id = Column(String, nullable=True, index=True)
    canonical_name = Column(String, nullable=True)
    entity_type = Column(String, nullable=True, index=True)
    matched_text = Column(String, nullable=False)
    text_source = Column(String, nullable=False)
    match_method = Column(String, nullable=False)
    start_offset = Column(Integer, nullable=False)
    end_offset = Column(Integer, nullable=False)
    evidence_score = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    ignored = Column(Integer, nullable=False, default=0)

    alert = relationship("Alert", back_populates="location_mentions")

