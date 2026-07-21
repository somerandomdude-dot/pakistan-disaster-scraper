from app.schemas.alert import AlertCreate
from typing import List, Tuple
import json

class Validator:
    @classmethod
    def validate(cls, alert: AlertCreate) -> Tuple[bool, List[str]]:
        """
        Validates an alert based on rules. 
        Returns (is_valid, list_of_errors)
        """
        errors = []
        
        if not alert.source_id:
            errors.append("Missing source_id")
            
        if not alert.title or not alert.title.strip():
            errors.append("Missing or empty title")
            
        if not alert.issued_at:
            errors.append("Missing issue time (issued_at)")
            
        if not alert.source_url:
            errors.append("Missing source_url")
            
        # At least one location or a clear nationwide advisory
        if not alert.locations:
            # If no explicit locations, check if the text mentions nation-wide
            text = f"{alert.title} {alert.description}".lower()
            if "nationwide" not in text and "across the country" not in text:
                errors.append("No affected locations identified")
                
        if not alert.description and not alert.title:
            errors.append("Missing meaningful description or title")
            
        is_valid = len(errors) == 0
        return is_valid, errors

    @classmethod
    def process(cls, alert: AlertCreate) -> AlertCreate:
        is_valid, errors = cls.validate(alert)
        if not is_valid:
            alert.status = "incomplete"
            alert.validation_errors = json.dumps(errors)
        else:
            # MVP: valid alerts start as pending for review unless already set (e.g. cancelled)
            if not alert.status or alert.status in ["active", "draft"]:
                alert.status = "pending"
            alert.validation_errors = None
            
        return alert
