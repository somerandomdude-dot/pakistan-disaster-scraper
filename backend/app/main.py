from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api import alerts, sources, admin
import logging

logger = logging.getLogger(__name__)

from contextlib import asynccontextmanager
from app.jobs.scheduler import start_scheduler, stop_scheduler
from app.database.session import SessionLocal, engine
from app.database.base import Base
from app.database.models.source import Source
import json
import os

def init_sources():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        sources_file = os.path.join(os.path.dirname(__file__), "core", "sources.json")
        if os.path.exists(sources_file):
            with open(sources_file, "r") as f:
                sources_data = json.load(f)
                for s_data in sources_data:
                    existing = db.query(Source).filter(Source.name == s_data["name"]).first()
                    if not existing:
                        new_source = Source(
                            name=s_data["name"],
                            base_url=s_data["base_url"],
                            scrape_url=s_data["scrape_url"],
                            source_type=s_data["source_type"],
                            polling_interval_minutes=s_data["polling_interval_minutes"],
                            is_active=True
                        )
                        db.add(new_source)
            db.commit()
    except Exception as e:
        logger.error(f"Error initializing sources: {e}")
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_sources()
    scheduler = start_scheduler()
    yield
    # Shutdown
    stop_scheduler(scheduler)

app = FastAPI(
    title="Pakistan Natural Disaster Alerts API",
    description="Unofficial third-party system processing publicly available information from official sources.",
    version="1.0.0",
    lifespan=lifespan
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

app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(sources.router, prefix="/api/v1/sources", tags=["Sources"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["Admin"])
