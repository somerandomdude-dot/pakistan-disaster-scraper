from ipaddress import ip_address
from types import SimpleNamespace

from geoip2.errors import AddressNotFoundError

from app.core.config import settings
from app.schemas.nearby_alert import GeoIPDetectionMethod
from app.services.client_ip_service import ClientIPResult
from app.services.geoip_service import GeoIPService


def geoip_settings(database_path, **updates):
    values = {
        "GEOIP_DATABASE_PATH": str(database_path),
        "GEOIP_RELOAD_INTERVAL_SECONDS": 1,
        "DEFAULT_LOCATION_LAT": 30.3753,
        "DEFAULT_LOCATION_LNG": 69.3451,
        "DEFAULT_LOCATION_CITY": "Pakistan Centre",
        "DEFAULT_LOCATION_COUNTRY": "Pakistan",
        "DEFAULT_LOCATION_COUNTRY_CODE": "PK",
    }
    values.update(updates)
    return settings.model_copy(update=values)


def record(latitude=31.5204, longitude=74.3587, city="Lahore"):
    return SimpleNamespace(
        location=SimpleNamespace(latitude=latitude, longitude=longitude),
        city=SimpleNamespace(name=city),
        subdivisions=SimpleNamespace(
            most_specific=SimpleNamespace(name="Punjab")
        ),
        country=SimpleNamespace(name="Pakistan", iso_code="PK"),
    )


class FakeReader:
    def __init__(self, response=None, error=None):
        self.response = response or record()
        self.error = error
        self.closed = False

    def city(self, _address):
        if self.error:
            raise self.error
        return self.response

    def close(self):
        self.closed = True


def public_client(local=False):
    return ClientIPResult(
        ip_address("8.8.8.8"),
        "local_development" if local else "request_client",
        is_local_development=local,
    )


def test_successful_lookup_returns_typed_location(monkeypatch, tmp_path):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"test")
    reader = FakeReader()
    monkeypatch.setattr("geoip2.database.Reader", lambda _path: reader)
    service = GeoIPService(geoip_settings(database))
    service.start()

    result = service.resolve(public_client())

    assert result.latitude == 31.5204
    assert result.longitude == 74.3587
    assert result.city == "Lahore"
    assert result.subdivision == "Punjab"
    assert result.detection_method == GeoIPDetectionMethod.IP
    assert result.is_fallback is False
    service.close()
    assert reader.closed is True


def test_local_development_lookup_is_explicit(monkeypatch, tmp_path):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"test")
    monkeypatch.setattr("geoip2.database.Reader", lambda _path: FakeReader())
    service = GeoIPService(geoip_settings(database))
    service.start()
    result = service.resolve(public_client(local=True))
    assert result.detection_method == GeoIPDetectionMethod.LOCAL_DEVELOPMENT
    assert result.is_fallback is False


def test_address_not_found_uses_fallback(monkeypatch, tmp_path):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"test")
    monkeypatch.setattr(
        "geoip2.database.Reader",
        lambda _path: FakeReader(error=AddressNotFoundError("not found")),
    )
    service = GeoIPService(geoip_settings(database))
    service.start()
    result = service.resolve(public_client())
    assert result.detection_method == GeoIPDetectionMethod.GEOIP_NOT_FOUND_FALLBACK
    assert result.is_fallback is True


def test_missing_database_does_not_crash(tmp_path):
    service = GeoIPService(geoip_settings(tmp_path / "missing.mmdb"))
    service.start()
    result = service.resolve(public_client())
    assert (
        result.detection_method
        == GeoIPDetectionMethod.GEOIP_DATABASE_MISSING_FALLBACK
    )


def test_corrupt_database_does_not_crash(monkeypatch, tmp_path):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"corrupt")
    monkeypatch.setattr(
        "geoip2.database.Reader",
        lambda _path: (_ for _ in ()).throw(ValueError("corrupt")),
    )
    service = GeoIPService(geoip_settings(database))
    service.start()
    result = service.resolve(public_client())
    assert (
        result.detection_method
        == GeoIPDetectionMethod.GEOIP_DATABASE_ERROR_FALLBACK
    )


def test_missing_and_invalid_coordinates_use_fallback(monkeypatch, tmp_path):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"test")
    monkeypatch.setattr(
        "geoip2.database.Reader",
        lambda _path: FakeReader(response=record(latitude=None, longitude=500)),
    )
    service = GeoIPService(geoip_settings(database))
    service.start()
    result = service.resolve(public_client())
    assert result.is_fallback is True
    assert result.detection_method == GeoIPDetectionMethod.GEOIP_NOT_FOUND_FALLBACK


def test_private_and_invalid_ips_have_accurate_methods(tmp_path):
    service = GeoIPService(geoip_settings(tmp_path / "missing.mmdb"))
    private = service.resolve(
        ClientIPResult(ip_address("127.0.0.1"), "request_client")
    )
    invalid = service.resolve(ClientIPResult(None, "unavailable", invalid_input=True))
    assert private.detection_method == GeoIPDetectionMethod.PRIVATE_IP_FALLBACK
    assert invalid.detection_method == GeoIPDetectionMethod.INVALID_IP_FALLBACK
    assert private.is_fallback and invalid.is_fallback


def test_reader_reload_opens_replacement_before_closing_previous(
    monkeypatch, tmp_path
):
    database = tmp_path / "GeoLite2-City.mmdb"
    database.write_bytes(b"first")
    readers = [FakeReader(), FakeReader(response=record(city="Islamabad"))]
    monkeypatch.setattr("geoip2.database.Reader", lambda _path: readers.pop(0))
    service = GeoIPService(geoip_settings(database))
    service.start()
    previous = service._reader
    service._reader_mtime_ns = -1
    service._last_reload_check = 0
    service._reload()
    assert previous.closed is True
    assert service.resolve(public_client()).city == "Islamabad"
