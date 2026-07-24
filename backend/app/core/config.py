from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional

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
    
    # Scheduler Config
    SCRAPER_MAX_POLL_INTERVAL_MINUTES: int = 5
    SCHEDULER_EARTHQUAKE_INTERVAL_MINUTES: int = 5
    SCHEDULER_FFD_INTERVAL_MINUTES: int = 10
    SCHEDULER_NDMA_INTERVAL_MINUTES: int = 10
    SCHEDULER_PMD_WEATHER_INTERVAL_MINUTES: int = 20

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
