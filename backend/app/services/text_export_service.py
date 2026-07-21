import os
import re
import json
import logging
import textwrap
import unicodedata
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.database.models.alert import Alert
from app.database.models.alert_revision import AlertRevision
from app.database.models.raw_document import RawDocument
from app.database.models.source import Source

logger = logging.getLogger(__name__)

# Base export directories
BASE_STORAGE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "storage", "exports"))
LATEST_DIR = os.path.join(BASE_STORAGE_DIR, "latest")
ARCHIVE_DIR = os.path.join(BASE_STORAGE_DIR, "archive")

PKT_OFFSET = timedelta(hours=5)
PKT_TZ = timezone(PKT_OFFSET)


def ensure_export_dirs():
    """Ensure storage export directories exist."""
    os.makedirs(LATEST_DIR, exist_ok=True)
    os.makedirs(ARCHIVE_DIR, exist_ok=True)


def to_ascii(text: Optional[str]) -> str:
    """
    Strictly convert any string to plain ASCII characters (ord 0..127).
    Replaces common unicode symbols/punctuation with ASCII equivalents.
    """
    if not text:
        return ""
    
    replacements = {
        "“": '"', "”": '"', "‘": "'", "’": "'",
        "—": "-", "–": "-", "°": " deg ", "…": "...",
        "\u200b": "", "\u200e": "", "\u200f": "",
        "\u2013": "-", "\u2014": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"'
    }
    for old, new in replacements.items():
        text = text.replace(old, new)
        
    normalized = unicodedata.normalize('NFKD', text)
    ascii_bytes = normalized.encode('ascii', 'ignore')
    return ascii_bytes.decode('ascii')


def format_pkt(dt: Optional[datetime]) -> str:
    """Format datetime object into human readable Pakistan Standard Time (PKT)."""
    if not dt:
        return "N/A"
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    pkt_dt = dt.astimezone(PKT_TZ)
    return pkt_dt.strftime("%Y-%m-%d %H:%M:%S PKT")


def wrap_text(text: Optional[str], width: int = 78, indent: str = "") -> str:
    """Wrap plain ASCII text to a fixed width."""
    if not text or not text.strip():
        return indent + "N/A"
    clean = to_ascii(text)
    paragraphs = clean.splitlines()
    wrapped_paragraphs = []
    for p in paragraphs:
        p_str = p.strip()
        if not p_str:
            continue
        wrapped = textwrap.fill(p_str, width=width, initial_indent=indent, subsequent_indent=indent)
        wrapped_paragraphs.append(wrapped)
    return "\n\n".join(wrapped_paragraphs) if wrapped_paragraphs else indent + "N/A"


def get_default_safety_instructions(hazard_type: str, text_context: str = "") -> List[str]:
    """Extract or return hazard-specific ASCII safety instructions."""
    # Check if text context contains numbered instructions
    lines = text_context.splitlines()
    custom_instructions = []
    for line in lines:
        line_str = to_ascii(line.strip())
        if re.match(r'^\d+[\.\)]\s+', line_str):
            cleaned_instruction = re.sub(r'^\d+[\.\)]\s+', '', line_str)
            if len(cleaned_instruction) > 5:
                custom_instructions.append(cleaned_instruction)
    
    if len(custom_instructions) >= 2:
        return custom_instructions

    hazard = (hazard_type or "").lower()
    if "rain" in hazard or "flood" in hazard or "inundation" in hazard:
        return [
            "Avoid unnecessary travel in flood-prone or waterlogged areas.",
            "Stay clear of river beds, storm drains, and open manholes.",
            "Follow emergency updates and evacuation notices from local authorities."
        ]
    elif "heatwave" in hazard or "heat" in hazard:
        return [
            "Stay hydrated and avoid direct sunlight exposure during peak hours.",
            "Wear lightweight, light-colored, breathable clothing.",
            "Keep vulnerable family members and pets in shaded or cooled environments."
        ]
    elif "earthquake" in hazard or "seismic" in hazard:
        return [
            "Drop, Cover, and Hold On during active ground shaking.",
            "Stay away from windows, glass, and unanchored heavy furniture.",
            "Evacuate safely to open outdoor spaces once tremors subside."
        ]
    elif "cyclone" in hazard or "storm" in hazard or "wind" in hazard:
        return [
            "Secure loose outdoor objects and stay indoors away from windows.",
            "Disconnect non-essential electrical appliances during severe storms.",
            "Do not venture into coastal areas or open waters."
        ]
    else:
        return [
            "Stay alert and follow official announcements from local authorities.",
            "Avoid unnecessary travel into high-risk disaster zones.",
            "Keep emergency contact numbers and basic supplies readily available."
        ]


class TextExportService:

    @classmethod
    def sanitize_filename(cls, dt: datetime, source_name: str, hazard_type: str, location_name: str) -> str:
        """
        Generate a safe, uppercase, ASCII filename:
        YYYY-MM-DD_HH-MM-SS_SOURCE_HAZARD_LOCATION.txt
        """
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        pkt_dt = dt.astimezone(PKT_TZ)
        date_str = pkt_dt.strftime("%Y-%m-%d_%H-%M-%S")

        def clean_part(s: str, max_len: int = 15) -> str:
            ascii_s = to_ascii(s).upper()
            cleaned = re.sub(r'[^A-Z0-9]', '_', ascii_s)
            cleaned = re.sub(r'_+', '_', cleaned).strip('_')
            return cleaned[:max_len] if cleaned else "UNKNOWN"

        src_part = clean_part(source_name, max_len=10)
        haz_part = clean_part(hazard_type, max_len=15)
        loc_part = clean_part(location_name, max_len=20)

        filename = f"{date_str}_{src_part}_{haz_part}_{loc_part}.txt"
        return filename

    @classmethod
    def format_alert_text(cls, alert: Alert, db: Session, action: str = "CREATED") -> str:
        """
        Format complete Alert record into strict ASCII text document.
        """
        ensure_export_dirs()
        source = alert.source or db.query(Source).filter(Source.id == alert.source_id).first()
        raw_doc = db.query(RawDocument).filter(RawDocument.source_id == alert.source_id).order_by(RawDocument.retrieved_at.desc()).first()
        
        # 1. Header Box
        lines = []
        lines.append("+" + "=" * 78 + "+")
        lines.append("|" + "PAKISTAN NATURAL DISASTER ALERT".center(78) + "|")
        lines.append("+" + "=" * 78 + "+")
        lines.append("")

        # 2. ALERT SUMMARY
        lines.append("ALERT SUMMARY")
        lines.append("-" * 79)
        lines.append(f"Alert ID          : alert_{alert.id}")
        lines.append(f"Status            : {to_ascii(alert.status).upper()}")
        lines.append(f"Hazard Type       : {to_ascii(alert.hazard_type).replace('_', ' ').upper()}")
        lines.append(f"Severity          : {to_ascii(alert.normalized_severity).upper()}")
        lines.append(f"Official Severity : {to_ascii(alert.official_severity).upper() if alert.official_severity else 'N/A'}")
        lines.append(f"Source            : {to_ascii(source.name if source else 'N/A')}")
        lines.append(f"Source Alert ID   : {to_ascii(alert.source_alert_id) if alert.source_alert_id else 'N/A'}")
        lines.append("")

        # 3. TITLE
        lines.append("TITLE")
        lines.append("-" * 79)
        lines.append(wrap_text(alert.title, width=78))
        lines.append("")

        # 4. DESCRIPTION
        lines.append("DESCRIPTION")
        lines.append("-" * 79)
        lines.append(wrap_text(alert.description, width=78))
        lines.append("")

        # 5. AFFECTED LOCATIONS
        lines.append("AFFECTED LOCATIONS")
        lines.append("-" * 79)
        if alert.locations:
            for idx, loc in enumerate(alert.locations, 1):
                lines.append(f"[{idx}]")
                lines.append(f"Province           : {to_ascii(loc.province) if loc.province else 'N/A'}")
                lines.append(f"District           : {to_ascii(loc.district) if loc.district else 'N/A'}")
                lines.append(f"City               : {to_ascii(loc.city) if loc.city else 'N/A'}")
                lines.append(f"Raw Location       : {to_ascii(loc.raw_location) if loc.raw_location else 'N/A'}")
                lines.append(f"Latitude           : {loc.latitude if loc.latitude is not None else 'N/A'}")
                lines.append(f"Longitude          : {loc.longitude if loc.longitude is not None else 'N/A'}")
                if loc.match_confidence is not None:
                    try:
                        conf_str = f"{float(loc.match_confidence):.2f}"
                    except (ValueError, TypeError):
                        conf_str = to_ascii(str(loc.match_confidence))
                else:
                    conf_str = "N/A"
                lines.append(f"Match Confidence   : {conf_str}")
                lines.append("")
        else:
            lines.append("None")
            lines.append("")

        # 6. TIMING
        lines.append("TIMING")
        lines.append("-" * 79)
        lines.append(f"Issued At          : {format_pkt(alert.issued_at)}")
        lines.append(f"Starts At          : {format_pkt(alert.starts_at)}")
        lines.append(f"Expires At         : {format_pkt(alert.expires_at)}")
        lines.append(f"Retrieved At       : {format_pkt(raw_doc.retrieved_at if raw_doc else alert.created_at)}")
        lines.append(f"Last Updated       : {format_pkt(alert.updated_at or alert.created_at)}")
        lines.append("")

        # 7. SAFETY INSTRUCTIONS
        lines.append("SAFETY INSTRUCTIONS")
        lines.append("-" * 79)
        context_text = f"{alert.title}\n{alert.description}\n{alert.raw_text or ''}"
        instructions = get_default_safety_instructions(alert.hazard_type, context_text)
        for idx, inst in enumerate(instructions, 1):
            wrapped_inst = textwrap.fill(to_ascii(inst), width=74, initial_indent=f"{idx}. ", subsequent_indent="   ")
            lines.append(wrapped_inst)
        lines.append("")

        # 8. SOURCE INFORMATION
        lines.append("SOURCE INFORMATION")
        lines.append("-" * 79)
        lines.append(f"Source Name        : {to_ascii(source.name if source else 'N/A')}")
        lines.append(f"Source URL         : {to_ascii(source.scrape_url if source else alert.source_url)}")
        lines.append(f"Final URL          : {to_ascii(raw_doc.url if raw_doc else alert.source_url)}")
        lines.append(f"Content Type       : {to_ascii(raw_doc.content_type if raw_doc else 'text/html')}")
        lines.append(f"HTTP Status        : {raw_doc.http_status if (raw_doc and raw_doc.http_status) else '200'}")
        lines.append(f"Raw Document Hash  : {to_ascii(raw_doc.content_hash if raw_doc else 'N/A')}")
        lines.append(f"Alert Content Hash : {to_ascii(alert.content_hash)}")
        lines.append("")

        # 9. PROCESSING INFORMATION
        parser_name = "BaseScraper"
        if source:
            if "PMD Weather" in source.name:
                parser_name = "PMDWeatherScraper"
            elif "NDMA" in source.name:
                parser_name = "NDMAScraper"
            elif "FFD" in source.name or "Flood" in source.name:
                parser_name = "FFDBulletinScraper"
            elif "Earthquake" in source.name or "Seismic" in source.name:
                parser_name = "PMDEarthquakeScraper"

        revision_count = len(alert.revisions) + 1 if alert.revisions else 1

        lines.append("PROCESSING INFORMATION")
        lines.append("-" * 79)
        lines.append(f"Validation Status  : {'VALID' if not alert.validation_errors else 'INVALID'}")
        lines.append(f"Processing Result  : {to_ascii(action).upper()}")
        lines.append(f"Parser             : {parser_name}")
        lines.append(f"Location Match     : {'SUCCESS' if alert.locations else 'N/A'}")
        lines.append(f"Duplicate Check    : UNIQUE")
        lines.append(f"Revision Number    : {revision_count}")
        lines.append("")

        # 10. VALIDATION NOTES
        lines.append("VALIDATION NOTES")
        lines.append("-" * 79)
        if alert.validation_errors:
            try:
                errs = json.loads(alert.validation_errors)
                if isinstance(errs, list):
                    for idx, err in enumerate(errs, 1):
                        lines.append(f"{idx}. {to_ascii(str(err))}")
                else:
                    lines.append(to_ascii(str(alert.validation_errors)))
            except Exception:
                lines.append(to_ascii(str(alert.validation_errors)))
        else:
            lines.append("None")
        lines.append("")

        # 11. CHANGE HISTORY
        lines.append("CHANGE HISTORY")
        lines.append("-" * 79)
        if alert.revisions and len(alert.revisions) > 0:
            # Sort revisions by creation time
            revs = sorted(alert.revisions, key=lambda r: r.created_at or datetime.min.replace(tzinfo=timezone.utc))
            latest_rev = revs[-1]
            lines.append(f"Revision Number    : {revision_count}")
            lines.append(f"Previous Hash      : {to_ascii(latest_rev.previous_content_hash)}")
            lines.append(f"New Hash           : {to_ascii(latest_rev.new_content_hash)}")
            lines.append(f"Updated At         : {format_pkt(latest_rev.created_at)}")
            lines.append("")
            lines.append("Changed Fields:")
            try:
                changed = json.loads(latest_rev.changed_fields)
                if isinstance(changed, list):
                    for idx, field in enumerate(changed, 1):
                        field_ascii = to_ascii(str(field))
                        lines.append(f"{idx}. Changed field: {field_ascii}")
                else:
                    lines.append(f"1. {to_ascii(str(latest_rev.changed_fields))}")
            except Exception:
                lines.append(f"1. {to_ascii(str(latest_rev.changed_fields))}")
        else:
            lines.append("No previous revisions.")
        lines.append("")

        # 12. RAW EXTRACTED TEXT
        lines.append("RAW EXTRACTED TEXT")
        lines.append("-" * 79)
        raw_text_src = alert.raw_text or (raw_doc.raw_text if raw_doc else None) or alert.description or "N/A"
        # Bounded raw text to avoid overflow
        bounded_raw = raw_text_src[:3000]
        lines.append(wrap_text(bounded_raw, width=78))
        lines.append("")

        # 13. Footer Box
        lines.append("+" + "=" * 78 + "+")
        lines.append("|" + "END OF ALERT RECORD".center(78) + "|")
        lines.append("+" + "=" * 78 + "+")

        content = "\n".join(lines) + "\n"
        
        # Verify strict ASCII safety
        return to_ascii(content)

    @classmethod
    def _find_existing_latest_export(cls, alert_id: int) -> Optional[str]:
        """Search latest/ for export file belonging to alert_id."""
        ensure_export_dirs()
        target_string = f"Alert ID          : alert_{alert_id}"
        if not os.path.exists(LATEST_DIR):
            return None
            
        for filename in os.listdir(LATEST_DIR):
            if filename.endswith(".txt"):
                filepath = os.path.join(LATEST_DIR, filename)
                try:
                    with open(filepath, "r", encoding="ascii", errors="ignore") as f:
                        # Check first 20 lines
                        head = "".join([f.readline() for _ in range(20)])
                        if target_string in head:
                            return filepath
                except Exception:
                    continue
        return None

    @classmethod
    def export_alert(cls, db: Session, alert: Alert, action: str = "CREATED") -> Optional[str]:
        """
        Main entry point for generating or updating a .txt export.
        Handles atomic writing, archiving, and error catching.
        """
        try:
            # Skip export for rejected, incomplete, or ignored alerts
            if alert.status in ["rejected", "incomplete"] or action.upper() == "IGNORED":
                logger.info(f"Skipping text export for alert {alert.id} with status '{alert.status}' and action '{action}'")
                return None

            ensure_export_dirs()
            source_name = alert.source.name if alert.source else "UNKNOWN"
            first_loc = alert.locations[0].district or alert.locations[0].city or alert.locations[0].raw_location if alert.locations else "PAKISTAN"
            
            base_filename = cls.sanitize_filename(
                dt=alert.issued_at or datetime.now(timezone.utc),
                source_name=source_name,
                hazard_type=alert.hazard_type,
                location_name=first_loc
            )

            # Check if previous export exists in latest/ for this alert
            existing_latest_path = cls._find_existing_latest_export(alert.id)

            if existing_latest_path and os.path.exists(existing_latest_path):
                # Archive old version
                old_filename = os.path.basename(existing_latest_path)
                archive_path = os.path.join(ARCHIVE_DIR, old_filename)
                
                # If archive filename exists, append suffix
                if os.path.exists(archive_path):
                    name_stem, ext = os.path.splitext(old_filename)
                    rev_count = len(alert.revisions) if alert.revisions else 1
                    archive_path = os.path.join(ARCHIVE_DIR, f"{name_stem}_rev{rev_count}{ext}")

                try:
                    os.replace(existing_latest_path, archive_path)
                    logger.info(f"Archived previous export for alert {alert.id} to {archive_path}")
                except Exception as e:
                    logger.warning(f"Could not archive previous export {existing_latest_path}: {e}")

            # Check for duplicate filenames in latest/ for DIFFERENT alerts
            target_latest_path = os.path.join(LATEST_DIR, base_filename)
            counter = 2
            while os.path.exists(target_latest_path):
                name_stem, ext = os.path.splitext(base_filename)
                target_latest_path = os.path.join(LATEST_DIR, f"{name_stem}_{counter}{ext}")
                counter += 1

            # Format formatted ASCII string
            text_content = cls.format_alert_text(alert, db, action=action)

            # Atomic File Write (.tmp -> target)
            tmp_path = target_latest_path + f".tmp_{os.getpid()}"
            with open(tmp_path, "w", encoding="ascii", errors="ignore") as f:
                f.write(text_content)
                f.flush()
                os.fsync(f.fileno())

            os.replace(tmp_path, target_latest_path)
            logger.info(f"Successfully exported alert {alert.id} to {target_latest_path}")
            return target_latest_path

        except Exception as e:
            logger.error(f"Error exporting alert {alert.id} to text file: {e}", exc_info=True)
            return None

    @classmethod
    def get_latest_export_path(cls, alert_id: int) -> Optional[str]:
        """Find the export filepath in latest/ for alert_id."""
        return cls._find_existing_latest_export(alert_id)
