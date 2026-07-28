"""WebSocket route exposing the live-alert stream.

Clients connect to ``/api/v1/ws/alerts`` and receive JSON messages
shaped like::

    {
        "type": "alert.created" | "alert.updated",
        "alert": { ... Alert Pydantic schema ... }
    }

The endpoint itself does no business logic — it simply registers the
connection with the global :class:`WebSocketManager` and blocks until
the client goes away. The scraper pipeline is what actually calls
``broadcast()`` (see Step 2).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket) -> None:
    """Long-lived WebSocket for live alert pushes.

    We accept the connection, then loop on ``receive_text`` purely to
    detect client-initiated close frames and pings. Any inbound payload
    is ignored — the protocol is server-push only. If you later want
    client-side filtering (e.g. "only send floods in Sindh"), this is
    where you'd parse and apply it.
    """
    await ws_manager.connect(websocket)
    try:
        while True:
            # ``receive_text`` raises WebSocketDisconnect when the client
            # closes; any other exception means the socket is dead too.
            await websocket.receive_text()
    except WebSocketDisconnect:
        # Normal client-initiated close.
        pass
    except Exception as exc:  # noqa: BLE001 - log & cleanup, don't crash
        logger.warning("WebSocket loop ended with error: %s", exc)
    finally:
        await ws_manager.disconnect(websocket)