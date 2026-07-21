import logging
import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.schemas.alert import AlertCreate
from app.database.models.alert import Alert
from app.database.models.alert_location import AlertLocation
from app.database.models.alert_revision import AlertRevision
from app.database.models.raw_document import RawDocument

from app.processing.normalizer import Normalizer
from app.processing.validator import Validator
from app.processing.location_matcher import matcher_instance
from app.processing.deduplicator import Deduplicator
from app.services.text_export_service import TextExportService

logger = logging.getLogger(__name__)

class AlertProcessor:
    def __init__(self, db: Session):
        self.db = db

    def process_alerts(self, alerts: List[AlertCreate], raw_document: RawDocument = None) -> Dict[str, int]:
        """
        Process a list of scraped alerts through the full pipeline.
        Returns statistics on created, updated, ignored, and rejected.
        """
        stats = {"created": 0, "updated": 0, "ignored": 0, "incomplete": 0, "rejected": 0}

        for alert_data in alerts:
            try:
                # 1. Normalize
                alert_data = Normalizer.process(alert_data)
                
                # 2. Location Matching
                alert_data = matcher_instance.process(alert_data)
                
                # 3. Validation
                alert_data = Validator.process(alert_data)
                
                if alert_data.status == "rejected":
                    stats["rejected"] += 1
                    continue
                elif alert_data.status == "incomplete":
                    stats["incomplete"] += 1
                    # We still store incomplete alerts for review, but don't publish them
                    
                # 4. Deduplication / Hash Generation
                alert_data = Deduplicator.process(alert_data)
                
                # 5. Database interaction
                result = self._save_alert(alert_data, raw_document)
                stats[result] += 1
                
            except Exception as e:
                logger.error(f"Error processing alert {alert_data.source_alert_id}: {e}", exc_info=True)
                stats["rejected"] += 1
                self.db.rollback() # Rollback on individual failure to avoid breaking whole batch

        return stats

    def _save_alert(self, alert_data: AlertCreate, raw_document: RawDocument = None) -> str:
        """
        Check for duplicates, handle revisions, and save to DB.
        Returns the action taken: "created", "updated", or "ignored".
        """
        # Look for existing alert
        query = self.db.query(Alert).filter(Alert.source_id == alert_data.source_id)
        
        if alert_data.source_alert_id:
            query = query.filter(Alert.source_alert_id == alert_data.source_alert_id)
        else:
            # Fallback matching for sources without unique IDs
            query = query.filter(
                Alert.title == alert_data.title,
                Alert.issued_at == alert_data.issued_at
            )
            
        existing_alert = query.first()

        if not existing_alert:
            # Create new
            new_alert = self._create_db_alert(alert_data)
            self.db.commit()
            try:
                TextExportService.export_alert(self.db, new_alert, action="CREATED")
            except Exception as e:
                logger.error(f"Error calling text export service for alert {new_alert.id}: {e}")
            return "created"

        if existing_alert.content_hash == alert_data.content_hash:
            # Exact duplicate
            return "ignored"

        # Content changed, update existing and create revision
        changed_fields = []
        if existing_alert.description != alert_data.description:
            changed_fields.append("description")
        if existing_alert.normalized_severity != alert_data.normalized_severity:
            changed_fields.append("severity")
        if existing_alert.expires_at != alert_data.expires_at:
            changed_fields.append("expires_at")
        if not changed_fields:
            # some minor change caused hash mismatch, maybe locations
            changed_fields.append("locations_or_minor")

        # Create Revision Record
        revision = AlertRevision(
            alert_id=existing_alert.id,
            changed_fields=json.dumps(changed_fields),
            previous_content_hash=existing_alert.content_hash,
            new_content_hash=alert_data.content_hash,
            raw_document_id=raw_document.id if raw_document else None
        )
        self.db.add(revision)

        # Update fields
        existing_alert.title = alert_data.title
        existing_alert.description = alert_data.description
        existing_alert.hazard_type = alert_data.hazard_type
        existing_alert.official_severity = alert_data.official_severity
        existing_alert.normalized_severity = alert_data.normalized_severity
        existing_alert.issued_at = alert_data.issued_at
        existing_alert.starts_at = alert_data.starts_at
        existing_alert.expires_at = alert_data.expires_at
        existing_alert.status = alert_data.status
        existing_alert.raw_text = alert_data.raw_text
        existing_alert.content_hash = alert_data.content_hash
        existing_alert.validation_errors = alert_data.validation_errors

        # Update locations (replace)
        self.db.query(AlertLocation).filter(AlertLocation.alert_id == existing_alert.id).delete()
        for loc in alert_data.locations:
            db_loc = AlertLocation(
                alert_id=existing_alert.id,
                province=loc.province,
                district=loc.district,
                city=loc.city,
                raw_location=loc.raw_location,
                latitude=loc.latitude,
                longitude=loc.longitude,
                match_confidence=loc.match_confidence
            )
            self.db.add(db_loc)

        self.db.commit()
        try:
            TextExportService.export_alert(self.db, existing_alert, action="UPDATED")
        except Exception as e:
            logger.error(f"Error calling text export service for updated alert {existing_alert.id}: {e}")
        return "updated"

    def _create_db_alert(self, alert_data: AlertCreate):
        db_alert = Alert(
            source_id=alert_data.source_id,
            source_alert_id=alert_data.source_alert_id,
            title=alert_data.title,
            description=alert_data.description,
            hazard_type=alert_data.hazard_type,
            official_severity=alert_data.official_severity,
            normalized_severity=alert_data.normalized_severity,
            issued_at=alert_data.issued_at,
            starts_at=alert_data.starts_at,
            expires_at=alert_data.expires_at,
            status=alert_data.status,
            source_url=alert_data.source_url,
            raw_text=alert_data.raw_text,
            content_hash=alert_data.content_hash,
            validation_errors=alert_data.validation_errors
        )
        self.db.add(db_alert)
        self.db.flush() # Get ID
        
        for loc in alert_data.locations:
            db_loc = AlertLocation(
                alert_id=db_alert.id,
                province=loc.province,
                district=loc.district,
                city=loc.city,
                raw_location=loc.raw_location,
                latitude=loc.latitude,
                longitude=loc.longitude,
                match_confidence=loc.match_confidence
            )
            self.db.add(db_loc)
        return db_alert
