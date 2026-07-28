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
- `GET /api/v1/alerts/nearby` - Retrieve coordinate-backed alerts nearest to the visitor
- `GET /api/v1/sources` - List all sources
- `POST /api/v1/admin/sources/{source_id}/run` - Trigger a scraper manually (requires `x-admin-api-key` header)

## Testing
Run tests using Pytest:
```bash
PYTHONPATH=. pytest tests/
```

## Nearby Alerts and Local GeoIP

`GET /api/v1/alerts/nearby` resolves an approximate visitor location using a
local MaxMind GeoLite2 City database. It makes no external geolocation calls
and never returns or persists the visitor's IP address.

1. Download `GeoLite2-City.mmdb` from your licensed MaxMind account.
2. Place it at `backend/app/data/GeoLite2-City.mmdb` for manual development.
3. In Docker, Compose mounts `backend/app/data` read-only and reads the file
   from `/app/data/GeoLite2-City.mmdb`.

The database file is intentionally ignored by Git. If it is absent, corrupt,
or has no record for the client address, the endpoint returns the configured
default coordinates with `is_fallback: true` and an accurate
`detection_method`. Private, loopback, reserved, link-local, multicast,
unspecified, and documentation/test addresses are never sent to MaxMind.

The reader opens once per application worker during startup, checks the file
modification time at `GEOIP_RELOAD_INTERVAL_SECONDS`, atomically replaces a
valid updated reader, and closes during shutdown.

### Reverse-proxy trust

Forwarded IP headers are ignored by default. To enable them, set both:

```env
TRUST_PROXY_HEADERS=true
TRUSTED_PROXY_IPS=10.0.0.10/32,10.0.1.0/24
```

The immediate TCP peer must match one of those addresses or CIDRs. When
trusted, header priority is `CF-Connecting-IP`, `X-Forwarded-For`, then
`X-Real-IP`; forwarded chains are walked from right to left, skipping trusted
proxy hops. Nginx must overwrite incoming forwarding headers, and
`CF-Connecting-IP` should only be preserved when the configured trusted peer
is a confirmed Cloudflare edge or a proxy that strips client-supplied copies.
Do not configure Uvicorn with a wildcard forwarded-allow-ips value.

### PostGIS proximity query

Docker uses the PostGIS PostgreSQL image. Alembic enables PostGIS, adds
`alert_locations.location_geography geography(POINT, 4326)`, backfills valid
coordinates, creates a synchronization trigger, and creates the GiST index
`ix_alert_locations_geography`.

The production query uses a lateral subquery for each alert, KNN
`location_geography <-> user_geography` ordering to select its nearest affected
location, `ST_Distance` for the precise kilometre value, and `ST_DWithin` for
an optional indexed radius filter. This returns one row per alert and applies
stable distance, severity, issue-time, and ID ordering.

SQLite/non-PostGIS development uses a documented bounded Haversine fallback.
It never loads more than `NEARBY_ALERT_FALLBACK_SCAN_LIMIT` candidate alerts,
so PostGIS remains required for large production datasets.

To inspect the production plan and confirm the GiST index is used for a
250-kilometre radius query:

```bash
PYTHONPATH=. python scripts/explain_nearby_query.py
```

The endpoint accepts `radius_km`, `limit`, `offset`, `severity`, `hazard_type`,
`status`, and `source`. Radius and page sizes are bounded by configuration.

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
