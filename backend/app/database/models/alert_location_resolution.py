import json

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from app.database.base import Base


class AlertLocationResolution(Base):
    __tablename__ = "alert_location_resolutions"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    resolution_json = Column(Text, nullable=False)
    algorithm_version = Column(String, nullable=False)
    dataset_version = Column(String, nullable=False)
    cache_key = Column(String, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    alert = relationship("Alert", back_populates="location_resolution_record")

    def as_dict(self):
        return json.loads(self.resolution_json)

