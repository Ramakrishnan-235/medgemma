import uuid
from datetime import datetime
from typing import Any

try:
    from pgvector.sqlalchemy import VECTOR
except ImportError:
    from sqlalchemy.types import UserDefinedType
    from sqlalchemy.sql.operators import custom_op

    class VectorComparator(UserDefinedType.Comparator):  # type: ignore[name-defined]
        def cosine_distance(self, other: Any) -> Any:
            return custom_op("<=>")(self.expr, other)

        def l2_distance(self, other: Any) -> Any:
            return custom_op("<->")(self.expr, other)

        def max_inner_product(self, other: Any) -> Any:
            return custom_op("<#>")(self.expr, other)

    class VECTOR(UserDefinedType):  # type: ignore[no-redef]
        cache_ok = True
        comparator_factory = VectorComparator

        def __init__(self, dim: int = 384):
            self.dim = dim

        def get_col_spec(self, **kw: Any) -> str:
            return f"vector({self.dim})"


import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Case(Base):
    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    patient_code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active", server_default="active")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    source_files: Mapped[list["SourceFile"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    evidence_chunks: Mapped[list["EvidenceChunk"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    ai_runs: Mapped[list["AIRun"]] = relationship(back_populates="case", cascade="all, delete-orphan")
    report_versions: Mapped[list["ReportVersion"]] = relationship(back_populates="case", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_cases_workspace_id_id", "workspace_id", "id"),
    )


class SourceFile(Base):
    __tablename__ = "source_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_kind: Mapped[str] = mapped_column(String(32), nullable=False)  # pdf | dicom | image_png | ehr_note
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    byte_size: Mapped[int] = mapped_column(Integer, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    parse_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", server_default="pending")
    parser_version: Mapped[str] = mapped_column(String(32), nullable=False, default="2.0.0-hybrid-ocr", server_default="2.0.0-hybrid-ocr")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="source_files")
    chunks: Mapped[list["EvidenceChunk"]] = relationship(back_populates="source_file", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_source_files_case", "workspace_id", "case_id"),
    )


class EvidenceChunk(Base):
    """
    Stores parsed text spans, page/frame coordinates, and 384-dim E5-small-v2 embeddings.
    Every AI citation resolves to a row in this table or a frame in SourceFile.
    """
    __tablename__ = "evidence_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    source_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False
    )
    page_or_frame: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    # Normalized bounding box: {"x0": 0.1, "y0": 0.2, "x1": 0.85, "y1": 0.28} in 0.0..1.0 space
    bbox_norm: Mapped[dict[str, float] | None] = mapped_column(JSONB, nullable=True)
    section_type: Mapped[str] = mapped_column(String(64), nullable=False, default="body", server_default="body")
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(VECTOR(384), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(64), nullable=False, default="intfloat/e5-small-v2", server_default="intfloat/e5-small-v2")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="evidence_chunks")
    source_file: Mapped["SourceFile"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("idx_evidence_workspace_case", "workspace_id", "case_id"),
    )


class AIRun(Base):
    """
    Authoritative record of every model execution, storing exact model, processor,
    prompt, and source versions alongside validated citations and latency telemetry.
    """
    __tablename__ = "ai_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)  # chat_qa | ehr_summary | xray_analysis | report_draft
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", server_default="queued")  # queued | running | completed | failed | cancelled
    model_checkpoint: Mapped[str] = mapped_column(String(128), nullable=False)
    processor_version: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_template_version: Mapped[str] = mapped_column(String(64), nullable=False)
    input_source_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list, server_default="{}")
    input_payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    output_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case: Mapped["Case"] = relationship(back_populates="ai_runs")


class JobOutbox(Base):
    """
    Transactional Outbox table. Written in the same DB transaction as AIRun or SourceFile.
    Relayed to Redis/Celery with SELECT ... FOR UPDATE SKIP LOCKED.
    """
    __tablename__ = "job_outbox"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aggregate_type: Mapped[str] = mapped_column(String(64), nullable=False)  # ai_run | source_file | report_export
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    celery_task_name: Mapped[str] = mapped_column(String(128), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(64), nullable=False, default="interactive", server_default="interactive")
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict, server_default="{}")
    dispatched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=sa.text("false"))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ReportVersion(Base):
    """
    Immutable versioned report drafts edited in Tiptap.
    """
    __tablename__ = "report_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True
    )
    tiptap_doc_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    citations_snapshot_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft", server_default="draft")  # draft | reviewed | exported
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    export_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="report_versions")

    __table_args__ = (
        UniqueConstraint("case_id", "version_number", name="uq_report_case_version"),
    )


class ImageAnnotation(Base):
    """
    Stores manual clinician annotations and feature-flagged MedGemma 1.5 localization boxes.
    bbox_norm is always stored in the ORIGINAL unpadded image coordinate space [0.0 .. 1.0].
    """
    __tablename__ = "image_annotations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False
    )
    source_file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False
    )
    ai_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True
    )
    frame_index: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    origin: Mapped[str] = mapped_column(String(32), nullable=False, default="manual", server_default="manual")  # manual | model_medgemma
    anatomical_label: Mapped[str] = mapped_column(String(128), nullable=False)
    finding_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Top-left normalized coordinates on the original unpadded image: {"x0": 0.18, "y0": 0.32, "x1": 0.44, "y1": 0.61}
    bbox_norm: Mapped[dict[str, float]] = mapped_column(JSONB, nullable=False)
    review_state: Mapped[str] = mapped_column(String(32), nullable=False, default="accepted", server_default="accepted")  # pending_review | accepted | rejected
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
