from __future__ import annotations

import logging
import math
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import geoip2.database
from geoip2.errors import AddressNotFoundError

from app.core.config import Settings, settings
from app.schemas.nearby_alert import GeoIPDetectionMethod, UserLocationResponse
from app.services.client_ip_service import ClientIPResult, is_public_ip

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GeoLocationResult:
    latitude: float
    longitude: float
    city: str | None
    subdivision: str | None
    country: str | None
    country_code: str | None
    detection_method: GeoIPDetectionMethod
    is_fallback: bool

    def to_response(self) -> UserLocationResponse:
        return UserLocationResponse(
            lat=self.latitude,
            lng=self.longitude,
            city=self.city,
            subdivision=self.subdivision,
            country=self.country,
            country_code=self.country_code,
            detection_method=self.detection_method,
            is_fallback=self.is_fallback,
        )


class GeoIPService:
    """A process-local, thread-safe MaxMind reader with atomic reloads."""

    def __init__(self, config: Settings = settings):
        self._settings = config
        self._reader: geoip2.database.Reader | None = None
        self._reader_mtime_ns: int | None = None
        self._last_reload_check = 0.0
        self._load_state = "missing"
        self._lock = threading.RLock()
        self._reload_lock = threading.Lock()

    def start(self) -> None:
        self._reload(force=True)

    def close(self) -> None:
        with self._lock:
            reader, self._reader = self._reader, None
            self._reader_mtime_ns = None
        if reader:
            reader.close()

    def _reload(self, *, force: bool = False) -> None:
        # Only one thread opens/swaps a database at a time. Lookups continue
        # using the current reader until a replacement has opened successfully.
        with self._reload_lock:
            self._reload_once(force=force)

    def _reload_once(self, *, force: bool = False) -> None:
        now = time.monotonic()
        interval = max(1, self._settings.GEOIP_RELOAD_INTERVAL_SECONDS)
        if not force and now - self._last_reload_check < interval:
            return
        self._last_reload_check = now

        database_path = Path(self._settings.GEOIP_DATABASE_PATH)
        try:
            stat = database_path.stat()
            if not database_path.is_file():
                raise FileNotFoundError
        except (FileNotFoundError, OSError):
            if self._reader is None:
                self._load_state = "missing"
            logger.warning("GeoIP database is unavailable; configured fallback location will be used")
            return

        if not force and self._reader and stat.st_mtime_ns == self._reader_mtime_ns:
            return

        try:
            replacement = geoip2.database.Reader(str(database_path))
        except Exception:
            if self._reader is None:
                self._load_state = "error"
            logger.exception("GeoIP database could not be opened")
            return

        with self._lock:
            previous = self._reader
            self._reader = replacement
            self._reader_mtime_ns = stat.st_mtime_ns
            self._load_state = "ready"
            if previous:
                previous.close()
        logger.info("GeoIP database reader loaded")

    def _fallback(self, method: GeoIPDetectionMethod) -> GeoLocationResult:
        return GeoLocationResult(
            latitude=self._settings.DEFAULT_LOCATION_LAT,
            longitude=self._settings.DEFAULT_LOCATION_LNG,
            city=self._settings.DEFAULT_LOCATION_CITY,
            subdivision=None,
            country=self._settings.DEFAULT_LOCATION_COUNTRY,
            country_code=self._settings.DEFAULT_LOCATION_COUNTRY_CODE,
            detection_method=method,
            is_fallback=True,
        )

    def resolve(self, client_ip: ClientIPResult) -> GeoLocationResult:
        if client_ip.address is None:
            method = (
                GeoIPDetectionMethod.INVALID_IP_FALLBACK
                if client_ip.invalid_input
                else GeoIPDetectionMethod.DEFAULT
            )
            return self._fallback(method)

        if not is_public_ip(client_ip.address):
            method = (
                GeoIPDetectionMethod.LOCAL_DEVELOPMENT
                if client_ip.is_local_development
                else GeoIPDetectionMethod.PRIVATE_IP_FALLBACK
            )
            return self._fallback(method)

        self._reload()
        with self._lock:
            reader = self._reader
            if reader is None:
                method = (
                    GeoIPDetectionMethod.GEOIP_DATABASE_MISSING_FALLBACK
                    if self._load_state == "missing"
                    else GeoIPDetectionMethod.GEOIP_DATABASE_ERROR_FALLBACK
                )
                return self._fallback(method)
            try:
                record = reader.city(str(client_ip.address))
            except AddressNotFoundError:
                return self._fallback(GeoIPDetectionMethod.GEOIP_NOT_FOUND_FALLBACK)
            except Exception:
                logger.exception("GeoIP lookup failed for a redacted client network")
                return self._fallback(GeoIPDetectionMethod.GEOIP_DATABASE_ERROR_FALLBACK)

        latitude = record.location.latitude
        longitude = record.location.longitude
        if not self._valid_coordinates(latitude, longitude):
            return self._fallback(GeoIPDetectionMethod.GEOIP_NOT_FOUND_FALLBACK)

        detection_method = (
            GeoIPDetectionMethod.LOCAL_DEVELOPMENT
            if client_ip.is_local_development
            else GeoIPDetectionMethod.IP
        )
        return GeoLocationResult(
            latitude=float(latitude),
            longitude=float(longitude),
            city=record.city.name,
            subdivision=record.subdivisions.most_specific.name,
            country=record.country.name,
            country_code=record.country.iso_code,
            detection_method=detection_method,
            is_fallback=False,
        )

    @staticmethod
    def _valid_coordinates(latitude: object, longitude: object) -> bool:
        try:
            lat = float(latitude)
            lng = float(longitude)
        except (TypeError, ValueError):
            return False
        return (
            math.isfinite(lat)
            and math.isfinite(lng)
            and -90 <= lat <= 90
            and -180 <= lng <= 180
        )


geoip_service = GeoIPService()
