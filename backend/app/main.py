import asyncio
import contextlib
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import install_handlers
from app.features.admin.router import router as admin_router
from app.features.allocation.worker import timeout_loop
from app.features.auth.router import router as auth_router
from app.features.drill.router import router as drill_router
from app.features.emergencies.router import router as emergencies_router
from app.features.hospitals.router import router as hospitals_router
from app.features.images.router import router as images_router
from app.features.staff.router import router as staff_router


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    task = asyncio.create_task(timeout_loop(settings.timeout_poll_seconds)) if settings.run_timeout_checker else None
    try:
        yield
    finally:
        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="JeevanSetu API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "Idempotency-Key"],
    )
    install_handlers(app)
    app.include_router(auth_router)
    app.include_router(emergencies_router)
    app.include_router(staff_router)
    app.include_router(images_router)
    app.include_router(hospitals_router)
    app.include_router(drill_router)
    app.include_router(admin_router)

    @app.get("/api/health", tags=["meta"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
