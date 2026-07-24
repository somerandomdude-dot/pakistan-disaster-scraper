import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from app.core.config import settings
from app.database.session import engine, SessionLocal
from app.api.admin import run_scraper_task
from app.database.models.source import Source

logger = logging.getLogger(__name__)

def effective_poll_interval(configured_minutes: int) -> int:
    """Keep every active source within the configured maximum polling window."""
    return min(
        max(1, configured_minutes),
        max(1, settings.SCRAPER_MAX_POLL_INTERVAL_MINUTES),
    )

async def scheduled_scraper_job(source_id: int):
    """
    Job wrapper to run the scraper in the scheduler context.
    """
    logger.info(f"Running scheduled job for source_id {source_id}")
    db = SessionLocal()
    try:
        await run_scraper_task(source_id, db)
    finally:
        db.close()

def create_scheduler() -> AsyncIOScheduler:
    return AsyncIOScheduler(
        jobstores={
            "default": SQLAlchemyJobStore(engine=engine, tablename="apscheduler_jobs")
        },
        timezone="UTC",
    )


def setup_scheduler(scheduler: AsyncIOScheduler):
    db = SessionLocal()
    try:
        sources = db.query(Source).filter(Source.is_active == True).all()
        for source in sources:
            job_id = f"scraper_source_{source.id}"
            interval_minutes = effective_poll_interval(source.polling_interval_minutes)
            
            from datetime import datetime, timezone
            # Run immediately on startup, then at standard interval
            scheduler.add_job(
                scheduled_scraper_job,
                'interval',
                minutes=interval_minutes,
                next_run_time=datetime.now(timezone.utc),
                id=job_id,
                args=[source.id],
                replace_existing=True,
                max_instances=1,
                coalesce=True,
                misfire_grace_time=settings.SCRAPER_MAX_POLL_INTERVAL_MINUTES * 60,
            )
            logger.info(
                "Scheduled job %s every %s minute(s) (configured=%s, initial run now)",
                job_id,
                interval_minutes,
                source.polling_interval_minutes,
            )
    except Exception as e:
        logger.error(f"Failed to setup scheduler jobs: {e}")
    finally:
        db.close()

def start_scheduler() -> AsyncIOScheduler:
    scheduler = create_scheduler()
    setup_scheduler(scheduler)
    scheduler.start()
    logger.info("Scheduler started")
    return scheduler


def stop_scheduler(scheduler: AsyncIOScheduler) -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
