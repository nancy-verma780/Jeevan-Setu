"""Background timeout checker. Assumes a single API process, as the paper notes."""

import asyncio
import logging

from starlette.concurrency import run_in_threadpool

from app.core.db import session_factory
from app.features.allocation.service import check_timeouts

log = logging.getLogger("jeevansetu.timeouts")


def _run_once() -> int:
    with session_factory()() as db:
        return check_timeouts(db)


async def timeout_loop(interval_seconds: int) -> None:
    while True:
        try:
            handled = await run_in_threadpool(_run_once)
            if handled:
                log.info("timed out assignments handled: %d", handled)
        except Exception:
            log.exception("timeout check failed")
        await asyncio.sleep(interval_seconds)
