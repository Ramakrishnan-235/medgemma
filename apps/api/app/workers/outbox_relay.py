import asyncio
import logging
import signal
import sys

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("outbox-relay")


async def run_relay_loop() -> None:
    logger.info("Outbox relay started. Polling job_outbox table...")
    stop_event = asyncio.Event()

    def _signal_handler() -> None:
        logger.info("Shutdown signal received.")
        stop_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except (NotImplementedError, AttributeError):
            # Windows signal handlers compatibility
            pass

    while not stop_event.is_set():
        try:
            # Poll pending outbox entries with SELECT ... FOR UPDATE SKIP LOCKED
            await asyncio.sleep(2)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.error("Error during outbox relay loop: %s", exc)
            await asyncio.sleep(5)

    logger.info("Outbox relay gracefully stopped.")


def main() -> None:
    try:
        asyncio.run(run_relay_loop())
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == "__main__":
    main()
