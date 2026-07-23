import logging
from bs4 import BeautifulSoup
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

from app.scrapers.base import BaseScraper
from app.database.models.source import Source
from app.schemas.alert import AlertCreate, AlertLocationCreate

logger = logging.getLogger(__name__)

# Pakistan is roughly bounded by these coordinates — used to flag nearby events
PAKISTAN_LAT_MIN, PAKISTAN_LAT_MAX = 23.5, 37.5
PAKISTAN_LON_MIN, PAKISTAN_LON_MAX = 60.5, 77.5
NEARBY_LAT_MIN, NEARBY_LAT_MAX = 20.0, 42.0
NEARBY_LON_MIN, NEARBY_LON_MAX = 55.0, 85.0


def _is_near_pakistan(lat: float, lon: float) -> bool:
    """Return True if coordinates fall within or near Pakistan."""
    return (NEARBY_LAT_MIN <= lat <= NEARBY_LAT_MAX and
            NEARBY_LON_MIN <= lon <= NEARBY_LON_MAX)


class PMDEarthquakeScraper(BaseScraper):
    """
    Scraper for PMD National Seismic Monitoring Centre.
    Extracts earthquake alerts from the HTML table.
    Improvements:
      - Latitude/longitude now attached to AlertLocation so events appear on the map.
      - Magnitude thresholds refined (M2.9 threshold to avoid noise).
      - Events near Pakistan (M>=4) are auto-active; distant/minor ones are pending.
      - Robust column parsing with fallback for variable table structures.
    """

    async def fetch(self) -> Any:
        response, retrieved_at = await self.fetcher.fetch(self.source.scrape_url)
        return [{"url": self.source.scrape_url, "content": response.text, "retrieved_at": retrieved_at}]

    def parse(self, raw_documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        extracted = []
        for doc in raw_documents:
            soup = BeautifulSoup(doc["content"], "html.parser")
            tables = soup.find_all("table")
            if not tables:
                logger.warning(f"No tables found in PMD EQ document {doc['url']}")
                continue

            for row in tables[0].find_all("tr")[1:]:  # Skip header row
                cols = row.find_all("td")
                if len(cols) < 7:
                    continue
                try:
                    date_str = cols[0].text.strip()
                    time_str = cols[1].text.strip()
                    lat_str  = cols[2].text.strip()
                    lon_str  = cols[3].text.strip()
                    mag_str  = cols[4].text.strip()
                    depth    = cols[5].text.strip()
                    region   = cols[6].text.strip()

                    if not date_str or not time_str or not mag_str:
                        continue

                    dt = datetime.strptime(f"{date_str} {time_str}", "%d/%m/%Y %H:%M:%S")
                    dt = dt.replace(tzinfo=timezone.utc)

                    lat = float(lat_str.replace("N", "").replace("S", "").strip())
                    lon = float(lon_str.replace("E", "").replace("W", "").strip())
                    mag = float(mag_str)

                    # Skip very minor events (below M2.9)
                    if mag < 2.9:
                        continue

                    alert_id = (
                        f"EQ-{dt.strftime('%Y%m%d%H%M%S')}-"
                        f"{lat_str.replace(' ', '')}-{lon_str.replace(' ', '')}"
                    )

                    description = (
                        f"Earthquake of magnitude {mag} detected at depth {depth} km. "
                        f"Epicenter: {region} (Lat: {lat_str}, Lon: {lon_str})."
                    )

                    extracted.append({
                        "source_alert_id": alert_id,
                        "title": f"M{mag} Earthquake - {region}",
                        "description": description,
                        "raw_location": region,
                        "latitude": lat,
                        "longitude": lon,
                        "issued_at": dt,
                        "severity_indicator": mag,
                        "url": doc["url"],
                    })

                except (ValueError, IndexError) as e:
                    logger.warning(f"Skipping malformed PMD EQ row: {e}")

        return extracted

    def normalize(self, parsed_items: List[Dict[str, Any]]) -> List[AlertCreate]:
        normalized = []
        for item in parsed_items:
            mag = item["severity_indicator"]
            lat = item.get("latitude")
            lon = item.get("longitude")

            # Severity based on magnitude
            if mag >= 7.0:
                severity = "critical"
            elif mag >= 6.0:
                severity = "high"
            elif mag >= 5.0:
                severity = "high"
            elif mag >= 4.0:
                severity = "medium"
            else:
                severity = "low"

            # Auto-approve events that are near Pakistan and M>=4,
            # or any M>=5 regardless of location (regionally significant)
            near_pk = lat is not None and lon is not None and _is_near_pakistan(lat, lon)
            if near_pk and mag >= 4.0:
                status = "active"
            elif mag >= 5.0:
                status = "active"
            else:
                status = "pending"

            location = AlertLocationCreate(
                raw_location=item["raw_location"],
                latitude=lat,
                longitude=lon,
                match_confidence="manual",
            )

            alert = AlertCreate(
                source_id=self.source.id,
                source_alert_id=item["source_alert_id"],
                title=item["title"],
                description=item["description"],
                hazard_type="earthquake",
                normalized_severity=severity,
                issued_at=item["issued_at"],
                status=status,
                source_url=item["url"],
                content_hash="",  # Filled by deduplicator
                locations=[location],
            )
            normalized.append(alert)
        return normalized
