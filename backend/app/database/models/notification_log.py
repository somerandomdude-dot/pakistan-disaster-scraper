from sqlalchemy import Column, Integer, String, DateTime, Text, func
from app.database.base import Base

class NotificationLog(Base):
    __tablename__ = "notification_logs"

    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, nullable=False) # INFO, WARNING, ERROR, CRITICAL
    source = Column(String, nullable=False) # Scraper name, System, etc.
    message = Column(Text, nullable=False)
    details = Column(Text, nullable=True) # JSON details
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
