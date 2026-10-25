import uuid
from dataclasses import dataclass
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_better_auth_jwt
from app.db.models import Case
from app.db.session import get_db

bearer_scheme = HTTPBearer(auto_error=True)


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    user_id: uuid.UUID
    workspace_id: uuid.UUID


async def get_current_principal(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthenticatedPrincipal:
    claims = await verify_better_auth_jwt(creds.credentials)
    try:
        user_id = uuid.UUID(str(claims["sub"]))
        workspace_id = uuid.UUID(str(claims["workspace_id"]))
    except (ValueError, TypeError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token claims 'sub' and 'workspace_id' must be valid UUIDs",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return AuthenticatedPrincipal(
        user_id=user_id,
        workspace_id=workspace_id,
    )


async def get_authorized_case(
    case_id: uuid.UUID,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> Case:
    """
    Returns 404 (never 403) if a case belongs to another workspace so UUID probing
    leaks zero existence metadata across tenants.
    """
    stmt = select(Case).where(
        Case.id == case_id,
        Case.workspace_id == principal.workspace_id,
    )
    result = await db.execute(stmt)
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case not found")
    return case
