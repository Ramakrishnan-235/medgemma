# MedGemma refactoring and validation

Date: 2026-10-27

The working tree was clean before implementation. Baseline checks ran before code edits. The refactor covers the API, shared inference boundary, worker execution, configuration, frontend state/navigation, CLI validation, and CI. Existing public routes and Celery task names are preserved. No model weights, secrets, or database migrations were changed.

## Baseline and final checks

| Check | Before refactoring | After refactoring |
| --- | --- | --- |
| Complete Python suite (`tests` and `apps/api/tests`) | 74 passed; 4 warnings | 101 passed, 7 subtests passed; no warnings |
| Frontend TypeScript | Passed | Passed |
| Next.js production build | Passed outside sandbox | Passed outside sandbox |
| Local production page | Not checked | HTTP 200 on port 3100 |
| CUDA computation | Passed on RTX 2050 before CLI changes | Passed after refactoring |
| Compose configuration | Passed | Passed |
| Python compilation | Existing suite imported project modules | Passed for CLI, API, GPU service, and tests |

The sandbox initially blocked Next.js worker spawning with `spawn EPERM`; the approved build outside the sandbox succeeded. This was an environment restriction, not a source-code failure.

## Changes

- `services/run_queue.py` centralizes creation of an AI run and its transactional outbox record. QA, EHR, single X-ray, and longitudinal routes retain their request/response contracts.
- `workers/run_lifecycle.py` centralizes atomic worker transitions. Only queued jobs are claimed; duplicate deliveries do not rerun active or terminal jobs. Conditional updates prevent late results or errors from overwriting cancellation or watchdog recovery. A failed database flush is rolled back before failure is recorded.
- `services/generation.py` shares HTTP client ownership, response-envelope validation, JSON/code-fence parsing, and telemetry across QA, EHR, and imaging. Injected clients remain caller-owned. Unexpected JSON arrays/scalars use workflow fallbacks. Citation resolution ignores malformed keys and deduplicates valid citations. EHR synthesis falls back to verified facts if any required citation is missing.
- SSE retrieves authoritative, workspace-scoped database snapshots even when Redis subscription fails. It reconciles terminal state against the database and closes Redis resources. Cancellation remains successful after its database commit if Redis or broker revocation fails. Recovery publishes notifications after committing state.
- Blocking imaging storage/preprocessing and report export uploads run in worker threads. Current pydicom imports and the vector fallback's cache declaration remove baseline warnings.
- Configuration has one Pydantic schema instead of two optional-dependency-dependent implementations. Environment values override `.env`; CORS accepts CSV or JSON. Nonpositive concurrency is rejected; malformed integer strings retain the existing default behavior.
- Frontend page IDs derive from the page catalog, with an exhaustive screen registry and validated URL hashes. Navigation listens for both hash and browser-history changes. Components select the Zustand fields they consume. Case creation uses the highest existing numeric ID and updates URL history. Modal forms remount when closed/reopened. Health errors propagate instead of returning a fabricated connected state.
- The CLI validates token bounds during argument parsing, before importing CUDA/model dependencies.
- CI invokes both test directories through pytest. It no longer tries to install the Python 3.14 CLI package into its Python 3.12 API job. Tests force deterministic embeddings even when optional ML packages are installed. Compose CI creates its required `.env` from the test fixture.

## Intentional behavior correction: GPU HTTP service

The original HTTP service returned a hardcoded finding and invented token/timing counters while reporting `local_4bit`; it never loaded the local model. It now serves fixtures only under `mock_deterministic`, reports that mode explicitly, and returns HTTP 503 for unimplemented real inference. Mock counters are zero. Requests receive explicit JSON/body validation. Its Dockerfile now installs Pillow, which the existing normalization function requires.

The CLI's real offline inference path remains separate. Connecting it to the HTTP service requires additional implementation and runtime validation.

## Regression coverage and limits

New tests exercise all four run-creation routes and dispatch contracts, duplicate delivery, terminal states, workspace isolation, cancellation during generation, database flush failure, Redis outage behavior, malformed model JSON, citation deduplication, settings parsing, CLI bounds, and the GPU handler over a real loopback HTTP socket.

The acceptance suite uses SQLite adapters for PostgreSQL-specific types and operators, deterministic embeddings, and mocked inference. Passing it does not verify PostgreSQL/pgvector query behavior, real OCR/model accuracy, full GPU generation, live object storage, or deployed worker/broker behavior.

Docker Desktop's Linux engine was unavailable. Container builds and the complete Compose stack were not run. Compose configuration parsing passed. Interactive browser verification was blocked when the UI helper could not attach to the minimized Chrome window; frontend verification covers TypeScript, production compilation/prerendering, server startup, and HTTP 200 only. The temporary production server was stopped after validation.

## Reproduction

From the repository root:

```powershell
.\.venv\Scripts\python.exe -m pytest tests apps/api/tests -q -p no:cacheprovider
.\.venv\Scripts\python.exe -m compileall -q src apps/api/app apps/gpu-service tests
.\.venv\Scripts\python.exe -m medgemma_app --check
docker compose --env-file .env.test config --quiet
```

From `apps/web`:

```powershell
npm run type-check
npm run build
```
