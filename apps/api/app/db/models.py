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
        comparator_factory = VectorComparator

        def __init__(self, dim: int = 384):
            self.dim = dim

        def get_col_spec(self, **kw: Any) -> str:
            return f"vector({self.dim})"


from sqlalchemy import (
    BigInteger,
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
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    patient_code: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="active")
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
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    file_kind: Mapped[str] = mapped_column(String(32), nullable=False)  # pdf | dicom | image_png | ehr_note
    storage_key: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    sha256_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    byte_size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    parse_status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending")
    parser_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="source_files")
    chunks: Mapped[list["EvidenceChunk"]] = relationship(back_populates="source_file", cascade="all, delete-orphan")


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
        UUID(as_uuid=True), ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False, index=True
    )
    page_or_frame: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Normalized bounding box: {"x0": 0.1, "y0": 0.2, "x1": 0.85, "y1": 0.28} in 0.0..1.0 space
    bbox_norm: Mapped[dict[str, float] | None] = mapped_column(JSONB, nullable=True)
    section_type: Mapped[str] = mapped_column(String(64), nullable=False, default="body")
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float]] = mapped_column(VECTOR(384), nullable=False)
    embedding_model: Mapped[str] = mapped_column(String(64), nullable=False, default="intfloat/e5-small-v2")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="evidence_chunks")
    source_file: Mapped["SourceFile"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("idx_evidence_workspace_case", "workspace_id", "case_id"),
        Index(
            "idx_evidence_embedding_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_with={"m": 16, "ef_construction": 64},
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class AIRun(Base):
    """
    Authoritative record of every model execution, storing exact model, processor,
    prompt, and source versions alongside validated citations and latency telemetry.
    """
    __tablename__ = "ai_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)  # chat_qa | ehr_summary | xray_analysis | report_draft
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")  # queued | running | completed | failed | cancelled
    model_checkpoint: Mapped[str] = mapped_column(String(128), nullable=False)
    processor_version: Mapped[str] = mapped_column(String(64), nullable=False)
    prompt_template_version: Mapped[str] = mapped_column(String(64), nullable=False)
    input_source_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False, default=list)
    input_payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    output_json: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    metrics_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
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
    aggregate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    celery_task_name: Mapped[str] = mapped_column(String(128), nullable=False)
    queue_name: Mapped[str] = mapped_column(String(64), nullable=False, default="interactive")
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    dispatched: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    dispatched_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("idx_outbox_dispatched_created", "dispatched", "created_at"),
    )


class ReportVersion(Base):
    """
    Immutable versioned report drafts edited in Tiptap.
    """
    __tablename__ = "report_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    case_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("cases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    source_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tiptap_doc_json: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    citations_snapshot_json: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    review_status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")  # draft | reviewed | exported
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    export_storage_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped["Case"] = relationship(back_populates="report_versions")

    __table_args__ = (
        UniqueConstraint("case_id", "version_number", name="uq_report_case_version"),
    )
