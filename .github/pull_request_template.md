## Change Description

<!-- Imperative, short summary (e.g., 'Add longitudinal DICOM comparison worker task') -->

### What changes are being introduced?
- 

### Why is this change needed?
- 

---

## Quality Gate Checklist

Every change must pass these automated quality gates before merge:

- [ ] **Type Check:** `npm run type-check` passes with zero errors (frontend).
- [ ] **Lint / Syntax:** Python syntax compilation (`python -m compileall`) passes without errors.
- [ ] **Automated Tests:** `python -m unittest discover -s tests` passes (all regression and unit tests green).
- [ ] **Build:** Production builds succeed (`npm run build` in `apps/web`).
- [ ] **Security & Multi-Tenant:** All queries enforce `workspace_id` compound boundaries; no secret leakage.
- [ ] **Docker Containers:** Dockerfiles build cleanly; compose config passes validation.

---

## Verification Story

<!-- Describe how this was tested locally and what evidence confirms it works -->
- **Tests run:** 
- **Local verification:** 
- **Rollback plan:** 
