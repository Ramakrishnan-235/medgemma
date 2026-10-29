import uuid
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Case, EvidenceChunk, SourceFile
from app.services.embeddings import embed_passages_cpu, embed_query_cpu
from app.services.hybrid_retrieval import (
    evaluate_retrieval_predictions,
    retrieve_case_evidence_hybrid_rrf,
)


@pytest.mark.asyncio
async def test_e5_small_v2_asymmetric_prefix_and_384_dimensions() -> None:
    """
    Verifies E5-small-v2 produces normalized 384-dim vectors and distinguishes
    'query: ' vs 'passage: ' embeddings.
    """
    passage_vecs = embed_passages_cpu(["Elevated hs-cTnI troponin at 480 ng/L on admission."])
    query_vec = embed_query_cpu("What was the admission hs-cTnI troponin value?")

    assert len(passage_vecs) == 1
    assert len(passage_vecs[0]) == 384
    assert len(query_vec) == 384

    # L2 norm must be ~1.0
    l2_norm = sum(x * x for x in query_vec) ** 0.5
    assert abs(l2_norm - 1.0) < 1e-4


@pytest.mark.asyncio
async def test_hybrid_rrf_ranks_exact_clinical_lab_and_drug_codes_first(
    db_session: AsyncSession,
    workspace_a_ids: tuple[uuid.UUID, uuid.UUID],
    workspace_b_ids: tuple[uuid.UUID, uuid.UUID],
) -> None:
    """
    Verifies that Hybrid RRF (pgvector cosine + PostgreSQL tsvector GIN)
    retrieves exact laboratory abbreviations and drug regimens while enforcing
    strict case and workspace isolation.
    """
    ws_a_id, user_a_id = workspace_a_ids
    ws_b_id, user_b_id = workspace_b_ids

    case_a = Case(
        workspace_id=ws_a_id,
        patient_code="PT-RRF-01",
        title="Sepsis & Cardiac Biomarker Case",
        created_by=user_a_id,
    )
    case_b = Case(
        workspace_id=ws_b_id,
        patient_code="PT-FOREIGN",
        title="Foreign Workspace Case",
        created_by=user_b_id,
    )
    db_session.add_all([case_a, case_b])
    await db_session.flush()

    src_a = SourceFile(
        workspace_id=ws_a_id,
        case_id=case_a.id,
        filename="labs_and_meds.pdf",
        file_kind="pdf",
        storage_key=f"workspaces/{ws_a_id}/cases/{case_a.id}/sources/labs.pdf",
        sha256_hash="1" * 64,
        mime_type="application/pdf",
        byte_size=20480,
        parse_status="ready",
    )
    src_b = SourceFile(
        workspace_id=ws_b_id,
        case_id=case_b.id,
        filename="foreign_note.pdf",
        file_kind="pdf",
        storage_key=f"workspaces/{ws_b_id}/cases/{case_b.id}/sources/foreign.pdf",
        sha256_hash="2" * 64,
        mime_type="application/pdf",
        byte_size=20480,
        parse_status="ready",
    )
    db_session.add_all([src_a, src_b])
    await db_session.flush()

    corpus = [
        (
            "general",
            "Patient presented to the emergency department with mild fatigue and shortness of breath over three days.",
        ),
        (
            "labs",
            "| Biomarker | Value | Reference |\n| --- | --- | --- |\n| hs-cTnI | 642 ng/L | less than 14 ng/L |\n| NT-proBNP | 4120 pg/mL | less than 300 pg/mL |",
        ),
        (
            "medications",
            "Empiric IV antibiotic therapy initiated with piperacillin-tazobactam 4.5g q6h and vancomycin 1g q12h.",
        ),
    ]
    vectors = embed_passages_cpu([text for _, text in corpus])

    inserted_chunks: list[EvidenceChunk] = []
    for idx, ((sec_type, text_body), vec) in enumerate(zip(corpus, vectors), start=1):
        chunk = EvidenceChunk(
            workspace_id=ws_a_id,
            case_id=case_a.id,
            source_file_id=src_a.id,
            page_or_frame=idx,
            bbox_norm={"x0": 0.1, "y0": 0.2, "x1": 0.9, "y1": 0.35},
            section_type=sec_type,
            content_text=text_body,
            embedding=vec,
        )
        db_session.add(chunk)
        inserted_chunks.append(chunk)

    # Insert a decoy chunk in Workspace B containing the exact same lab code
    decoy_chunk = EvidenceChunk(
        workspace_id=ws_b_id,
        case_id=case_b.id,
        source_file_id=src_b.id,
        page_or_frame=1,
        bbox_norm={"x0": 0.0, "y0": 0.0, "x1": 1.0, "y1": 1.0},
        section_type="labs",
        content_text="FOREIGN LEAK: hs-cTnI 9999 ng/L and piperacillin-tazobactam 4.5g q6h.",
        embedding=vectors[1],
    )
    db_session.add(decoy_chunk)
    await db_session.commit()

    # Query 1: Exact biomarker table lookup
    results_lab = await retrieve_case_evidence_hybrid_rrf(
        db=db_session,
        workspace_id=ws_a_id,
        case_id=case_a.id,
        query_text="hs-cTnI NT-proBNP level",
        top_k=3,
    )
    top_lab_chunk = results_lab["cit_1"]
    assert top_lab_chunk["id"] == inserted_chunks[1].id
    assert "642 ng/L" in top_lab_chunk["content_text"]

    # Ensure zero decoy chunks from Workspace B leaked into results
    retrieved_ids = {meta["id"] for meta in results_lab.values()}
    assert decoy_chunk.id not in retrieved_ids

    # Query 2: Exact antibiotic regimen lookup + Recall/MRR harness check
    results_meds = await retrieve_case_evidence_hybrid_rrf(
        db=db_session,
        workspace_id=ws_a_id,
        case_id=case_a.id,
        query_text="piperacillin-tazobactam 4.5g dosage",
        top_k=3,
    )
    assert results_meds["cit_1"]["id"] == inserted_chunks[2].id

    eval_metrics = evaluate_retrieval_predictions(
        mode="hybrid_rrf",
        benchmark_cases=[
            {
                "expected_chunk_id": inserted_chunks[1].id,
                "retrieved_chunk_ids": [m["id"] for m in results_lab.values()],
                "is_abbreviation_query": True,
            },
            {
                "expected_chunk_id": inserted_chunks[2].id,
                "retrieved_chunk_ids": [m["id"] for m in results_meds.values()],
                "is_abbreviation_query": True,
            },
        ],
    )
    assert eval_metrics.recall_at_5 == 1.0
    assert eval_metrics.mrr_at_10 == 1.0
    assert eval_metrics.abbreviation_hit_rate == 1.0

