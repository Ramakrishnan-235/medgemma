import uuid
from datetime import datetime
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AuthenticatedPrincipal, get_authorized_case, get_current_principal
from app.db.models import Case, SourceFile
from app.db.session import get_db

router = APIRouter(prefix="/cases", tags=["cases"])


class CreateCaseRequest(BaseModel):
    patient_code: str = Field(..., min_length=1, max_length=64)
    title: str = Field(..., min_length=1, max_length=255)


class SourceFileSummary(BaseModel):
    id: uuid.UUID
    filename: str
    file_kind: str
    mime_type: str
    byte_size: int
    parse_status: str
    created_at: datetime


class CaseResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    patient_code: str
    title: str
    status: str
    created_at: datetime
    sources_count: int = 0


class CaseDetailResponse(CaseResponse):
    source_files: list[SourceFileSummary] = Field(default_factory=list)


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> list[CaseResponse]:
    """Lists all clinical cases strictly scoped to the caller's workspace."""
    stmt = (
        select(Case)
        .where(Case.workspace_id == principal.workspace_id)
        .order_by(desc(Case.created_at))
    )
    result = await db.execute(stmt)
    cases = result.scalars().all()

    items: list[CaseResponse] = []
    for c in cases:
        sources_stmt = select(SourceFile).where(
            SourceFile.case_id == c.id,
            SourceFile.workspace_id == principal.workspace_id,
        )
        sources_res = await db.execute(sources_stmt)
        count = len(sources_res.scalars().all())

        items.append(
            CaseResponse(
                id=c.id,
                workspace_id=c.workspace_id,
                patient_code=c.patient_code,
                title=c.title,
                status=c.status,
                created_at=c.created_at,
                sources_count=count,
            )
        )
    return items


@router.post("", response_model=CaseResponse, status_code=status.HTTP_201_CREATED)
async def create_case(
    req: CreateCaseRequest,
    principal: AuthenticatedPrincipal = Depends(get_current_principal),
    db: AsyncSession = Depends(get_db),
) -> CaseResponse:
    """Creates a new case within the caller's workspace."""
    new_case = Case(
        id=uuid.uuid4(),
        workspace_id=principal.workspace_id,
        patient_code=req.patient_code.strip(),
        title=req.title.strip(),
        status="active",
        created_by=principal.user_id,
    )
    db.add(new_case)
    await db.commit()
    await db.refresh(new_case)

    return CaseResponse(
        id=new_case.id,
        workspace_id=new_case.workspace_id,
        patient_code=new_case.patient_code,
        title=new_case.title,
        status=new_case.status,
        created_at=new_case.created_at,
        sources_count=0,
    )


@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case_detail(
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> CaseDetailResponse:
    """Returns single case details and associated source files."""
    stmt = (
        select(SourceFile)
        .where(
            SourceFile.case_id == case.id,
            SourceFile.workspace_id == case.workspace_id,
        )
        .order_by(desc(SourceFile.created_at))
    )
    res = await db.execute(stmt)
    sources = res.scalars().all()

    source_summaries = [
        SourceFileSummary(
            id=s.id,
            filename=s.filename,
            file_kind=s.file_kind,
            mime_type=s.mime_type,
            byte_size=s.byte_size,
            parse_status=s.parse_status,
            created_at=s.created_at,
        )
        for s in sources
    ]

    return CaseDetailResponse(
        id=case.id,
        workspace_id=case.workspace_id,
        patient_code=case.patient_code,
        title=case.title,
        status=case.status,
        created_at=case.created_at,
        sources_count=len(source_summaries),
        source_files=source_summaries,
    )


@router.get("/{case_id}/sources", response_model=list[SourceFileSummary])
async def list_case_sources(
    case: Case = Depends(get_authorized_case),
    db: AsyncSession = Depends(get_db),
) -> list[SourceFileSummary]:
    """Lists source files attached to this authorized case."""
    stmt = (
        select(SourceFile)
        .where(
            SourceFile.case_id == case.id,
            SourceFile.workspace_id == case.workspace_id,
        )
        .order_by(desc(SourceFile.created_at))
    )
    res = await db.execute(stmt)
    sources = res.scalars().all()

    return [
        SourceFileSummary(
            id=s.id,
            filename=s.filename,
            file_kind=s.file_kind,
            mime_type=s.mime_type,
            byte_size=s.byte_size,
            parse_status=s.parse_status,
            created_at=s.created_at,
        )
        for s in sources
    ]
