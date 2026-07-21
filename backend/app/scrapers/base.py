import logging
from typing import List, Optional, Any, Dict
from abc import ABC, abstractmethod
from app.database.models.source import Source
from app.database.models.raw_document import RawDocument
from app.schemas.alert import AlertCreate
from app.scrapers.fetcher import ScraperFetcher
from sqlalchemy.orm import Session
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class BaseScraper(ABC):
    def __init__(self, db: Session, source: Source):
        self.db = db
        self.source = source
        self.fetcher = ScraperFetcher()
        self.results: List[AlertCreate] = []
        self.raw_document: Optional[RawDocument] = None

    @abstractmethod
    async def fetch(self) -> Any:
        """
        Fetch the raw data from the official source.
        Should return the raw content (HTML string, JSON dict, RSS XML, or PDF bytes)
        and create/store a RawDocument record if a new one was fetched.
        """
        pass

    @abstractmethod
    def parse(self, raw_content: Any) -> List[Dict[str, Any]]:
        """
        Parse the raw content and extract the relevant fields.
        Returns a list of dictionaries containing the extracted data.
        """
        pass

    @abstractmethod
    def normalize(self, parsed_items: List[Dict[str, Any]]) -> List[AlertCreate]:
        """
        Convert the parsed dictionaries into standardized AlertCreate schemas.
        This includes normalizing hazards, severity, datetimes, etc.
        """
        pass

    async def run(self) -> List[AlertCreate]:
        """
        Execute the full scraper pipeline: fetch -> parse -> normalize.
        Returns a list of AlertCreate objects.
        """
        logger.info(f"Starting scraper for {self.source.name}...")
        try:
            raw_content = await self.fetch()
            
            if not raw_content:
                logger.info(f"No new content fetched for {self.source.name}")
                return []
                
            parsed_items = self.parse(raw_content)
            
            if not parsed_items:
                logger.warning(f"Successfully fetched, but 0 alerts parsed for {self.source.name}")
                if self.raw_document:
                    self.raw_document.parsing_status = "success"
                return []
                
            normalized_alerts = self.normalize(parsed_items)
            
            if self.raw_document:
                self.raw_document.parsing_status = "success"
                
            self.results = normalized_alerts
            logger.info(f"Successfully scraped and normalized {len(self.results)} alerts for {self.source.name}")
            return self.results
            
        except Exception as e:
            logger.error(f"Error running scraper {self.source.name}: {str(e)}", exc_info=True)
            if self.raw_document:
                self.raw_document.parsing_status = "failed"
                self.raw_document.parsing_error = str(e)
            raise
        finally:
            await self.fetcher.close()
