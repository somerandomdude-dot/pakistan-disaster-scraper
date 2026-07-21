import json
import os
import re
from typing import List, Dict, Optional
from app.schemas.alert import AlertCreate, AlertLocationCreate
import logging

logger = logging.getLogger(__name__)

class LocationMatcher:
    def __init__(self, mapping_file: str = "app/core/locations.json"):
        self.provinces = []
        self.districts = []
        self._load_mappings(mapping_file)

    def _load_mappings(self, mapping_file: str):
        try:
            if not os.path.exists(mapping_file):
                # Try relative to project root
                mapping_file = os.path.join(os.path.dirname(__file__), "..", "core", "locations.json")
                
            with open(mapping_file, "r") as f:
                data = json.load(f)
                self.provinces = data.get("provinces", [])
                self.districts = data.get("districts", [])
        except Exception as e:
            logger.error(f"Failed to load location mappings: {e}")

    def _clean_location(self, loc: str) -> str:
        return re.sub(r'[^a-zA-Z0-9]', ' ', loc.lower()).strip()

    def match_location(self, raw_loc: str) -> AlertLocationCreate:
        cleaned_raw = self._clean_location(raw_loc)
        
        # Exact match district
        for dist in self.districts:
            if dist["name"].lower() == cleaned_raw:
                return AlertLocationCreate(
                    raw_location=raw_loc,
                    city=dist["name"],
                    district=dist["name"],
                    province=dist["province"],
                    match_confidence="exact"
                )
        
        # Alias match district
        for dist in self.districts:
            for alias in dist.get("aliases", []):
                if alias.lower() == cleaned_raw:
                    return AlertLocationCreate(
                        raw_location=raw_loc,
                        city=dist["name"],
                        district=dist["name"],
                        province=dist["province"],
                        match_confidence="alias"
                    )
                    
        # Substring/Conservative fuzzy match district
        # Only if the district name is a distinct word in the raw string
        words = set(cleaned_raw.split())
        for dist in self.districts:
            dist_lower = dist["name"].lower()
            if dist_lower in words:
                return AlertLocationCreate(
                    raw_location=raw_loc,
                    city=dist["name"],
                    district=dist["name"],
                    province=dist["province"],
                    match_confidence="fuzzy"
                )

        # Exact match province
        for prov in self.provinces:
            if prov["name"].lower() == cleaned_raw:
                return AlertLocationCreate(
                    raw_location=raw_loc,
                    province=prov["name"],
                    match_confidence="exact"
                )
                
        # Alias match province
        for prov in self.provinces:
            for alias in prov.get("aliases", []):
                if alias.lower() == cleaned_raw:
                    return AlertLocationCreate(
                        raw_location=raw_loc,
                        province=prov["name"],
                        match_confidence="alias"
                    )

        # Substring/Conservative fuzzy match province
        for prov in self.provinces:
            prov_lower = prov["name"].lower()
            if prov_lower in words:
                return AlertLocationCreate(
                    raw_location=raw_loc,
                    province=prov["name"],
                    match_confidence="fuzzy"
                )

        # Unmatched
        return AlertLocationCreate(
            raw_location=raw_loc,
            match_confidence="manual"
        )

    def process(self, alert: AlertCreate) -> AlertCreate:
        matched_locations = []
        
        # The PMD scraper might dump a long string into a single location if it couldn't parse it well.
        # We should try to split by comma or "and" if it's long.
        raw_list = []
        for loc in alert.locations:
            parts = re.split(r',| and |&', loc.raw_location)
            for p in parts:
                p = p.strip()
                if p:
                    raw_list.append(p)
                    
        for raw in raw_list:
            matched_loc = self.match_location(raw)
            matched_locations.append(matched_loc)
            
        alert.locations = matched_locations
        return alert

matcher_instance = LocationMatcher()
