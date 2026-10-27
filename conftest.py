"""Keep tests deterministic even when optional ML packages are installed."""

import pytest


@pytest.fixture(scope="session", autouse=True)
def deterministic_embeddings():
    from app.services import embeddings

    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(embeddings, "SentenceTransformer", None)
        embeddings.get_cpu_embedder.cache_clear()
        yield
        embeddings.get_cpu_embedder.cache_clear()
