"""Add PostGIS alert-location proximity support.

Revision ID: 20260728_01
Revises:
Create Date: 2026-07-28
"""

from alembic import op

from app.database.base import Base
from app.database import models  # noqa: F401
from app.database.spatial import apply_postgis_schema

revision = "20260728_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    # This repository historically created its core schema at application
    # startup. Keep fresh deployments compatible before adding PostGIS fields.
    Base.metadata.create_all(bind=connection)
    if connection.dialect.name == "postgresql":
        apply_postgis_schema(connection)


def downgrade() -> None:
    connection = op.get_bind()
    if connection.dialect.name != "postgresql":
        return
    op.execute(
        "DROP TRIGGER IF EXISTS trg_sync_alert_location_geography ON alert_locations"
    )
    op.execute("DROP FUNCTION IF EXISTS sync_alert_location_geography()")
    op.execute("DROP INDEX IF EXISTS ix_alert_locations_geography")
    op.execute("DROP INDEX IF EXISTS ix_alert_locations_alert_id")
    op.execute(
        "ALTER TABLE alert_locations DROP COLUMN IF EXISTS location_geography"
    )
