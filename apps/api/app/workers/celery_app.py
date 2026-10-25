from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "medgemma_workers",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_routes={
        "app.workers.tasks.interactive.*": {"queue": "interactive"},
        "app.workers.tasks.bulk.*": {"queue": "bulk"},
    },
)


@celery_app.task(name="app.workers.tasks.interactive.ping")
def ping_task() -> dict[str, str]:
    return {"status": "pong", "mode": settings.MEDGEMMA_MODE}
