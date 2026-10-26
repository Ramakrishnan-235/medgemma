import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.embeddings import embed_query_cpu


@dataclass(frozen=True)
class RetrievalEvalMetrics:
    mode: str  # 'dense_e5_only' | 'hybrid_rrf'
    recall_at_5: float
    mrr_at_10: float
    abbreviation_hit_rate: float


async def retrieve_case_evidence_hybrid_rrf(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    case_id: uuid.UUID,
    query_text: str,
    selected_source_ids: list[uuid.UUID] | None = None,
    top_k: int = 8,
    rrf_k: int = 60,
    dense_weight: float = 0.65,
    lexical_weight: float = 0.35,
    max_context_chars: int = 10_000,
) -> dict[str, dict[str, Any]]:
    """
    Executes single-query CTE Reciprocal Rank Fusion (RRF) inside PostgreSQL,
    combining E5-small-v2 cosine similarity and ts_rank_cd lexical matching
    strictly scoped to workspace_id + case_id.
    """
    query_vec = embed_query_cpu(query_text)
    vec_literal = "[" + ",".join(f"{v:.6f}" for v in query_vec) + "]"

    source_filter_sql = (
        "AND source_file_id = ANY(:selected_source_ids)"
        if selected_source_ids
        else ""
    )

    sql = text(
        f"""
        WITH scoped_chunks AS (
            SELECT
                id,
                source_file_id,
                page_or_frame,
                bbox_norm,
                section_type,
                content_text,
                embedding <=> CAST(:query_vec AS vector(384)) AS cosine_dist,
                ts_rank_cd(content_tsv, websearch_to_tsquery('english', :query_text)) AS lex_score
            FROM evidence_chunks
            WHERE workspace_id = :workspace_id
              AND case_id = :case_id
              {source_filter_sql}
        ),
        dense_ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY cosine_dist ASC) AS d_rank
            FROM scoped_chunks
            ORDER BY cosine_dist ASC
            LIMIT 40
        ),
        lexical_ranked AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY lex_score DESC) AS l_rank
            FROM scoped_chunks
            WHERE lex_score > 0
            ORDER BY lex_score DESC
            LIMIT 40
        ),
        rrf_fused AS (
            SELECT
                sc.id,
                sc.source_file_id,
                sc.page_or_frame,
                sc.bbox_norm,
                sc.section_type,
                sc.content_text,
                (
                    COALESCE(:dense_w / (:rrf_k + dr.d_rank), 0.0) +
                    COALESCE(:lex_w / (:rrf_k + lr.l_rank), 0.0)
                ) AS rrf_score
            FROM scoped_chunks sc
            LEFT JOIN dense_ranked dr ON sc.id = dr.id
            LEFT JOIN lexical_ranked lr ON sc.id = lr.id
            WHERE dr.id IS NOT NULL OR lr.id IS NOT NULL
        )
        SELECT
            id,
            source_file_id,
            page_or_frame,
            bbox_norm,
            section_type,
            content_text,
            rrf_score
        FROM rrf_fused
        ORDER BY rrf_score DESC
        LIMIT :top_k;
        """
    )

    params: dict[str, Any] = {
        "workspace_id": workspace_id,
        "case_id": case_id,
        "query_vec": vec_literal,
        "query_text": query_text,
        "dense_w": dense_weight,
        "lex_w": lexical_weight,
        "rrf_k": float(rrf_k),
        "top_k": top_k,
    }
    if selected_source_ids:
        params["selected_source_ids"] = selected_source_ids

    rows = (await db.execute(sql, params)).mappings().all()

    allowed_chunks: dict[str, dict[str, Any]] = {}
    accumulated_chars = 0

    for idx, row in enumerate(rows, start=1):
        text_body = str(row["content_text"])
        if accumulated_chars + len(text_body) > max_context_chars and allowed_chunks:
            break
        cit_key = f"cit_{idx}"
        allowed_chunks[cit_key] = {
            "id": row["id"],
            "source_file_id": row["source_file_id"],
            "page_or_frame": row["page_or_frame"],
            "bbox_norm": row["bbox_norm"],
            "section_type": row["section_type"],
            "content_text": text_body,
            "rrf_score": round(float(row["rrf_score"]), 6),
        }
        accumulated_chars += len(text_body)

    return allowed_chunks


def evaluate_retrieval_predictions(
    mode: str,
    benchmark_cases: list[dict[str, Any]],
) -> RetrievalEvalMetrics:
    """
    Computes Recall@5, MRR@10, and clinical abbreviation hit rate on a golden
    retrieval dataset before promoting a retrieval configuration to release.
    Each item in benchmark_cases has:
      - 'expected_chunk_id': UUID
      - 'retrieved_chunk_ids': list[UUID]
      - 'is_abbreviation_query': bool
    """
    if not benchmark_cases:
        return RetrievalEvalMetrics(mode=mode, recall_at_5=0.0, mrr_at_10=0.0, abbreviation_hit_rate=0.0)

    hits_at_5 = 0
    reciprocal_ranks: list[float] = []
    abbrev_total = 0
    abbrev_hits = 0

    for item in benchmark_cases:
        expected = item["expected_chunk_id"]
        preds = item["retrieved_chunk_ids"][:10]

        if expected in preds[:5]:
            hits_at_5 += 1
            if item.get("is_abbreviation_query"):
                abbrev_hits += 1

        if item.get("is_abbreviation_query"):
            abbrev_total += 1

        if expected in preds:
            rank = preds.index(expected) + 1
            reciprocal_ranks.append(1.0 / rank)
        else:
            reciprocal_ranks.append(0.0)

    n = len(benchmark_cases)
    return RetrievalEvalMetrics(
        mode=mode,
        recall_at_5=round(hits_at_5 / n, 4),
        mrr_at_10=round(sum(reciprocal_ranks) / n, 4),
        abbreviation_hit_rate=round(abbrev_hits / max(abbrev_total, 1), 4),
    )
