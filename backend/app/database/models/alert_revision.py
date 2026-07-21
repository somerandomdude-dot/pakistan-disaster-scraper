from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, func
from sqlalchemy.orm import relationship
from app.database.base import Base

class AlertRevision(Base):
    __tablename__ = "alert_revisions"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), nullable=False)
    changed_fields = Column(Text, nullable=False) # JSON array of field names that changed
    previous_content_hash = Column(String, nullable=False)
    new_content_hash = Column(String, nullable=False)
    raw_document_id = Column(Integer, ForeignKey("raw_documents.id"), nullable=True) # The document that caused this revision
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    alert = relationship("Alert", back_populates="revisions")
