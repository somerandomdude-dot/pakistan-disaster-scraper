import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.jobstores.sqlalchemy import SQLAlchemyJobStore
from app.core.config import settings
from app.database.session import engine, SessionLocal
from app.api.admin import run_scraper_task
from app.database.models.source import Source

logger = logging.getLogger(__name__)

jobstores = {
    'default': SQLAlchemyJobStore(engine=engine, tablename='apscheduler_jobs')
}

scheduler = AsyncIOScheduler(jobstores=jobstores, timezone='UTC')

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

def setup_scheduler():
    db = SessionLocal()
    try:
        sources = db.query(Source).filter(Source.is_active == True).all()
        for source in sources:
            job_id = f"scraper_source_{source.id}"
            
            # Prevent overlapping executions with max_instances=1
            scheduler.add_job(
                scheduled_scraper_job,
                'interval',
                minutes=source.polling_interval_minutes,
                id=job_id,
                args=[source.id],
                replace_existing=True,
                max_instances=1,
                coalesce=True
            )
            logger.info(f"Scheduled job {job_id} every {source.polling_interval_minutes} minutes")
    except Exception as e:
        logger.error(f"Failed to setup scheduler jobs: {e}")
    finally:
        db.close()

def start_scheduler():
    setup_scheduler()
    scheduler.start()
    logger.info("Scheduler started")
