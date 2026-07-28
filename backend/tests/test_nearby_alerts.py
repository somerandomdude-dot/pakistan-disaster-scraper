from datetime import datetime, timedelta, timezone

from app.database.models.alert import Alert
from app.database.models.alert_location import AlertLocation
from app.database.spatial import POSTGIS_SCHEMA_STATEMENTS
from app.services.nearby_alert_service import (
    NearbyAlertService,
    POSTGIS_NEARBY_SQL,
    haversine_distance_km,
)


def add_alert(
    db_session,
    source,
    *,
    title,
    severity="medium",
    hazard_type="flood",
    status="active",
    issued_minutes_ago=0,
    locations=(),
):
    alert = Alert(
        source_id=source.id,
        source_alert_id=title,
        title=title,
        description=title,
        hazard_type=hazard_type,
        normalized_severity=severity,
        issued_at=datetime.now(timezone.utc)
        - timedelta(minutes=issued_minutes_ago),
        status=status,
        source_url="https://example.test/alert",
        content_hash=f"nearby-{title}",
    )
    alert.locations = [
        AlertLocation(
            raw_location=location.get("name", "Location"),
            canonical_name=location.get("name"),
            entity_type=location.get("type", "CITY"),
            latitude=location.get("lat"),
            longitude=location.get("lng"),
        )
        for location in locations
    ]
    db_session.add(alert)
    db_session.commit()
    return alert


def test_known_and_zero_distance_haversine_values():
    assert haversine_distance_km(31.5204, 74.3587, 31.5204, 74.3587) == 0
    lahore_to_karachi = haversine_distance_km(
        31.5204, 74.3587, 24.8607, 67.0011
    )
    assert 1010 < lahore_to_karachi < 1040


def test_nearest_alert_first_and_multiple_locations_are_deduplicated(
    client, db_session, pmd_source
):
    near = add_alert(
        db_session,
        pmd_source,
        title="Near",
        severity="high",
        locations=[
            {"name": "Karachi", "lat": 24.8607, "lng": 67.0011},
            {"name": "Pakistan Centre", "lat": 30.3753, "lng": 69.3451},
        ],
    )
    far = add_alert(
        db_session,
        pmd_source,
        title="Far",
        locations=[{"name": "Lahore", "lat": 31.5204, "lng": 74.3587}],
    )
    add_alert(
        db_session,
        pmd_source,
        title="No coordinates",
        locations=[{"name": "Unknown", "lat": None, "lng": None}],
    )

    response = client.get(
        "/api/v1/alerts/nearby?limit=10",
        headers={"X-Forwarded-For": "8.8.8.8"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["alerts"]] == [near.id, far.id]
    assert payload["alerts"][0]["distance_km"] == 0
    assert payload["alerts"][0]["distance_basis"]["location_name"] == "Pakistan Centre"
    assert payload["user_location"]["is_fallback"] is True
    assert payload["user_location"]["detection_method"] == "invalid_ip_fallback"
    assert "ip" not in payload["user_location"]


def test_radius_filter_pagination_and_filters(client, db_session, pmd_source):
    add_alert(
        db_session,
        pmd_source,
        title="Exact critical",
        severity="critical",
        hazard_type="earthquake",
        locations=[{"name": "Centre", "lat": 30.3753, "lng": 69.3451}],
    )
    add_alert(
        db_session,
        pmd_source,
        title="Nearby medium",
        severity="medium",
        hazard_type="flood",
        locations=[{"name": "Nearby", "lat": 30.38, "lng": 69.35}],
    )
    add_alert(
        db_session,
        pmd_source,
        title="Far high",
        severity="high",
        hazard_type="earthquake",
        locations=[{"name": "Lahore", "lat": 31.5204, "lng": 74.3587}],
    )
    add_alert(
        db_session,
        pmd_source,
        title="Expired",
        status="expired",
        locations=[{"name": "Centre", "lat": 30.3753, "lng": 69.3451}],
    )

    radius = client.get("/api/v1/alerts/nearby?radius_km=1&limit=10").json()
    assert [item["title"] for item in radius["alerts"]] == [
        "Exact critical",
        "Nearby medium",
    ]

    filtered = client.get(
        "/api/v1/alerts/nearby?hazard_type=earthquake&severity=high&limit=10"
    ).json()
    assert [item["title"] for item in filtered["alerts"]] == ["Far high"]

    paged = client.get("/api/v1/alerts/nearby?limit=1&offset=1").json()
    assert paged["pagination"] == {"limit": 1, "offset": 1, "returned": 1}
    assert paged["alerts"][0]["title"] == "Nearby medium"

    expired = client.get(
        "/api/v1/alerts/nearby",
        params={"status": "expired", "source": pmd_source.name, "limit": 10},
    ).json()
    assert [item["title"] for item in expired["alerts"]] == ["Expired"]
    no_source = client.get(
        "/api/v1/alerts/nearby",
        params={"source": "Unknown source", "limit": 10},
    ).json()
    assert no_source["alerts"] == []


def test_equal_distance_uses_severity_then_time_then_id(
    db_session, pmd_source
):
    medium = add_alert(
        db_session,
        pmd_source,
        title="Medium",
        severity="medium",
        issued_minutes_ago=1,
        locations=[{"name": "Same", "lat": 30.4, "lng": 69.4}],
    )
    critical = add_alert(
        db_session,
        pmd_source,
        title="Critical",
        severity="critical",
        issued_minutes_ago=2,
        locations=[{"name": "Same", "lat": 30.4, "lng": 69.4}],
    )
    results = NearbyAlertService(db_session).find(
        user_lat=30.3753,
        user_lng=69.3451,
        radius_km=None,
        limit=10,
        offset=0,
        severity=None,
        hazard_type=None,
        status=None,
        source=None,
    )
    assert [item.id for item in results] == [critical.id, medium.id]


def test_empty_result_and_parameter_validation(client):
    empty = client.get("/api/v1/alerts/nearby")
    assert empty.status_code == 200
    assert empty.json()["alerts"] == []
    assert client.get("/api/v1/alerts/nearby?limit=201").status_code == 422
    assert client.get("/api/v1/alerts/nearby?limit=0").status_code == 422
    assert client.get("/api/v1/alerts/nearby?radius_km=0.5").status_code == 422
    assert client.get("/api/v1/alerts/nearby?radius_km=5001").status_code == 422
    assert client.get("/api/v1/alerts/nearby?offset=-1").status_code == 422


def test_database_errors_return_controlled_response(client, monkeypatch):
    monkeypatch.setattr(
        NearbyAlertService,
        "find",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("secret")),
    )
    response = client.get("/api/v1/alerts/nearby")
    assert response.status_code == 500
    assert response.json() == {
        "detail": "Nearby alerts are temporarily unavailable."
    }
    assert "secret" not in response.text


def test_postgis_query_and_schema_use_spatial_index_primitives():
    assert "JOIN LATERAL" in POSTGIS_NEARBY_SQL
    assert "ST_Distance" in POSTGIS_NEARBY_SQL
    assert "ST_DWithin" in POSTGIS_NEARBY_SQL
    assert "location_geography <-> u.geog" in POSTGIS_NEARBY_SQL
    schema_sql = "\n".join(POSTGIS_SCHEMA_STATEMENTS)
    assert "geography(POINT, 4326)" in schema_sql
    assert "USING GIST (location_geography)" in schema_sql
    assert "ST_MakePoint(NEW.longitude, NEW.latitude)" in schema_sql
