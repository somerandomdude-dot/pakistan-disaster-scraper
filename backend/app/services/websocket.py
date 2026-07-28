"""WebSocket connection manager for broadcasting live alerts to clients.

A thin wrapper around FastAPI/Starlette WebSocket objects that keeps
track of currently connected clients and lets the rest of the app
fan-out JSON payloads (e.g. newly scraped alerts) to every active
listener without blocking the request that produced them.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, Literal, Set

from fastapi import WebSocket

from app.schemas.alert import Alert as AlertSchema

AlertEventType = Literal["alert.created", "alert.updated"]

logger = logging.getLogger(__name__)


class WebSocketManager:
    """Tracks active WebSocket connections and broadcasts messages to them.

    The manager is intentionally simple: a single in-memory set of
    connections plus a single asyncio lock to guard mutations. For the
    traffic profile of this app (low-frequency alert pushes, hundreds
    of clients max) this is more than sufficient and avoids pulling in
    Redis/pub-sub infrastructure.

    Concurrency notes
    -----------------
    * ``connect``/``disconnect`` mutate ``self._connections`` under a lock
      so two clients joining/closing simultaneously can't corrupt state.
    * ``broadcast`` snapshots the connection set under the lock and then
      sends outside the lock — a slow client cannot stall other
      broadcasts, and we won't deadlock if a send raises.
    """

    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        """Accept a new client and register it for future broadcasts."""
        # ``accept`` must be called before the first send/receive.
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)
        logger.info(
            "WebSocket connected (total=%d)", len(self._connections)
        )

    async def disconnect(self, websocket: WebSocket) -> None:
        """Remove a client from the broadcast set.

        Errors during removal are swallowed — a client that already
        dropped is the expected case after a network blip.
        """
        async with self._lock:
            self._connections.discard(websocket)
        logger.info(
            "WebSocket disconnected (total=%d)", len(self._connections)
        )

    async def broadcast(self, message: Dict[str, Any]) -> None:
        """Send a JSON payload to every connected client.

        Clients that error out (closed socket, slow consumer, etc.) are
        silently dropped from the manager so one bad apple doesn't keep
        failing every subsequent broadcast.
        """
        async with self._lock:
            connections = list(self._connections)

        if not connections:
            return

        dead: list[WebSocket] = []
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception as exc:  # noqa: BLE001 - best-effort cleanup
                logger.warning("Dropping WebSocket after send failure: %s", exc)
                dead.append(connection)

        if dead:
            async with self._lock:
                for connection in dead:
                    self._connections.discard(connection)
            logger.info(
                "Pruned %d dead WebSocket(s); %d remain",
                len(dead),
                len(self._connections),
            )

    @property
    def connection_count(self) -> int:
        return len(self._connections)


# Module-level singleton — the rest of the app imports ``ws_manager``
# directly rather than threading an instance through DI.
ws_manager = WebSocketManager()


# ---------------------------------------------------------------------------
# Alert event helpers
# ---------------------------------------------------------------------------
#
# Centralising the envelope (``type`` + ``alert``) here means the wire
# protocol is defined in exactly one place. The frontend hook in Step 3
# keys off ``type``; consumers of the ``alert`` payload get the same
# Pydantic shape the REST list endpoint returns (raw_text stripped — see
# ``app/api/alerts.py::_list_payload``) so the React Query cache stays
# shape-consistent between the HTTP seed and WS deltas.


def _serialize_alert_for_ws(alert: "object") -> dict:
    """Serialize a SQLAlchemy ``Alert`` for the WS payload.

    Mirrors ``app.api.alerts._list_payload``: produces the Pydantic
    schema and then drops ``raw_text`` so we don't ship the full
    bulletin text over every push.
    """
    schema = AlertSchema.model_validate(alert)
    return schema.model_copy(update={"raw_text": None}).model_dump(mode="json")


async def broadcast_alert(event_type: AlertEventType, alert: "object") -> None:
    """Push an alert event to every connected WebSocket client.

    Safe to call from a sync context that lives in the FastAPI event
    loop (the APScheduler ``AsyncIOScheduler`` runs jobs in the same
    loop as the HTTP handlers, so this ``await`` lands on the loop
    directly).

    No-op when there are no connected clients — saves the cost of
    building the JSON envelope during quiet periods.
    """
    if ws_manager.connection_count == 0:
        return

    payload = {
        "type": event_type,
        "alert": _serialize_alert_for_ws(alert),
    }
    await ws_manager.broadcast(payload)