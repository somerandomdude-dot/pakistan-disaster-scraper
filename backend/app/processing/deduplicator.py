import hashlib
from app.schemas.alert import AlertCreate

class Deduplicator:
    @classmethod
    def generate_hash(cls, alert: AlertCreate) -> str:
        """
        Generate a stable content hash based on important fields.
        Ignores minor text variations.
        """
        # We sort locations to ensure stable hash regardless of order
        locs = sorted([f"{l.province}-{l.district}-{l.city}-{l.raw_location}".lower().strip() for l in alert.locations])
        
        # Important fields
        hash_dict = {
            "source_id": alert.source_id,
            "source_alert_id": alert.source_alert_id,
            "hazard_type": alert.hazard_type,
            "title": alert.title.strip().lower(),
            "locations": locs,
            "issued_at": alert.issued_at.isoformat() if alert.issued_at else None,
            "starts_at": alert.starts_at.isoformat() if alert.starts_at else None,
            "expires_at": alert.expires_at.isoformat() if alert.expires_at else None,
            "normalized_severity": alert.normalized_severity
        }
        
        # We exclude description from the primary hash to avoid minor spacing changes causing updates,
        # but if we want to detect instructions/description changes for revisions, we can include a separate 
        # hash or include it here if we want strict updates. 
        # The prompt says: "Ignore meaningless changes such as extra spaces... Recognize meaningful changes such as instructions changed significantly"
        # We'll clean the description and include it.
        import re
        clean_desc = re.sub(r'\W+', '', alert.description or "").lower()
        hash_dict["description_clean"] = clean_desc

        hash_str = str(hash_dict).encode('utf-8')
        return hashlib.sha256(hash_str).hexdigest()

    @classmethod
    def process(cls, alert: AlertCreate) -> AlertCreate:
        alert.content_hash = cls.generate_hash(alert)
        return alert
