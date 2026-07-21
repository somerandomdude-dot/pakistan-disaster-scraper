import logging
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.scrapers.base import BaseScraper
from app.database.models.source import Source
from app.schemas.alert import AlertCreate, AlertLocationCreate

logger = logging.getLogger(__name__)

class PMDEarthquakeScraper(BaseScraper):
    """
    Scraper for PMD National Seismic Monitoring Centre.
    Extracts earthquake alerts from the HTML table.
    """
    
    async def fetch(self) -> Any:
        response, retrieved_at = await self.fetcher.fetch(self.source.scrape_url)
        return [{"url": self.source.scrape_url, "content": response.text, "retrieved_at": retrieved_at}]
        
    def parse(self, raw_documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        extracted = []
        for doc in raw_documents:
            soup = BeautifulSoup(doc["content"], 'html.parser')
            tables = soup.find_all('table')
            if not tables:
                logger.warning(f"No tables found in PMD EQ document {doc['url']}")
                continue
                
            # Process the first table
            for row in tables[0].find_all('tr')[1:]: # Skip header
                cols = row.find_all('td')
                if len(cols) >= 7:
                    try:
                        date_str = cols[0].text.strip()
                        time_str = cols[1].text.strip()
                        lat = cols[2].text.strip()
                        lon = cols[3].text.strip()
                        mag = cols[4].text.strip()
                        depth = cols[5].text.strip()
                        region = cols[6].text.strip()
                        
                        dt_str = f"{date_str} {time_str}"
                        dt = datetime.strptime(dt_str, "%d/%m/%Y %H:%M:%S")
                        dt = dt.replace(tzinfo=timezone.utc)
                        
                        alert_id = f"EQ-{dt.strftime('%Y%m%d%H%M%S')}-{lat.replace(' ', '')}-{lon.replace(' ', '')}"
                        
                        description = (
                            f"Earthquake of magnitude {mag} detected at depth {depth} km. "
                            f"Epicenter: {region} (Lat: {lat}, Lon: {lon})."
                        )
                        
                        extracted.append({
                            "source_alert_id": alert_id,
                            "title": f"M{mag} Earthquake - {region}",
                            "description": description,
                            "raw_location": region,
                            "issued_at": dt,
                            "severity_indicator": float(mag),
                            "url": doc["url"]
                        })
                    except Exception as e:
                        logger.error(f"Error parsing PMD EQ row: {e}")
                        
        return extracted

    def normalize(self, parsed_items: List[Dict[str, Any]]) -> List[AlertCreate]:
        normalized = []
        for parsed_item in parsed_items:
            # Determine severity based on magnitude
            mag = parsed_item["severity_indicator"]
            severity = "low"
            if mag >= 6.0:
                severity = "extreme"
            elif mag >= 5.0:
                severity = "high"
            elif mag >= 4.0:
                severity = "medium"
                
            location = AlertLocationCreate(raw_location=parsed_item["raw_location"])
            
            alert = AlertCreate(
                source_id=self.source.id,
                source_alert_id=parsed_item["source_alert_id"],
                title=parsed_item["title"],
                description=parsed_item["description"],
                hazard_type="earthquake",
                normalized_severity=severity,
                issued_at=parsed_item["issued_at"],
                status="active",
                source_url=parsed_item["url"],
                content_hash="", # Filled by deduplicator
                locations=[location]
            )
            normalized.append(alert)
        return normalized
