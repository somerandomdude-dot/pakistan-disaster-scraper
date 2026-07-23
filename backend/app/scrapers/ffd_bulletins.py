import logging
from bs4 import BeautifulSoup
import re
import io
from typing import List, Dict, Any
from datetime import datetime, timezone

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from pypdf import PdfReader
except ImportError:
    PdfReader = None

from app.scrapers.base import BaseScraper
from app.schemas.alert import AlertCreate, AlertLocationCreate

logger = logging.getLogger(__name__)

class FFDBulletinScraper(BaseScraper):
    """
    Scraper for PMD Flood Forecasting Division Bulletins.
    Extracts bulletin PDF links and parses them.
    """
    
    async def fetch(self) -> Any:
        # Fetch the main HTML
        response, retrieved_at = await self.fetcher.fetch(self.source.scrape_url)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Find PDF links (FFD uses /download at the end of their links or .pdf)
        pdf_urls = []
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.endswith('/download') or href.endswith('.pdf'):
                if not href.startswith('http'):
                    if href.startswith('/'):
                        href = f"https://ffd.pmd.gov.pk{href}"
                    else:
                        href = f"https://ffd.pmd.gov.pk/{href}"
                if href not in pdf_urls:
                    pdf_urls.append(href)
        
        # Fetch the PDFs
        pdf_contents = []
        for url in pdf_urls[:5]: # limit to recent 5 to avoid overloading
            try:
                pdf_resp, _ = await self.fetcher.fetch(url)
                # Ensure it's a PDF
                if pdf_resp.status_code == 200 and pdf_resp.content.startswith(b'%PDF'):
                    pdf_contents.append({
                        "url": url,
                        "content": pdf_resp.content,
                        "retrieved_at": retrieved_at
                    })
            except Exception as e:
                logger.error(f"Failed to fetch FFD PDF {url}: {e}")
                
        return pdf_contents

    def parse(self, raw_content: Any) -> List[Dict[str, Any]]:
        parsed_alerts = []
        for item in raw_content:
            pdf_bytes = item["content"]
            url = item["url"]
            retrieved_at = item["retrieved_at"]
            
            try:
                text = ""
                if fitz is not None:
                    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                    for page in doc:
                        text += page.get_text()
                elif PdfReader is not None:
                    reader = PdfReader(io.BytesIO(pdf_bytes))
                    for page in reader.pages:
                        text += page.extract_text() or ""
                else:
                    logger.warning("No PDF parser library (fitz or pypdf) available.")
                    
                # Clean up text somewhat
                text = re.sub(r'\s+', ' ', text).strip()
                
                title = "Flood Forecasting Division Bulletin"
                if "BULLETIN No. A" in text or url.endswith("A"):
                    title = "FFD River Discharge & Weather Bulletin A"
                elif "BULLETIN No. B" in text or url.endswith("B"):
                    title = "FFD Rainfall & Flood Forecast Bulletin B"
                    
                date_str = retrieved_at.strftime("%Y-%m-%d")
                alert_id = f"FFD-{title.replace(' ', '')}-{date_str}"
                
                parsed_alerts.append({
                    "source_alert_id": alert_id,
                    "title": title,
                    "description": text[:2000] + ("..." if len(text) > 2000 else ""),
                    "hazard_type": "flood",
                    "issued_at_raw": retrieved_at,
                    "source_url": url,
                    "raw_text": text,
                    "raw_locations": ["Pakistan"]
                })
            except Exception as e:
                logger.error(f"Error parsing FFD PDF {url}: {e}")
                
        return parsed_alerts

    def normalize(self, parsed_items: List[Dict[str, Any]]) -> List[AlertCreate]:
        normalized = []
        for item in parsed_items:
            try:
                severity = "medium"
                text_upper = item.get("raw_text", "").upper()
                if "VERY HIGH FLOOD" in text_upper or "EXCEPTIONALLY HIGH FLOOD" in text_upper:
                    severity = "extreme"
                elif "HIGH FLOOD" in text_upper:
                    severity = "high"
                    
                locations = [AlertLocationCreate(raw_location=loc) for loc in item.get("raw_locations", [])]
                
                alert = AlertCreate(
                    source_id=self.source.id,
                    source_alert_id=item.get("source_alert_id"),
                    title=item.get("title"),
                    description=item.get("description"),
                    hazard_type=item.get("hazard_type"),
                    normalized_severity=severity,
                    issued_at=item.get("issued_at_raw"),
                    status="active",
                    source_url=item.get("source_url"),
                    raw_text=item.get("raw_text"),
                    content_hash="pending",
                    locations=locations
                )
                normalized.append(alert)
            except Exception as e:
                logger.error(f"Normalization error for FFD item {item.get('source_alert_id')}: {e}")
                
        return normalized
