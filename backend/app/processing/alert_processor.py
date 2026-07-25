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
from app.database.models.alert_location_mention import AlertLocationMention
from app.database.models.alert_location_resolution import AlertLocationResolution

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
                alert_data.location_cache_key = matcher_instance.matcher.cache_key(alert_data.content_hash)
                
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

        resolution_record = existing_alert.location_resolution_record
        if (
            existing_alert.content_hash == alert_data.content_hash
            and resolution_record
            and resolution_record.cache_key == alert_data.location_cache_key
        ):
            # Exact duplicate
            return "ignored"
        if existing_alert.content_hash == alert_data.content_hash:
            self._replace_locations(existing_alert, alert_data)
            self._save_resolution(existing_alert, alert_data)
            self.db.commit()
            return "updated"

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
        self._replace_locations(existing_alert, alert_data)
        self._save_resolution(existing_alert, alert_data)

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
        
        self._replace_locations(db_alert, alert_data)
        self._save_resolution(db_alert, alert_data)
        return db_alert

    @staticmethod
    def _location_kwargs(loc):
        return {
            "province": loc.province,
            "district": loc.district,
            "city": loc.city,
            "tehsil": loc.tehsil,
            "raw_location": loc.raw_location,
            "latitude": loc.latitude,
            "longitude": loc.longitude,
            "match_confidence": loc.match_confidence,
            "location_id": loc.location_id,
            "entity_type": loc.entity_type,
            "canonical_name": loc.canonical_name,
            "matched_text": loc.matched_text,
            "text_source": loc.text_source,
            "match_method": loc.match_method,
            "start_offset": loc.start_offset,
            "end_offset": loc.end_offset,
            "evidence_score": loc.evidence_score,
        }

    def _replace_locations(self, db_alert: Alert, alert_data: AlertCreate):
        self.db.query(AlertLocation).filter(AlertLocation.alert_id == db_alert.id).delete()
        for loc in alert_data.locations:
            self.db.add(AlertLocation(alert_id=db_alert.id, **self._location_kwargs(loc)))

    def _save_resolution(self, db_alert: Alert, alert_data: AlertCreate):
        resolution = alert_data.location_resolution or {}
        self.db.query(AlertLocationMention).filter(
            AlertLocationMention.alert_id == db_alert.id
        ).delete()
        ignored_ids = {
            item["location_id"] for item in resolution.get("ignored_entities", [])
        }
        for mention in resolution.get("mentions", []):
            self.db.add(AlertLocationMention(
                alert_id=db_alert.id,
                location_id=mention.get("location_id"),
                canonical_name=mention.get("canonical_name"),
                entity_type=mention.get("entity_type"),
                matched_text=mention.get("matched_text") or "",
                text_source=mention.get("text_source") or "RAW_TEXT",
                match_method=mention.get("match_method") or "NORMALISED_EXACT",
                start_offset=mention.get("start_offset") or 0,
                end_offset=mention.get("end_offset") or 0,
                evidence_score=mention.get("evidence_score") or 0,
                confidence=mention.get("confidence") or 0.0,
                ignored=1 if mention.get("location_id") in ignored_ids else 0,
            ))
        payload = json.dumps(resolution, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        record = db_alert.location_resolution_record
        if record is None:
            record = AlertLocationResolution(alert_id=db_alert.id)
            self.db.add(record)
        record.resolution_json = payload
        record.algorithm_version = resolution.get("algorithm_version", "unknown")
        record.dataset_version = resolution.get("dataset_version", "unknown")
        record.cache_key = alert_data.location_cache_key or ""
