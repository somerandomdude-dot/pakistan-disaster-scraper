from typing import List, Optional

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_ENV: str = "development"
    DATABASE_URL: str
    ADMIN_API_KEY: str
    LOG_LEVEL: str = "INFO"
    SCRAPER_USER_AGENT: str = "PakistanDisasterAlertBot/1.0"
    REQUEST_TIMEOUT_SECONDS: int = 20
    MAX_RETRIES: int = 3
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]
    HTTP_PROXY: Optional[str] = None

    # Client location and trusted reverse-proxy configuration
    GEOIP_DATABASE_PATH: str = "app/data/GeoLite2-City.mmdb"
    GEOIP_RELOAD_INTERVAL_SECONDS: int = Field(default=3600, ge=1)
    TRUST_PROXY_HEADERS: bool = False
    TRUSTED_PROXY_IPS: str = ""
    LOCAL_DEVELOPMENT_IP: str = ""
    DEFAULT_LOCATION_LAT: float = Field(default=30.3753, ge=-90, le=90)
    DEFAULT_LOCATION_LNG: float = Field(default=69.3451, ge=-180, le=180)
    DEFAULT_LOCATION_CITY: str = "Pakistan Centre"
    DEFAULT_LOCATION_COUNTRY: str = "Pakistan"
    DEFAULT_LOCATION_COUNTRY_CODE: str = "PK"
    NEARBY_ALERT_DEFAULT_LIMIT: int = Field(default=50, ge=1)
    NEARBY_ALERT_MAX_LIMIT: int = Field(default=200, ge=1)
    NEARBY_ALERT_DEFAULT_RADIUS_KM: Optional[float] = Field(default=None, ge=1)
    NEARBY_ALERT_MAX_RADIUS_KM: float = Field(default=5000.0, ge=1)
    NEARBY_ALERT_FALLBACK_SCAN_LIMIT: int = Field(default=2000, ge=1)
    
    # Scheduler Config
    SCRAPER_MAX_POLL_INTERVAL_MINUTES: int = 5
    SCHEDULER_EARTHQUAKE_INTERVAL_MINUTES: int = 5
    SCHEDULER_FFD_INTERVAL_MINUTES: int = 10
    SCHEDULER_NDMA_INTERVAL_MINUTES: int = 10
    SCHEDULER_PMD_WEATHER_INTERVAL_MINUTES: int = 20

    @model_validator(mode="after")
    def validate_nearby_limits(self):
        if self.NEARBY_ALERT_DEFAULT_LIMIT > self.NEARBY_ALERT_MAX_LIMIT:
            raise ValueError(
                "NEARBY_ALERT_DEFAULT_LIMIT cannot exceed NEARBY_ALERT_MAX_LIMIT"
            )
        if (
            self.NEARBY_ALERT_DEFAULT_RADIUS_KM is not None
            and self.NEARBY_ALERT_DEFAULT_RADIUS_KM
            > self.NEARBY_ALERT_MAX_RADIUS_KM
        ):
            raise ValueError(
                "NEARBY_ALERT_DEFAULT_RADIUS_KM cannot exceed "
                "NEARBY_ALERT_MAX_RADIUS_KM"
            )
        return self

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_ignore_empty=True,
    )

settings = Settings()
