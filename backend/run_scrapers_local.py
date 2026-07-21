import asyncio
from app.database.session import SessionLocal
from app.api.admin import run_scraper_task
from app.database.models.source import Source
from app.database.models.alert import Alert

from app.main import init_sources

async def main():
    print("Initializing Database Session...")
    init_sources()
    db = SessionLocal()
    try:
        sources = db.query(Source).all()
        if not sources:
            print("No sources found! Make sure the API is running at least once to initialize sources.")
            return

        print(f"Found {len(sources)} sources. Running scrapers...")
        
        for source in sources:
            print(f"\n--- Scraping {source.name} ---")
            await run_scraper_task(source.id, db)
            
        print("\nScraping complete! Fetching the latest alerts from the database...")
        alerts = db.query(Alert).order_by(Alert.issued_at.desc()).limit(5).all()
        
        for alert in alerts:
            print(f"\n[ALERT] {alert.title} ({alert.hazard_type.upper()})")
            print(f"Severity: {alert.normalized_severity}")
            print(f"Description: {alert.description[:200]}...")
            print(f"Source URL: {alert.source_url}")
            print("-" * 50)
            
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(main())
