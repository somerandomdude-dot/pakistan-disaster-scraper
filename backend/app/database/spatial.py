import logging

from sqlalchemy import text
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.exc import SQLAlchemyError

logger = logging.getLogger(__name__)

POSTGIS_SCHEMA_STATEMENTS = (
    "CREATE EXTENSION IF NOT EXISTS postgis",
    """
    ALTER TABLE alert_locations
    ADD COLUMN IF NOT EXISTS location_geography geography(POINT, 4326)
    """,
    """
    UPDATE alert_locations
    SET location_geography = CAST(
        ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
        AS geography
    )
    WHERE latitude BETWEEN -90 AND 90
      AND longitude BETWEEN -180 AND 180
      AND latitude IS NOT NULL
      AND longitude IS NOT NULL
      AND (
          location_geography IS NULL
          OR ST_X(CAST(location_geography AS geometry)) <> longitude
          OR ST_Y(CAST(location_geography AS geometry)) <> latitude
      )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_alert_locations_geography
    ON alert_locations USING GIST (location_geography)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_alert_locations_alert_id
    ON alert_locations (alert_id)
    """,
    """
    CREATE OR REPLACE FUNCTION sync_alert_location_geography()
    RETURNS trigger AS $$
    BEGIN
        IF NEW.latitude IS NOT NULL
           AND NEW.longitude IS NOT NULL
           AND NEW.latitude BETWEEN -90 AND 90
           AND NEW.longitude BETWEEN -180 AND 180 THEN
            NEW.location_geography = CAST(
                ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)
                AS geography
            );
        ELSE
            NEW.location_geography = NULL;
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
    """,
    "DROP TRIGGER IF EXISTS trg_sync_alert_location_geography ON alert_locations",
    """
    CREATE TRIGGER trg_sync_alert_location_geography
    BEFORE INSERT OR UPDATE OF latitude, longitude
    ON alert_locations
    FOR EACH ROW
    EXECUTE FUNCTION sync_alert_location_geography()
    """,
)


def apply_postgis_schema(connection: Connection) -> None:
    for statement in POSTGIS_SCHEMA_STATEMENTS:
        connection.execute(text(statement))


def ensure_postgis_schema(engine: Engine) -> bool:
    if engine.dialect.name != "postgresql":
        logger.info("PostGIS proximity query disabled for non-PostgreSQL database")
        return False
    try:
        with engine.begin() as connection:
            apply_postgis_schema(connection)
    except SQLAlchemyError:
        logger.exception(
            "PostGIS schema setup failed; nearby alerts will use the bounded fallback"
        )
        return False
    logger.info("PostGIS geography column, synchronization trigger, and GiST index are ready")
    return True
