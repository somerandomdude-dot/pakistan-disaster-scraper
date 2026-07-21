# Pakistan Natural-Disaster Alert Backend

This is an unofficial third-party system that processes publicly available information from official sources. Users should verify critical information through the linked official source.

## Architecture

The backend scraper system collects natural disaster alerts from official Pakistani government sources (NDMA, PMD, FFD). 

**Data Flow Pipeline:**
`Fetcher -> Raw Document Storage -> Parser -> Normalizer -> Validator -> Deduplicator -> Alert Processor -> PostgreSQL -> REST API`

## Components
- **FastAPI**: REST API layer.
- **APScheduler**: Task scheduling for scrapers.
- **SQLAlchemy & Alembic**: Database ORM and migrations.
- **HTTPX & BeautifulSoup**: Asynchronous fetching and parsing.

## Setup Instructions

### Environment Configuration
Copy the `.env.example` file to `.env` and configure the environment variables:
```bash
cp .env.example .env
```
Ensure `ADMIN_API_KEY` is changed in production.

### Docker Usage
The project includes a `docker-compose.yml` that sets up both the FastAPI backend and a PostgreSQL database.

```bash
docker compose up --build
```
This will start the application on `http://localhost:8000`. Migrations are applied automatically on startup.

### Manual Setup (Without Docker)
1. Create a virtual environment: `python3 -m venv venv && source venv/bin/activate`
2. Install dependencies: `pip install -r requirements.txt`
3. Setup PostgreSQL database and update `DATABASE_URL` in `.env`.
4. Run migrations: `alembic upgrade head`
5. Start API: `uvicorn app.main:app --reload`

## API Endpoints

- `GET /health` - Health check
- `GET /api/v1/alerts/active` - Retrieve active/pending alerts (with filtering)
- `GET /api/v1/sources` - List all sources
- `POST /api/v1/admin/sources/{source_id}/run` - Trigger a scraper manually (requires `x-admin-api-key` header)

## Testing
Run tests using Pytest:
```bash
PYTHONPATH=. pytest tests/
```

## Deduplication Strategy
Deduplication is achieved by generating a robust content hash based on critical fields (source, hazard type, locations, normalized severity, times, and cleaned description). 
- If the hash matches an existing alert, it is **ignored**.
- If important fields change but it's the same alert ID, a new **AlertRevision** is created and the alert is updated.

## Adding a New Source Scraper
1. Create a new subclass of `BaseScraper` in `app/scrapers/`.
2. Implement `fetch()`, `parse()`, and `normalize()`.
3. Add the scraper class mapping to `run_scraper_task` in `app/api/admin.py`.
4. Ensure the source exists in the database `sources` table.

## Important Notes
- Ensure network access to government domains.
- PDFs are intended to be stored in object/file storage instead of PostgreSQL binary.
- This system enforces polite polling and handles rate limits (HTTP 429).
