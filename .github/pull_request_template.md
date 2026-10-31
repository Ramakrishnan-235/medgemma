## Change Description

<!-- Imperative, short summary (e.g., 'Add longitudinal DICOM comparison worker task') -->

### What changes are being introduced?
- 

### Why is this change needed?
- 

---

## Quality Gate Checklist

Every change must pass these automated quality gates before merge:

- [ ] **Frontend Quality & Verification (`frontend-quality`):**
  - Strict type checking (`npm run type-check`) & lint (`npm run lint`).
  - Cornerstone3D WASM codecs staged & verified.
  - Complete 162-test E2E suite passes (`npm run test:e2e`).
  - Production build succeeds (`npm run build`).
  - Security audit passes (`npm audit --audit-level=critical`).

- [ ] **Backend Unit Tests & Static Analysis (`backend-unit`):**
  - Python bytecode & syntax compilation passes (`compileall`).
  - Ruff code formatting & linter passes (`ruff check`).
  - Mypy static typecheck passes (`mypy`).
  - All 91 unit & defensive security posture tests pass (`pytest tests/`).

- [ ] **Backend Integration & Acceptance (`backend-integration`):**
  - PostgreSQL 16 (pgvector + pgcrypto) & Redis 7 services healthy.
  - Reversible Alembic migrations pass (`upgrade head` -> `downgrade base` -> `upgrade head`).
  - HNSW vector index & tsvector GIN index verified.
  - Full hybrid RRF retrieval & acceptance tests pass (`pytest apps/api/tests/`).

- [ ] **Container & Environment Verification (`container-verification`):**
  - Docker Compose configuration validated against `.env.test`.
  - Web & API Docker production containers build cleanly.

---

## Verification Story

<!-- Describe how this was tested locally and what evidence confirms it works -->
- **Tests run:** 
- **Local verification:** 
- **Rollback plan:** 
