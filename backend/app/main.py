import json
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api import admin, alerts, nearby_alerts, sources, ws as ws_api
from app.core.config import settings
from app.database.base import Base
from app.database.models.source import Source
from app.database.session import SessionLocal, engine
from app.database.spatial import ensure_postgis_schema
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.locations.index import warm_location_index
from app.services.geoip_service import geoip_service

logger = logging.getLogger(__name__)


def init_sources():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        sources_file = os.path.join(os.path.dirname(__file__), "core", "sources.json")
        if os.path.exists(sources_file):
            with open(sources_file, "r") as f:
                sources_data = json.load(f)
                for s_data in sources_data:
                    existing = (
                        db.query(Source)
                        .filter(Source.name == s_data["name"])
                        .first()
                    )
                    if not existing:
                        new_source = Source(
                            name=s_data["name"],
                            base_url=s_data["base_url"],
                            scrape_url=s_data["scrape_url"],
                            source_type=s_data["source_type"],
                            polling_interval_minutes=s_data["polling_interval_minutes"],
                            is_active=True,
                        )
                        db.add(new_source)
            db.commit()
    except Exception as e:
        logger.error(f"Error initializing sources: {e}")
    finally:
        db.close()


def ensure_location_schema():
    """Add typed location columns to existing databases without destructive migration."""
    inspector = inspect(engine)
    if "alert_locations" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("alert_locations")}
    typed_columns = {
        "location_id": "VARCHAR",
        "entity_type": "VARCHAR",
        "canonical_name": "VARCHAR",
        "tehsil": "VARCHAR",
        "matched_text": "VARCHAR",
        "text_source": "VARCHAR",
        "match_method": "VARCHAR",
        "start_offset": "INTEGER",
        "end_offset": "INTEGER",
        "evidence_score": "INTEGER",
    }
    with engine.begin() as connection:
        for name, sql_type in typed_columns.items():
            if name not in existing:
                connection.execute(
                    text(f"ALTER TABLE alert_locations ADD COLUMN {name} {sql_type}")
                )
        connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_alert_locations_alert_id "
                "ON alert_locations (alert_id)"
            )
        )


def ensure_alert_schema():
    """Add advisory JSON storage to existing databases without data loss."""
    inspector = inspect(engine)
    if "alerts" not in inspector.get_table_names():
        return
    existing = {column["name"] for column in inspector.get_columns("alerts")}
    if "structured_advisory" not in existing:
        with engine.begin() as connection:
            connection.execute(
                text("ALTER TABLE alerts ADD COLUMN structured_advisory JSON")
            )


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_sources()
    ensure_location_schema()
    ensure_alert_schema()
    ensure_postgis_schema(engine)
    geoip_service.start()
    app.state.geoip_service = geoip_service
    index = warm_location_index()
    logger.info(
        "Location index loaded: %s records in %.2f ms",
        len(index.locations),
        index.load_time_ms,
    )
    scheduler = start_scheduler()
    try:
        yield
    finally:
        # Shutdown
        stop_scheduler(scheduler)
        geoip_service.close()

app = FastAPI(
    title="Pakistan Natural Disaster Alerts API",
    description="Unofficial third-party system processing publicly available information from official sources.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(nearby_alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(sources.router, prefix="/api/v1/sources", tags=["Sources"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
app.include_router(
    ws_api.router,
    prefix="/api/v1",
    tags=["WebSocket"],
)
