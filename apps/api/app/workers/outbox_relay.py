import asyncio
from datetime import datetime, timezone
import logging
import signal
import sys
from typing import Optional

from sqlalchemy import select

from app.db.models import JobOutbox
from app.db.session import AsyncSessionLocal
from app.workers.celery_app import celery_app

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("outbox_relay")


async def relay_outbox_batch() -> int:
    async with AsyncSessionLocal() as db:
        async with db.begin():
            stmt = (
                select(JobOutbox)
                .where(JobOutbox.dispatched.is_(False))
                .order_by(JobOutbox.created_at.asc())
                .limit(25)
                .with_for_update(skip_locked=True)
            )
            rows = (await db.execute(stmt)).scalars().all()
            if not rows:
                return 0

            dispatched_count = 0
            for row in rows:
                try:
                    celery_app.send_task(
                        row.celery_task_name,
                        kwargs=row.payload_json,
                        queue=row.queue_name,
                        task_id=str(row.id),
                    )
                    row.dispatched = True
                    row.attempts += 1
                    row.dispatched_at = datetime.now(timezone.utc)
                    dispatched_count += 1
                except Exception as exc:
                    row.attempts += 1
                    logger.error(
                        "Failed to dispatch outbox task id=%s task=%s: %s",
                        row.id,
                        row.celery_task_name,
                        exc,
                    )

            return dispatched_count


async def run_relay(stop_event: Optional[asyncio.Event] = None) -> None:
    logger.info("Outbox relay worker started.")
    if stop_event is None:
        stop_event = asyncio.Event()

    while not stop_event.is_set():
        try:
            count = await relay_outbox_batch()
            if count == 0:
                await asyncio.sleep(1.0)
            else:
                logger.info("Relayed %d outbox messages to Celery broker", count)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.exception("Unexpected error in outbox relay loop: %s", exc)
            await asyncio.sleep(2.0)

    logger.info("Outbox relay worker stopped.")


def main() -> None:
    stop_event = asyncio.Event()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    def _shutdown() -> None:
        logger.info("Shutdown signal received, draining...")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _shutdown)
        except (NotImplementedError, AttributeError):
            pass

    try:
        loop.run_until_complete(run_relay(stop_event))
    except KeyboardInterrupt:
        sys.exit(0)
    finally:
        loop.close()


if __name__ == "__main__":
    main()
