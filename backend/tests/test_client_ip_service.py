from ipaddress import ip_address

from starlette.requests import Request

from app.core.config import settings
from app.services.client_ip_service import (
    extract_client_ip,
    is_public_ip,
    normalize_ip,
)


def make_request(
    peer: str | None,
    headers: dict[str, str] | None = None,
) -> Request:
    encoded_headers = [
        (name.lower().encode("ascii"), value.encode("ascii"))
        for name, value in (headers or {}).items()
    ]
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": encoded_headers,
            "client": (peer, 12345) if peer else None,
            "server": ("testserver", 80),
            "scheme": "http",
            "query_string": b"",
        }
    )


def proxy_settings(**updates):
    values = {
        "TRUST_PROXY_HEADERS": True,
        "TRUSTED_PROXY_IPS": "10.0.0.0/8,2001:db8:ffff::/48",
        "LOCAL_DEVELOPMENT_IP": "",
    }
    values.update(updates)
    return settings.model_copy(update=values)


def test_trusted_cf_connecting_ip_has_priority():
    result = extract_client_ip(
        make_request(
            "10.0.0.5",
            {
                "CF-Connecting-IP": "8.8.8.8",
                "X-Forwarded-For": "1.1.1.1",
            },
        ),
        proxy_settings(),
    )
    assert result.address == ip_address("8.8.8.8")
    assert result.source == "cf_connecting_ip"


def test_forwarded_chain_walks_right_to_left_past_trusted_proxies():
    result = extract_client_ip(
        make_request(
            "10.0.0.5",
            {"X-Forwarded-For": "8.8.8.8, 203.0.113.20, 10.1.2.3"},
        ),
        proxy_settings(),
    )
    assert result.address == ip_address("203.0.113.20")
    assert result.source == "x_forwarded_for"


def test_x_real_ip_is_used_from_a_trusted_proxy():
    result = extract_client_ip(
        make_request("10.0.0.5", {"X-Real-IP": "2001:4860:4860::8888"}),
        proxy_settings(),
    )
    assert result.address == ip_address("2001:4860:4860::8888")
    assert result.source == "x_real_ip"


def test_untrusted_peer_cannot_spoof_forwarding_headers():
    result = extract_client_ip(
        make_request("8.8.4.4", {"X-Forwarded-For": "1.2.3.4"}),
        proxy_settings(),
    )
    assert result.address == ip_address("8.8.4.4")
    assert result.source == "request_client"


def test_headers_are_ignored_when_proxy_trust_is_disabled():
    result = extract_client_ip(
        make_request("8.8.4.4", {"CF-Connecting-IP": "1.2.3.4"}),
        proxy_settings(TRUST_PROXY_HEADERS=False),
    )
    assert result.address == ip_address("8.8.4.4")


def test_malformed_forwarded_chain_falls_back_without_crashing():
    result = extract_client_ip(
        make_request(
            "10.0.0.5",
            {"X-Forwarded-For": "8.8.8.8, definitely-not-an-ip"},
        ),
        proxy_settings(),
    )
    assert result.address == ip_address("10.0.0.5")
    assert result.invalid_input is True


def test_ipv4_mapped_ipv6_is_normalized():
    assert normalize_ip("::ffff:192.0.2.10") == ip_address("192.0.2.10")


def test_loopback_private_and_documentation_addresses_are_not_public():
    assert not is_public_ip(ip_address("127.0.0.1"))
    assert not is_public_ip(ip_address("10.0.0.1"))
    assert not is_public_ip(ip_address("192.0.2.1"))
    assert not is_public_ip(ip_address("::1"))


def test_local_development_ip_can_replace_a_loopback_peer():
    result = extract_client_ip(
        make_request("127.0.0.1"),
        proxy_settings(
            TRUST_PROXY_HEADERS=False,
            LOCAL_DEVELOPMENT_IP="8.8.8.8",
        ),
    )
    assert result.address == ip_address("8.8.8.8")
    assert result.is_local_development is True


def test_missing_client_ip_is_reported_as_invalid():
    result = extract_client_ip(make_request(None), proxy_settings())
    assert result.address is None
    assert result.invalid_input is True
