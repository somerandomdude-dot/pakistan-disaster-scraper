from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, func
from app.database.base import Base
import datetime

class Source(Base):
    __tablename__ = "sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    base_url = Column(String, nullable=False)
    scrape_url = Column(String, nullable=False)
    source_type = Column(String, nullable=False)  # HTML, JSON, RSS, PDF
    is_active = Column(Boolean, default=True)
    polling_interval_minutes = Column(Integer, nullable=False)
    
    last_checked_at = Column(DateTime(timezone=True), nullable=True)
    last_success_at = Column(DateTime(timezone=True), nullable=True)
    last_error = Column(Text, nullable=True)
    consecutive_failures = Column(Integer, default=0)
    health_status = Column(String, default="healthy") # healthy, failing, unhealthy
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
