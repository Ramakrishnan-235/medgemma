"""initial_medgemma_schema_and_hybrid_rrf_indexes

Revision ID: 0001_initial
Revises:
Create Date: 2026-10-26 12:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import VECTOR

revision: str = "0001_initial"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto;")

    op.create_table(
        "cases",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("patient_code", sa.String(64), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="active"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_cases_workspace_id_id", "cases", ["workspace_id", "id"])

    op.create_table(
        "source_files",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("file_kind", sa.String(32), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False, unique=True),
        sa.Column("sha256_hash", sa.String(64), nullable=False),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("byte_size", sa.Integer(), nullable=False),
        sa.Column("metadata_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("parse_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("parser_version", sa.String(32), nullable=False, server_default="2.0.0-hybrid-ocr"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_source_files_case", "source_files", ["workspace_id", "case_id"])

    op.create_table(
        "evidence_chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("page_or_frame", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("bbox_norm", postgresql.JSONB(), nullable=True),
        sa.Column("section_type", sa.String(64), nullable=False, server_default="body"),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("embedding", VECTOR(384), nullable=False),
        sa.Column("embedding_model", sa.String(64), nullable=False, server_default="intfloat/e5-small-v2"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_evidence_workspace_case", "evidence_chunks", ["workspace_id", "case_id"])
    op.execute(
        """
        CREATE INDEX idx_evidence_embedding_hnsw
        ON evidence_chunks USING hnsw (embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);
        """
    )
    op.execute(
        """
        ALTER TABLE evidence_chunks
        ADD COLUMN content_tsv tsvector
        GENERATED ALWAYS AS (
            setweight(to_tsvector('simple', coalesce(section_type, '')), 'A') ||
            setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
        ) STORED;
        """
    )
    op.execute(
        """
        CREATE INDEX idx_evidence_chunks_tsv_gin
        ON evidence_chunks USING GIN (content_tsv);
        """
    )

    op.create_table(
        "ai_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("task_type", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="queued"),
        sa.Column("model_checkpoint", sa.String(128), nullable=False),
        sa.Column("processor_version", sa.String(64), nullable=False),
        sa.Column("prompt_template_version", sa.String(64), nullable=False),
        sa.Column("input_source_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False, server_default="{}"),
        sa.Column("input_payload_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("output_json", postgresql.JSONB(), nullable=True),
        sa.Column("metrics_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "job_outbox",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("aggregate_type", sa.String(64), nullable=False),
        sa.Column("aggregate_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("celery_task_name", sa.String(128), nullable=False),
        sa.Column("queue_name", sa.String(64), nullable=False, server_default="interactive"),
        sa.Column("payload_json", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("dispatched", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.create_table(
        "report_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("source_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("tiptap_doc_json", postgresql.JSONB(), nullable=False),
        sa.Column("citations_snapshot_json", postgresql.JSONB(), nullable=False, server_default="[]"),
        sa.Column("review_status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("export_storage_key", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("case_id", "version_number", name="uq_report_case_version"),
    )

    op.create_table(
        "image_annotations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("case_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("cases.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_file_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("source_files.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ai_run_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ai_runs.id", ondelete="SET NULL"), nullable=True),
        sa.Column("frame_index", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("origin", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("anatomical_label", sa.String(128), nullable=False),
        sa.Column("finding_text", sa.Text(), nullable=True),
        sa.Column("bbox_norm", postgresql.JSONB(), nullable=False),
        sa.Column("review_state", sa.String(32), nullable=False, server_default="accepted"),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("image_annotations")
    op.drop_table("report_versions")
    op.drop_table("job_outbox")
    op.drop_table("ai_runs")
    op.drop_table("evidence_chunks")
    op.drop_table("source_files")
    op.drop_table("cases")

