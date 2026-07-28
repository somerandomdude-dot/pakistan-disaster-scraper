from __future__ import annotations

from dataclasses import dataclass
from ipaddress import (
    IPv4Address,
    IPv4Network,
    IPv6Address,
    IPv6Network,
    ip_address,
    ip_network,
)
from typing import Iterable

from fastapi import Request

from app.core.config import Settings

IPAddress = IPv4Address | IPv6Address
IPNetwork = IPv4Network | IPv6Network


@dataclass(frozen=True)
class ClientIPResult:
    address: IPAddress | None
    source: str
    invalid_input: bool = False
    is_local_development: bool = False


def normalize_ip(value: str | None) -> IPAddress | None:
    if not value:
        return None
    try:
        parsed = ip_address(value.strip())
    except ValueError:
        return None
    if isinstance(parsed, IPv6Address) and parsed.ipv4_mapped:
        return parsed.ipv4_mapped
    return parsed


def parse_trusted_proxy_networks(value: str) -> tuple[IPNetwork, ...]:
    networks: list[IPNetwork] = []
    for entry in value.split(","):
        candidate = entry.strip()
        if not candidate:
            continue
        try:
            networks.append(ip_network(candidate, strict=False))
        except ValueError:
            continue
    return tuple(networks)


def is_trusted_proxy(address: IPAddress, networks: Iterable[IPNetwork]) -> bool:
    return any(
        address.version == network.version and address in network
        for network in networks
    )


def is_public_ip(address: IPAddress) -> bool:
    # is_global excludes private, loopback, link-local, multicast, reserved,
    # unspecified, and documentation/test networks.
    return address.is_global


def _parse_forwarded_chain(value: str) -> list[IPAddress] | None:
    entries = [entry.strip() for entry in value.split(",")]
    if not entries or any(not entry for entry in entries):
        return None
    parsed = [normalize_ip(entry) for entry in entries]
    if any(address is None for address in parsed):
        return None
    return [address for address in parsed if address is not None]


def _client_from_forwarded_chain(
    forwarded: list[IPAddress],
    trusted_networks: tuple[IPNetwork, ...],
) -> IPAddress | None:
    for address in reversed(forwarded):
        if is_trusted_proxy(address, trusted_networks):
            continue
        return address
    return None


def extract_client_ip(request: Request, settings: Settings) -> ClientIPResult:
    peer = normalize_ip(request.client.host if request.client else None)
    trusted_networks = parse_trusted_proxy_networks(settings.TRUSTED_PROXY_IPS)
    can_trust_headers = bool(
        settings.TRUST_PROXY_HEADERS
        and peer
        and trusted_networks
        and is_trusted_proxy(peer, trusted_networks)
    )
    invalid_header = False

    if can_trust_headers:
        cf_value = request.headers.get("cf-connecting-ip")
        if cf_value:
            cf_address = normalize_ip(cf_value)
            if cf_address:
                return ClientIPResult(cf_address, "cf_connecting_ip")
            invalid_header = True

        forwarded_value = request.headers.get("x-forwarded-for")
        if forwarded_value:
            forwarded = _parse_forwarded_chain(forwarded_value)
            if forwarded is not None:
                forwarded_address = _client_from_forwarded_chain(
                    forwarded, trusted_networks
                )
                if forwarded_address:
                    return ClientIPResult(forwarded_address, "x_forwarded_for")
            else:
                invalid_header = True

        real_ip_value = request.headers.get("x-real-ip")
        if real_ip_value:
            real_ip = normalize_ip(real_ip_value)
            if real_ip:
                return ClientIPResult(real_ip, "x_real_ip")
            invalid_header = True

    local_development_ip = normalize_ip(settings.LOCAL_DEVELOPMENT_IP)
    if peer:
        if not is_public_ip(peer) and local_development_ip:
            return ClientIPResult(
                local_development_ip,
                "local_development",
                invalid_input=invalid_header,
                is_local_development=True,
            )
        return ClientIPResult(peer, "request_client", invalid_input=invalid_header)

    if local_development_ip:
        return ClientIPResult(
            local_development_ip,
            "local_development",
            invalid_input=invalid_header,
            is_local_development=True,
        )
    return ClientIPResult(None, "unavailable", invalid_input=True)
