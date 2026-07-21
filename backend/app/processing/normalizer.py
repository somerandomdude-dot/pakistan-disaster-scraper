import re
from typing import Dict, Any
from app.schemas.alert import AlertCreate

class Normalizer:
    
    HAZARD_MAPPING = {
        "flood": ["flood", "inundation"],
        "flash_flood": ["flash flood", "flash-flood", "flashflood"],
        "heavy_rain": ["heavy rain", "heavyfalls", "heavy fall", "downpour"],
        "thunderstorm": ["thunderstorm", "thundershower", "lightning", "storm"],
        "cyclone": ["cyclone", "hurricane", "typhoon", "tropical storm"],
        "heatwave": ["heatwave", "heat wave", "extreme heat"],
        "earthquake": ["earthquake", "seismic", "quake"],
        "landslide": ["landslide", "land-slide", "mudslide"],
    }
    
    SEVERITY_MAPPING = {
        "low": ["minor", "advisory", "be aware", "slight"],
        "medium": ["moderate", "warning", "be prepared", "significant"],
        "high": ["severe", "high risk", "major", "danger"],
        "critical": ["extreme", "emergency", "evacuate", "catastrophic"]
    }

    @classmethod
    def normalize_hazard(cls, text: str) -> str:
        text_lower = text.lower()
        for hazard, keywords in cls.HAZARD_MAPPING.items():
            for kw in keywords:
                if kw in text_lower:
                    return hazard
        return "unknown"

    @classmethod
    def normalize_severity(cls, severity: str) -> str:
        if not severity:
            return "unknown"
            
        sev_lower = severity.lower()
        for norm_sev, keywords in cls.SEVERITY_MAPPING.items():
            for kw in keywords:
                if kw in sev_lower:
                    return norm_sev
        return "unknown"

    @classmethod
    def clean_text(cls, text: str) -> str:
        if not text:
            return ""
        # Remove excess whitespace and newlines
        cleaned = re.sub(r'\s+', ' ', text)
        return cleaned.strip()

    @classmethod
    def process(cls, alert: AlertCreate) -> AlertCreate:
        """
        Normalize fields in the AlertCreate object.
        """
        # We can extract better hazard if the official one is generic like "Met" or "Weather"
        combined_text = f"{alert.title} {alert.description}"
        if alert.hazard_type.lower() in ["met", "weather", "unknown", ""]:
            alert.hazard_type = cls.normalize_hazard(combined_text)
        else:
            alert.hazard_type = cls.normalize_hazard(alert.hazard_type)
            
        if alert.official_severity:
            alert.normalized_severity = cls.normalize_severity(alert.official_severity)
        elif not alert.normalized_severity or alert.normalized_severity == "unknown":
            alert.normalized_severity = cls.normalize_severity(combined_text)
            
        alert.title = cls.clean_text(alert.title)
        alert.description = cls.clean_text(alert.description)
        
        return alert
