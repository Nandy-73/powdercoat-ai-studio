import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import ai_tools, auth, batches, color, dashboard, formulations, machinery, materials, reports, suppliers, ws
from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.db.session import Base, SessionLocal, engine

setup_logging()
logger = get_logger("main")


async def _auto_ingest_loop():
    """Periodically scan active machinery sources while the app is running."""
    from app.ai.machinery_intel import run_ingestion

    interval = max(1, settings.AUTO_INGEST_HOURS) * 3600
    while True:
        await asyncio.sleep(interval)
        db = SessionLocal()
        try:
            result = await asyncio.to_thread(run_ingestion, db)
            logger.info("Auto machinery scan: %s new suggestion(s)", result["new_suggestions"])
        except Exception:
            logger.exception("Auto machinery scan failed")
        finally:
            db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    if settings.SEED_DATA:
        db = SessionLocal()
        try:
            from app.db.seed import seed

            seed(db)
        finally:
            db.close()

    task = None
    if settings.AUTO_INGEST_ENABLED:
        task = asyncio.create_task(_auto_ingest_loop())

    logger.info("%s started (%s)", settings.APP_NAME, settings.ENVIRONMENT)
    yield

    if task:
        task.cancel()


app = FastAPI(
    title=settings.APP_NAME,
    description="Enterprise AI Platform for Powder Coating Research, Formulation, "
    "Color Matching, Manufacturing, Quality Control, Procurement, and Business Intelligence.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/api/health")
def health():
    return {"status": "ok", "app": settings.APP_NAME}


prefix = settings.API_V1_PREFIX
app.include_router(auth.router, prefix=prefix)
app.include_router(auth.users_router, prefix=prefix)
app.include_router(materials.router, prefix=prefix)
app.include_router(formulations.router, prefix=prefix)
app.include_router(color.router, prefix=prefix)
app.include_router(ai_tools.router, prefix=prefix)
app.include_router(suppliers.router, prefix=prefix)
app.include_router(suppliers.prices_router, prefix=prefix)
app.include_router(machinery.router, prefix=prefix)
app.include_router(machinery.market_router, prefix=prefix)
app.include_router(batches.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(reports.router, prefix=prefix)
app.include_router(ws.router)


# --- Serve the compiled React SPA (present in production/Docker as ./static) ---
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
if _STATIC_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=_STATIC_DIR / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # API and WebSocket routes are registered above and take precedence;
        # anything else falls through to the single-page app.
        if full_path.startswith(("api", "ws")):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        candidate = _STATIC_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_STATIC_DIR / "index.html")

