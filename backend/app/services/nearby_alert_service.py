from __future__ import annotations

import math
import threading
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings, settings
from app.database.models.alert import Alert
from app.database.models.source import Source
from app.schemas.nearby_alert import NearbyAlertItem, NearbyDistanceBasis

EARTH_RADIUS_KM = 6371.0088
SEVERITY_PRIORITY = {
    "critical": 0,
    "high": 1,
    "medium": 2,
    "low": 3,
    "unknown": 4,
}
_POSTGIS_CAPABILITY_CACHE: dict[int, bool] = {}
_POSTGIS_CAPABILITY_LOCK = threading.Lock()

POSTGIS_NEARBY_SQL = """
WITH user_location AS (
    SELECT CAST(
        ST_SetSRID(ST_MakePoint(:user_lng, :user_lat), 4326)
        AS geography
    ) AS geog
)
SELECT
    a.id AS alert_id,
    a.title,
    a.normalized_severity AS severity,
    a.hazard_type,
    a.status,
    a.issued_at,
    s.name AS source_name,
    nearest.latitude,
    nearest.longitude,
    nearest.location_name,
    nearest.location_type,
    nearest.distance_m
FROM alerts AS a
JOIN sources AS s ON s.id = a.source_id
CROSS JOIN user_location AS u
JOIN LATERAL (
    SELECT
        al.latitude,
        al.longitude,
        COALESCE(
            al.canonical_name,
            al.city,
            al.district,
            al.province,
            al.raw_location,
            'Advisory Location'
        ) AS location_name,
        COALESCE(al.entity_type, 'LOCATION') AS location_type,
        ST_Distance(al.location_geography, u.geog) AS distance_m
    FROM alert_locations AS al
    WHERE al.alert_id = a.id
      AND al.location_geography IS NOT NULL
      AND (
          CAST(:radius_m AS double precision) IS NULL
          OR ST_DWithin(
              al.location_geography,
              u.geog,
              CAST(:radius_m AS double precision)
          )
      )
    ORDER BY al.location_geography <-> u.geog, al.id ASC
    LIMIT 1
) AS nearest ON TRUE
WHERE {where_clause}
ORDER BY
    nearest.distance_m ASC,
    CASE LOWER(a.normalized_severity)
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
        ELSE 4
    END ASC,
    a.issued_at DESC,
    a.id ASC
LIMIT :limit OFFSET :offset
"""


def valid_coordinates(latitude: object, longitude: object) -> bool:
    try:
        lat = float(latitude)
        lng = float(longitude)
    except (TypeError, ValueError):
        return False
    return (
        math.isfinite(lat)
        and math.isfinite(lng)
        and -90 <= lat <= 90
        and -180 <= lng <= 180
    )


def haversine_distance_km(
    latitude_1: float,
    longitude_1: float,
    latitude_2: float,
    longitude_2: float,
) -> float:
    lat_1, lng_1, lat_2, lng_2 = map(
        math.radians,
        (latitude_1, longitude_1, latitude_2, longitude_2),
    )
    lat_delta = lat_2 - lat_1
    lng_delta = lng_2 - lng_1
    haversine = (
        math.sin(lat_delta / 2) ** 2
        + math.cos(lat_1) * math.cos(lat_2) * math.sin(lng_delta / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(min(1.0, math.sqrt(haversine)))


class NearbyAlertService:
    def __init__(self, db: Session, config: Settings = settings):
        self._db = db
        self._settings = config

    def find(
        self,
        *,
        user_lat: float,
        user_lng: float,
        radius_km: float | None,
        limit: int,
        offset: int,
        severity: str | None,
        hazard_type: str | None,
        status: str | None,
        source: str | None,
    ) -> list[NearbyAlertItem]:
        if self._postgis_available():
            return self._find_with_postgis(
                user_lat=user_lat,
                user_lng=user_lng,
                radius_km=radius_km,
                limit=limit,
                offset=offset,
                severity=severity,
                hazard_type=hazard_type,
                status=status,
                source=source,
            )
        return self._find_with_bounded_haversine(
            user_lat=user_lat,
            user_lng=user_lng,
            radius_km=radius_km,
            limit=limit,
            offset=offset,
            severity=severity,
            hazard_type=hazard_type,
            status=status,
            source=source,
        )

    def _postgis_available(self) -> bool:
        bind = self._db.get_bind()
        if bind.dialect.name != "postgresql":
            return False
        cache_key = id(bind.engine if hasattr(bind, "engine") else bind)
        with _POSTGIS_CAPABILITY_LOCK:
            cached = _POSTGIS_CAPABILITY_CACHE.get(cache_key)
            if cached is not None:
                return cached
            result = self._db.execute(
                text(
                    """
                    SELECT
                        EXISTS (
                            SELECT 1 FROM pg_extension WHERE extname = 'postgis'
                        )
                        AND EXISTS (
                            SELECT 1
                            FROM information_schema.columns
                            WHERE table_name = 'alert_locations'
                              AND column_name = 'location_geography'
                        )
                    """
                )
            ).scalar()
            available = bool(result)
            _POSTGIS_CAPABILITY_CACHE[cache_key] = available
            return available

    @staticmethod
    def _where_clause(
        *,
        severity: str | None,
        hazard_type: str | None,
        status: str | None,
        source: str | None,
    ) -> tuple[str, dict[str, object]]:
        clauses: list[str] = []
        parameters: dict[str, object] = {}
        if status:
            clauses.append("LOWER(a.status) = LOWER(:status)")
            parameters["status"] = status
        else:
            clauses.extend(
                [
                    "a.status IN ('active', 'pending', 'approved')",
                    "(a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)",
                ]
            )
        if severity:
            clauses.append("LOWER(a.normalized_severity) = LOWER(:severity)")
            parameters["severity"] = severity
        if hazard_type:
            clauses.append("LOWER(a.hazard_type) = LOWER(:hazard_type)")
            parameters["hazard_type"] = hazard_type
        if source:
            clauses.append("LOWER(s.name) = LOWER(:source)")
            parameters["source"] = source
        return " AND ".join(clauses) or "TRUE", parameters

    def _find_with_postgis(
        self,
        *,
        user_lat: float,
        user_lng: float,
        radius_km: float | None,
        limit: int,
        offset: int,
        severity: str | None,
        hazard_type: str | None,
        status: str | None,
        source: str | None,
    ) -> list[NearbyAlertItem]:
        where_clause, parameters = self._where_clause(
            severity=severity,
            hazard_type=hazard_type,
            status=status,
            source=source,
        )
        parameters.update(
            {
                "user_lat": user_lat,
                "user_lng": user_lng,
                "radius_m": radius_km * 1000 if radius_km is not None else None,
                "limit": limit,
                "offset": offset,
            }
        )
        rows = self._db.execute(
            text(POSTGIS_NEARBY_SQL.format(where_clause=where_clause)),
            parameters,
        ).mappings()
        return [
            NearbyAlertItem(
                id=row["alert_id"],
                title=row["title"],
                severity=row["severity"],
                hazard_type=row["hazard_type"],
                status=row["status"],
                lat=float(row["latitude"]),
                lng=float(row["longitude"]),
                distance_km=round(float(row["distance_m"]) / 1000.0, 2),
                source=row["source_name"],
                issued_at=row["issued_at"],
                distance_basis=NearbyDistanceBasis(
                    location_name=row["location_name"],
                    latitude=float(row["latitude"]),
                    longitude=float(row["longitude"]),
                    location_type=row["location_type"],
                ),
            )
            for row in rows
        ]

    def _find_with_bounded_haversine(
        self,
        *,
        user_lat: float,
        user_lng: float,
        radius_km: float | None,
        limit: int,
        offset: int,
        severity: str | None,
        hazard_type: str | None,
        status: str | None,
        source: str | None,
    ) -> list[NearbyAlertItem]:
        query = self._db.query(Alert).options(
            selectinload(Alert.locations),
            selectinload(Alert.source),
        )
        if status:
            query = query.filter(Alert.status.ilike(status))
        else:
            now = datetime.now(timezone.utc)
            query = query.filter(Alert.status.in_(["active", "pending", "approved"]))
            query = query.filter((Alert.expires_at.is_(None)) | (Alert.expires_at > now))
        if severity:
            query = query.filter(Alert.normalized_severity.ilike(severity))
        if hazard_type:
            query = query.filter(Alert.hazard_type.ilike(hazard_type))
        if source:
            query = query.join(Alert.source).filter(Source.name.ilike(source))

        scan_limit = min(
            self._settings.NEARBY_ALERT_FALLBACK_SCAN_LIMIT,
            max(limit + offset, 1) * 20,
        )
        candidates = (
            query.order_by(Alert.issued_at.desc(), Alert.id.asc())
            .limit(scan_limit)
            .all()
        )
        ranked: list[tuple[float, Alert, object]] = []
        for alert in candidates:
            locations = [
                location
                for location in alert.locations
                if valid_coordinates(location.latitude, location.longitude)
            ]
            if not locations:
                continue
            distance, nearest = min(
                (
                    (
                        haversine_distance_km(
                            user_lat,
                            user_lng,
                            float(location.latitude),
                            float(location.longitude),
                        ),
                        location,
                    )
                    for location in locations
                ),
                key=lambda entry: (entry[0], entry[1].id),
            )
            if radius_km is not None and distance > radius_km:
                continue
            ranked.append((distance, alert, nearest))

        ranked.sort(
            key=lambda entry: (
                entry[0],
                SEVERITY_PRIORITY.get(
                    (entry[1].normalized_severity or "unknown").lower(), 4
                ),
                -(
                    entry[1].issued_at.timestamp()
                    if entry[1].issued_at is not None
                    else 0
                ),
                entry[1].id,
            )
        )

        response: list[NearbyAlertItem] = []
        for distance, alert, location in ranked[offset : offset + limit]:
            latitude = float(location.latitude)
            longitude = float(location.longitude)
            response.append(
                NearbyAlertItem(
                    id=alert.id,
                    title=alert.title,
                    severity=alert.normalized_severity,
                    hazard_type=alert.hazard_type,
                    status=alert.status,
                    lat=latitude,
                    lng=longitude,
                    distance_km=round(distance, 2),
                    source=alert.source.name,
                    issued_at=alert.issued_at,
                    distance_basis=NearbyDistanceBasis(
                        location_name=(
                            location.canonical_name
                            or location.city
                            or location.district
                            or location.province
                            or location.raw_location
                            or "Advisory Location"
                        ),
                        latitude=latitude,
                        longitude=longitude,
                        location_type=location.entity_type or "LOCATION",
                    ),
                )
            )
        return response
