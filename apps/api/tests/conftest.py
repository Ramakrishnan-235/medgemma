import uuid
from collections.abc import AsyncGenerator
import pytest
import pytest_asyncio
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.deps import AuthenticatedPrincipal, get_current_principal
from app.core.config import settings
from app.core.storage import storage_adapter
from app.db.session import get_db
from app.main import app

WORKSPACE_A_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_A_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")

WORKSPACE_B_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_B_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


@pytest.fixture
def workspace_a_ids() -> tuple[uuid.UUID, uuid.UUID]:
    return WORKSPACE_A_ID, USER_A_ID


@pytest.fixture
def workspace_b_ids() -> tuple[uuid.UUID, uuid.UUID]:
    return WORKSPACE_B_ID, USER_B_ID


@pytest.fixture
def workspace_a_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token-workspace-a"}


@pytest.fixture
def workspace_b_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token-workspace-b"}


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    session_factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        await session.execute(
            text(
                "TRUNCATE TABLE image_annotations, report_versions, job_outbox, "
                "ai_runs, evidence_chunks, source_files, cases RESTART IDENTITY CASCADE;"
            )
        )
        await session.commit()
        yield session

    await engine.dispose()


@pytest_asyncio.fixture
async def async_client(
    db_session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> AsyncGenerator[AsyncClient, None]:
    # Stub presigned URL generation so CI runs without requiring live S3 network calls
    monkeypatch.setattr(
        storage_adapter,
        "create_presigned_get_url",
        lambda key, expires_in=900: f"http://localhost:9000/mock-bucket/{key}?expires={expires_in}",
    )
    monkeypatch.setattr(
        storage_adapter,
        "create_presigned_put_url",
        lambda key, mime_type, expires_in=900: f"http://localhost:9000/mock-bucket/{key}?put=1",
    )

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    async def _override_get_principal(request: Request) -> AuthenticatedPrincipal:
        auth = request.headers.get("Authorization", "")
        if "workspace-b" in auth:
            return AuthenticatedPrincipal(user_id=USER_B_ID, workspace_id=WORKSPACE_B_ID)
        return AuthenticatedPrincipal(user_id=USER_A_ID, workspace_id=WORKSPACE_A_ID)

    app.dependency_overrides[get_db] = _override_get_db
    app.dependency_overrides[get_current_principal] = _override_get_principal

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()
