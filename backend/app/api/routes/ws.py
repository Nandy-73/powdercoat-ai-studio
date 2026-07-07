"""WebSocket channel for live notifications (batch updates, validation events)."""

import asyncio
import json

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.logging import get_logger

logger = get_logger("ws")
router = APIRouter()


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        async with self._lock:
            self.connections.append(ws)

    async def disconnect(self, ws: WebSocket) -> None:
        async with self._lock:
            if ws in self.connections:
                self.connections.remove(ws)

    async def broadcast(self, event: str, payload: dict) -> None:
        message = json.dumps({"event": event, "payload": payload})
        async with self._lock:
            stale = []
            for ws in self.connections:
                try:
                    await ws.send_text(message)
                except Exception:
                    stale.append(ws)
            for ws in stale:
                self.connections.remove(ws)


manager = ConnectionManager()


@router.websocket("/ws/notifications")
async def notifications(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            raw = await ws.receive_text()
            # echo pings; broadcast client-originated events to other sessions
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if data.get("event") == "ping":
                await ws.send_text(json.dumps({"event": "pong", "payload": {}}))
            else:
                await manager.broadcast(data.get("event", "message"), data.get("payload", {}))
    except WebSocketDisconnect:
        await manager.disconnect(ws)
    except Exception:
        logger.exception("WebSocket error")
        await manager.disconnect(ws)
