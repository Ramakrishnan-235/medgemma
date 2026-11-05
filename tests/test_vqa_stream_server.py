import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.vqa_stream_server import (
    MedGemmaVQASessionManager,
    MedGemmaVQAServicer,
)


@pytest.mark.asyncio
async def test_vqa_session_manager_lifecycle():
    manager = MedGemmaVQASessionManager()
    study_id = "STUDY-TEST-001"
    dummy_b64 = ["b64_slice_1", "b64_slice_2"]

    # 1. Register study prefix
    manager.register_study_prefix(study_id, dummy_b64)
    assert manager.has_study(study_id)

    # 2. Stream first turn
    tokens_turn_1 = []
    async for chunk in manager.stream_question(study_id, "Is there a nodule in the right lower lobe?", mock_mode=True):
        assert "token" in chunk
        assert "is_final" in chunk
        if chunk["token"]:
            tokens_turn_1.append(chunk["token"])

    turn_1_text = "".join(tokens_turn_1)
    assert len(turn_1_text) > 0
    assert "nodule" in turn_1_text.lower() or "right lower lobe" in turn_1_text.lower()

    # Verify session has recorded prefix turn + user question + assistant answer
    session = manager.get_session(study_id)
    assert len(session["messages"]) == 4
    assert session["messages"][2]["role"] == "user"
    assert session["messages"][3]["role"] == "assistant"
    assert session["messages"][3]["content"] == turn_1_text

    # 3. Stream follow-up turn (multi-turn conversation test)
    tokens_turn_2 = []
    async for chunk in manager.stream_question(study_id, "What is the recommended follow-up?", mock_mode=True):
        if chunk["token"]:
            tokens_turn_2.append(chunk["token"])

    turn_2_text = "".join(tokens_turn_2)
    assert len(turn_2_text) > 0
    assert len(session["messages"]) == 6  # prefix turn (user, assistant) + 2 Q&A turns (user, assistant, user, assistant)

    # 4. Clear session
    manager.clear_session(study_id)
    assert not manager.has_study(study_id)


@pytest.mark.asyncio
async def test_grpc_servicer_mock():
    cache = {}
    servicer = MedGemmaVQAServicer(study_cache=cache)
    study_id = "STUDY-GRPC-100"
    servicer.session_manager.register_study_prefix(study_id, ["b64_sample"])

    class MockRequest:
        def __init__(self, s_id, q):
            self.study_id = s_id
            self.question = q

    class MockContext:
        pass

    req = MockRequest(study_id, "Assess mediastinal lymph nodes.")
    chunks = []
    async for item in servicer.StreamVQA(req, MockContext(), mock_mode=True):
        chunks.append(item)

    assert len(chunks) > 0
    assert any(c["is_final"] for c in chunks)
