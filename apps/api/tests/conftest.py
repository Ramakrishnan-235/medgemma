import asyncio
import json
import os
import sqlite3
import sys
import uuid
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from fastapi import Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.pool import StaticPool
from sqlalchemy.sql.expression import BinaryExpression
from sqlalchemy.sql.operators import custom_op

# Add apps/api to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Register sqlite adaptations for Postgres types in test mode
sqlite3.register_adapter(uuid.UUID, str)
sqlite3.register_adapter(list, json.dumps)

@compiles(UUID, "sqlite")
def compile_uuid_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(ARRAY, "sqlite")
def compile_array_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(type_, compiler, **kw):
    return "JSON"

orig_array_rp = ARRAY.result_processor
def custom_array_result_processor(self, dialect, coltype):
    if dialect.name == "sqlite":
        def process(value):
            if value is None:
                return []
            if isinstance(value, str):
                try:
                    data = json.loads(value)
                    if isinstance(data, list):
                        return [uuid.UUID(str(x)) if isinstance(x, str) else x for x in data]
                except Exception:
                    pass
            return value if isinstance(value, list) else []
        return process
    return orig_array_rp(self, dialect, coltype)

ARRAY.result_processor = custom_array_result_processor

from app.db.models import VECTOR

@compiles(VECTOR, "sqlite")
def compile_vector_sqlite(type_, compiler, **kw):
    return "TEXT"

@compiles(BinaryExpression, "sqlite")
def compile_binary_sqlite(binary, compiler, **kw):
    if binary.operator == custom_op("<=>"):
        left = compiler.process(binary.left, **kw)
        return f"{left} IS NOT NULL"
    return compiler.visit_binary(binary, **kw)


from app.api.deps import AuthenticatedPrincipal, get_current_principal
from app.db.models import Base
from app.db.session import get_db
from app.main import app
import app.api.v1.runs as runs_module
import app.db.session as db_session_module
import app.workers.outbox_relay as outbox_relay_module
import app.workers.recovery as recovery_module


WS_A_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
USER_A_ID = uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
WS_B_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
USER_B_ID = uuid.UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


@pytest.fixture
def workspace_a_ids() -> tuple[uuid.UUID, uuid.UUID]:
    return WS_A_ID, USER_A_ID


@pytest.fixture
def workspace_b_ids() -> tuple[uuid.UUID, uuid.UUID]:
    return WS_B_ID, USER_B_ID


@pytest.fixture
def workspace_a_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer token-ws-a-{WS_A_ID}-{USER_A_ID}"}


@pytest.fixture
def workspace_b_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer token-ws-b-{WS_B_ID}-{USER_B_ID}"}


@pytest_asyncio.fixture
async def db_session(monkeypatch) -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )

    # Patch application sessionmaker so background lookups (e.g. SSE stream) hit the same in-memory DB
    monkeypatch.setattr(runs_module, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(db_session_module, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(outbox_relay_module, "AsyncSessionLocal", session_factory)
    monkeypatch.setattr(recovery_module, "AsyncSessionLocal", session_factory)

    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with session_factory() as sess:
            yield sess

    app.dependency_overrides[get_db] = _override_get_db

    async with session_factory() as session:
        yield session

    app.dependency_overrides.pop(get_db, None)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def async_client(db_session: AsyncSession, monkeypatch) -> AsyncGenerator[AsyncClient, None]:
    # Mock Redis client in runs_module to simulate lost/offline Redis notifications cleanly
    mock_pubsub = AsyncMock()
    mock_pubsub.subscribe = AsyncMock()
    mock_pubsub.unsubscribe = AsyncMock()
    mock_pubsub.aclose = AsyncMock()
    mock_pubsub.get_message = AsyncMock(return_value=None)

    mock_redis = AsyncMock()
    mock_redis.pubsub = MagicMock(return_value=mock_pubsub)
    mock_redis.aclose = AsyncMock()

    monkeypatch.setattr("app.api.v1.runs.aioredis.from_url", lambda *args, **kwargs: mock_redis)

    async def _override_get_current_principal(request: Request) -> AuthenticatedPrincipal:
        auth_header = request.headers.get("Authorization", "")
        if "token-ws-b" in auth_header:
            return AuthenticatedPrincipal(user_id=USER_B_ID, workspace_id=WS_B_ID)
        return AuthenticatedPrincipal(user_id=USER_A_ID, workspace_id=WS_A_ID)

    app.dependency_overrides[get_current_principal] = _override_get_current_principal

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.pop(get_current_principal, None)
