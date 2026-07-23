import logging
import asyncio
from typing import List, Dict, Any, Optional
from bs4 import BeautifulSoup
import httpx

from app.scrapers.base import BaseScraper
from app.schemas.alert import AlertCreate, AlertLocationCreate
from datetime import datetime, timezone
import dateutil.parser

logger = logging.getLogger(__name__)

class PMDWeatherScraper(BaseScraper):
    """
    Scraper for PMD Weather Alerts.
    Checks the main alerts page for iframes containing CAP XMLs,
    fetches them, and parses the CAP data.
    """
    
    async def fetch(self) -> Any:
        """
        Fetch the main HTML, find CAP XML links in iframes, 
        and fetch each individual CAP XML document.
        Returns a list of raw CAP XML strings.
        """
        # Fetch the main page
        response, retrieved_at = await self.fetcher.fetch(self.source.scrape_url)
        html_content = response.text
        
        soup = BeautifulSoup(html_content, "html.parser")
        iframes = soup.find_all("iframe")
        
        xml_urls = []
        for iframe in iframes:
            src = iframe.get("src")
            if src and src.endswith(".xml") and "cap-sources.s3.amazonaws.com" in src:
                xml_urls.append(src)
        
        # If no XMLs found via iframes, check for rss.xml link
        if not xml_urls:
            rss_link = soup.find("a", href=lambda href: href and "rss.xml" in href)
            if rss_link:
                rss_url = rss_link["href"]
                if not rss_url.startswith("http"):
                    rss_url = f"https://www.pmd.gov.pk{rss_url}"
                # We could fetch the RSS here, but the iframes usually contain the active ones
                logger.info(f"Found RSS link instead of iframes: {rss_url}")
        
        # Fetch each XML concurrently (respecting limits/backoff)
        xml_contents = []
        for url in xml_urls:
            try:
                xml_resp, _ = await self.fetcher.fetch(url)
                xml_contents.append({"url": url, "content": xml_resp.text, "retrieved_at": retrieved_at})
            except Exception as e:
                logger.error(f"Failed to fetch CAP XML {url}: {e}")
                
        # We don't store individual XMLs in raw_document for this BaseScraper implementation yet, 
        # or we store the main HTML as the raw_document and parse the XMLs. 
        # For simplicity, we'll return the list of fetched XMLs to be parsed.
        # Ideally, we should create a RawDocument for EACH XML, but BaseScraper assumes 1 raw_document.
        # We will adjust the pipeline in run() or handle it here.
        
        return xml_contents

    def parse(self, raw_content: Any) -> List[Dict[str, Any]]:
        """
        Parse the list of CAP XML strings into alert dictionaries.
        """
        parsed_alerts = []
        xml_contents = raw_content # Expected to be list of dicts: {"url": str, "content": str, "retrieved_at": datetime}
        
        for item in xml_contents:
            xml_str = item["content"]
            source_url = item["url"]
            
            # Use lxml XML parser (now installed). Fallback to html.parser if lxml errors.
            try:
                soup = BeautifulSoup(xml_str, "lxml-xml")
            except Exception:
                soup = BeautifulSoup(xml_str, "html.parser")
            
            alert = soup.find("alert")
            if not alert:
                continue
                
            info = alert.find("info")
            if not info:
                continue
                
            # Extract CAP fields
            identifier = alert.find("identifier").text if alert.find("identifier") else None
            sent = alert.find("sent").text if alert.find("sent") else None
            
            headline = info.find("headline").text if info.find("headline") else "PMD Weather Alert"
            description = info.find("description").text if info.find("description") else ""
            instruction = info.find("instruction").text if info.find("instruction") else ""
            
            hazard_type = info.find("event").text if info.find("event") else "Weather"
            severity = info.find("severity").text if info.find("severity") else "Unknown"
            
            onset = info.find("onset").text if info.find("onset") else None
            expires = info.find("expires").text if info.find("expires") else None
            
            area_desc = ""
            area = info.find("area")
            if area and area.find("areaDesc"):
                area_desc = area.find("areaDesc").text
            
            # We can also parse the description text to extract locations if areaDesc is too generic
            raw_locations = []
            if area_desc:
                raw_locations.append(area_desc)
                
            # Full text preservation
            full_text = f"{headline}\n\n{description}\n\nInstructions: {instruction}"
            
            parsed_alerts.append({
                "source_alert_id": identifier,
                "title": headline,
                "description": description,
                "instructions": instruction,
                "hazard_type": hazard_type,
                "official_severity": severity,
                "issued_at_raw": sent,
                "starts_at_raw": onset,
                "expires_at_raw": expires,
                "source_url": source_url,
                "raw_text": full_text,
                "raw_locations": raw_locations
            })
            
        return parsed_alerts

    def normalize(self, parsed_items: List[Dict[str, Any]]) -> List[AlertCreate]:
        """
        Normalize the parsed PMD alerts to the standard AlertCreate schema.
        We will rely on the separate normalizer service for full standardization,
        but we map it to the Pydantic schema here.
        """
        normalized = []
        for item in parsed_items:
            try:
                # Basic datetime parsing (we assume PKT/UTC offset is included in CAP standard e.g. +05:00)
                issued_at = dateutil.parser.isoparse(item["issued_at_raw"]) if item.get("issued_at_raw") else datetime.now(timezone.utc)
                starts_at = dateutil.parser.isoparse(item["starts_at_raw"]) if item.get("starts_at_raw") else None
                expires_at = dateutil.parser.isoparse(item["expires_at_raw"]) if item.get("expires_at_raw") else None
                
                # We'll map severity in the processing pipeline, just pass it raw for now
                locations = [AlertLocationCreate(raw_location=loc) for loc in item.get("raw_locations", [])]
                
                # Add instructions to description if available
                desc = item.get("description", "")
                instructions = item.get("instructions", "")
                if instructions:
                    desc += f"\n\nInstructions: {instructions}"
                
                alert = AlertCreate(
                    source_id=self.source.id,
                    source_alert_id=item.get("source_alert_id"),
                    title=item.get("title", "Weather Warning"),
                    description=desc,
                    hazard_type=item.get("hazard_type", "weather"),
                    official_severity=item.get("official_severity", "unknown"),
                    normalized_severity="unknown", # Will be determined by pipeline
                    issued_at=issued_at,
                    starts_at=starts_at,
                    expires_at=expires_at,
                    status="pending",
                    source_url=item.get("source_url", self.source.scrape_url),
                    raw_text=item.get("raw_text", ""),
                    content_hash="pending", # Generated in deduplication phase
                    locations=locations
                )
                normalized.append(alert)
            except Exception as e:
                logger.error(f"Normalization error for item {item.get('source_alert_id')}: {e}")
                
        return normalized
