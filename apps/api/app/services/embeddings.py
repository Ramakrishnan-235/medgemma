import uuid
from functools import lru_cache
from typing import Any

try:
    from sentence_transformers import SentenceTransformer
except ImportError:
    SentenceTransformer = None  # type: ignore

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import EvidenceChunk

E5_MODEL_NAME = "intfloat/e5-small-v2"


@lru_cache(maxsize=1)
def get_cpu_embedder() -> Any:
    """
    Singleton loaded once per worker process on CPU (~130 MB RAM).
    """
    if SentenceTransformer is not None:
        return SentenceTransformer(E5_MODEL_NAME, device="cpu")

    class MockEmbedder:
        def encode(
            self,
            texts: Any,
            batch_size: int = 32,
            normalize_embeddings: bool = True,
            show_progress_bar: bool = False,
        ) -> Any:
            import hashlib
            import numpy as np

            if isinstance(texts, str):
                texts = [texts]
            results = []
            for t in texts:
                h = hashlib.sha256(t.encode("utf-8")).digest()
                arr = [(float(b) / 255.0) - 0.5 for b in (h * 12)[:384]]
                norm = sum(x * x for x in arr) ** 0.5 or 1.0
                results.append([x / norm for x in arr])
            return np.array(results)

    return MockEmbedder()


def embed_passages_cpu(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """
    Prepends mandatory 'passage: ' prefix and L2-normalizes 384-d vectors.
    """
    if not texts:
        return []
    prefixed = [f"passage: {t.strip()}" for t in texts]
    model = get_cpu_embedder()
    vecs = model.encode(
        prefixed,
        batch_size=batch_size,
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    if hasattr(vecs, "tolist"):
        return vecs.tolist()
    return [list(v) for v in vecs]


def embed_query_cpu(query_text: str) -> list[float]:
    """
    Prepends mandatory 'query: ' prefix and L2-normalizes the 384-d query vector.
    """
    model = get_cpu_embedder()
    vec = model.encode(
        f"query: {query_text.strip()}",
        normalize_embeddings=True,
        show_progress_bar=False,
    )
    if hasattr(vec, "tolist"):
        vec = vec.tolist()
    if isinstance(vec, list) and vec and isinstance(vec[0], list):
        return vec[0]
    return vec


async def retrieve_case_evidence(
    db: AsyncSession,
    workspace_id: uuid.UUID,
    case_id: uuid.UUID,
    query_text: str,
    selected_source_ids: list[uuid.UUID] | None = None,
    top_k: int = 8,
    max_context_chars: int = 10_000,
) -> dict[str, dict[str, Any]]:
    """
    Executes a pgvector cosine-distance query strictly scoped to workspace_id + case_id.
    Returns a bounded dictionary keyed by 'cit_1', 'cit_2', ... for MedGemma grounding.
    """
    query_vec = embed_query_cpu(query_text)

    stmt = (
        select(EvidenceChunk)
        .where(
            EvidenceChunk.workspace_id == workspace_id,
            EvidenceChunk.case_id == case_id,
        )
    )
    if selected_source_ids:
        stmt = stmt.where(EvidenceChunk.source_file_id.in_(selected_source_ids))

    stmt = stmt.order_by(EvidenceChunk.embedding.cosine_distance(query_vec)).limit(top_k)

    chunks = (await db.execute(stmt)).scalars().all()

    allowed_chunks: dict[str, dict[str, Any]] = {}
    accumulated_chars = 0

    for idx, chunk in enumerate(chunks, start=1):
        if accumulated_chars + len(chunk.content_text) > max_context_chars and allowed_chunks:
            break
        cit_key = f"cit_{idx}"
        allowed_chunks[cit_key] = {
            "id": chunk.id,
            "source_file_id": chunk.source_file_id,
            "page_or_frame": chunk.page_or_frame,
            "bbox_norm": chunk.bbox_norm,
            "section_type": chunk.section_type,
            "content_text": chunk.content_text,
        }
        accumulated_chars += len(chunk.content_text)

    return allowed_chunks
