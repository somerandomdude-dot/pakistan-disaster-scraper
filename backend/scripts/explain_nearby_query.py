"""Run the production PostGIS proximity query with EXPLAIN ANALYZE."""

from sqlalchemy import text

from app.core.config import settings
from app.database.session import SessionLocal
from app.services.nearby_alert_service import (
    NearbyAlertService,
    POSTGIS_NEARBY_SQL,
)


def main() -> None:
    with SessionLocal() as session:
        service = NearbyAlertService(session)
        if not service._postgis_available():
            raise SystemExit("PostGIS and location_geography must be available")
        where_clause, parameters = service._where_clause(
            severity=None,
            hazard_type=None,
            status=None,
            source=None,
        )
        parameters.update(
            {
                "user_lat": settings.DEFAULT_LOCATION_LAT,
                "user_lng": settings.DEFAULT_LOCATION_LNG,
                "radius_m": 250_000.0,
                "limit": 50,
                "offset": 0,
            }
        )
        statement = "EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)\n" + (
            POSTGIS_NEARBY_SQL.format(where_clause=where_clause)
        )
        for line in session.execute(text(statement), parameters).scalars():
            print(line)


if __name__ == "__main__":
    main()
