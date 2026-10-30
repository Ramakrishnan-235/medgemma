# MedGemma Workspace — Test Infrastructure Specification (TEST_INFRA)

## 1. Executive Summary

The MedGemma test infrastructure provides an automated, requirement-driven, opaque-box verification framework for the **MedGemma Clinical Intelligence Workspace** (`apps/web`). It guarantees clinical safety, UI fidelity, cross-modal state propagation, and adherence to strict monochrome design tokens (`#09090b`, `#18181b`, `#27272a`).

The suite contains **162 automated end-to-end tests** divided into 4 comprehensive tiers, executing via Node.js native test runner and React 19 SSR runtime without requiring external browser binaries.

---

## 2. Test Architecture & Runtime Harness

### 2.1 Shared Test Harness (`apps/web/test/test-harness.mjs`)
The shared harness exposes a headless, deterministic testing environment for Next.js App Router and React 19 components:
- **Module Compilation (`jiti`)**: Real-time TypeScript and TSX compilation with Next.js `@/*` alias resolution pointing directly to `apps/web/src`.
- **Live Store Hydration**: Overrides React 19's `useSyncExternalStore` during SSR (`React.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();`) so Zustand state mutations update component trees synchronously during tests.
- **Store Accessors**: Provides unified singleton store accessors (`getWorkspaceStore()`, `getImagingStore()`) preventing module dual-identity isolation.
- **Design Token Inspector**: Static and runtime CSS parser verifying monochrome color codes (`#09090b`, `#18181b`, `#27272a`, `#000000`) and dark theme declarations in `globals.css` and `medgemma-design.css`.
- **SSR DOM Assertions**: Exposes query helpers:
  - `hasText(text)`: Substring assertion.
  - `hasClass(cls)`: Regular expression class matcher.
  - `hasTag(tag)`: HTML tag presence matcher.
  - `matches(regex)`: Arbitrary regular expression matcher with HTML entity tolerance (`&amp;` / `&`).
  - `extractText()`: Text extraction stripping markup and normalizing whitespace.

---

## 3. Four-Tier Testing Hierarchy & Coverage

### Tier 1: Feature Coverage (`apps/web/test/tier1-features.test.mjs`)
*Requirement: >= 5 test cases per core feature across all 15 screens, tokens, layout, routing, and Zustand bindings.*
- **Tests**: 98 tests
- **Pass Rate**: 100% (98 / 98)
- **Features Covered**:
  1. **Monochrome Token Architecture & Theme**: Canvas zinc-950 (`#09090b`), surface zinc-900 (`#18181b`), border zinc-800 (`#27272a`), viewer pure black (`#000000`), dark class.
  2. **Global Shell Layout**: ReviewBar (15 screens selector), Sidebar (+ mark brand, nav pills), Topbar (breadcrumbs, case picker), live Toast alerts.
  3. **Routing & Navigation**: Screen validation across all 15 routes, invalid route rejection, default route (`overview`), Zustand route dispatch.
  4. **Zustand State Store Bindings**: Default case initialization, `addCase`, immutable `updateExtractedField`, modal dialog toggles, `focusCitationOnViewer`.
  5. **15 Clinical Screens**:
     - Screen 1: Overview Dashboard (`overview`) — greeting, 3 KPI cards, 3 quick action links, recent cases, audit log.
     - Screen 2: Cases Management (`cases`) — case table, filters (Needs review, Draft ready, Reviewed), search input.
     - Screen 3: Case Detail (`case`) — case triage header, context banner, source files list, outputs, chronological timeline.
     - Screen 4: Medical Imaging Workspace (`imaging`) — CT chest context, series selector (01 Axial, 02 Coronal, 03 Sagittal), mode tabs, observations panel, manual ROI annotations.
     - Screen 5: Longitudinal Comparison (`compare`) — 95-day interval comparison, Current vs Prior viewports, synchronized W/L controls, interval findings.
     - Screen 6: Clinical Text / EHR (`ehr`) — Overview, Timeline, Sources tabs; case overview narrative, structured EHR grid.
     - Screen 7: Multimodal Assistant Chat (`chat`) — query composer, source grounding badges, citation pills, suggestion prompts.
     - Screen 8: Document Extraction & Labs (`lab`) — multi-column document viewer, interactive `<mark>` tags, lab table with `p. 1 ↗` locator links.
     - Screen 9: Report Studio (`report`) — structured findings section, version history (v1 draft), safety checklist toggles, export action.
     - Screen 10: Clinical Reasoning (`reasoning`) — hypothesis builder, differential diagnosis cards, uncertainty badges, evidence links.
     - Screen 11: File & Study Library (`library`) — file format filters (DICOM, PDF, JPG), study grid, upload action.
     - Screen 12: Audit Log & Provenance (`audit`) — tamper-evident chronological event log, model attribution badges (`medgemma-1.5-pro`), export action.
     - Screen 13: Clinical Workspace Settings (`settings`) — AI inference parameters (temperature, model version), DICOM viewer defaults, display preferences.
     - Screen 14: Marketing Landing (`landing`) — display typography, 3 capability columns, 3-step workflow, FAQ accordion.
     - Screen 15: Sign-in Screen (`signin`) — 50/50 split authentication layout, credentials inputs, "Explore demo" bypass.

### Tier 2: Boundary & Corner Cases (`apps/web/test/tier2-boundary-corner.test.mjs`)
*Requirement: Extreme values, missing data, invalid inputs, clamping, projection mismatch, and responsive breakpoints.*
- **Tests**: 25 tests
- **Pass Rate**: 100% (25 / 25)
- **Edge Conditions Covered**:
  1. **Empty Data States**: Null case ID fallback, empty cases list fallback, empty source file list fallback, empty chat history prompt, unselected extraction field locator preservation.
  2. **Boundary Values & Sanitization**: HTML/XSS injection escaping (`<script>alert(1)</script>`), multi-kilobyte case names, unicode clinical characters (`µg/dL`, `±`, `α-fetoprotein`), zero/negative window widths, out-of-bounds slice index clamping (`-5 -> 0`, `999 -> 240`).
  3. **DICOM & Projection Mismatch**: PA vs AP projection warning banner, missing transfer syntax fallback, corrupted study metadata gracefully rendered, zero-dimension image container fallbacks, invalid series ID fallback to primary series.
  4. **Cornerstone Container Resizing & Bounds**: Dynamic aspect ratio preservation (`1:1`, `4:3`, `16:9`), zero-area ROI box rejection, out-of-bounds bbox normalization clamping (`[-0.2, 1.4] -> [0, 1]`), rapid viewport zoom clamping (`0.1x` to `10.0x`), multi-viewport layout distribution (`1x1`, `1x2`, `2x2`).
  5. **Responsive Breakpoints & Dismissal**: Tablet collapse (`<1024px`), mobile vertical single-column stack (`<600px`), ultra-compact header hiding avatar (`<380px`), ultra-wide desktop container padding (`>=1600px`), modal state dismiss on escape/backdrop click.

### Tier 3: Cross-Feature Interactions (`apps/web/test/tier3-cross-feature.test.mjs`)
*Requirement: Multi-store state propagation, citation grounding, report synchronization, mark highlighting.*
- **Tests**: 25 tests
- **Pass Rate**: 100% (25 / 25)
- **Interaction Scenarios Covered**:
  1. **Case Selection Propagation**: Switching case in Topbar synchronously updates global store `activeCase` and `activeCaseId`, Case Detail header, Medical Imaging banner, Chat input placeholder, and Report Studio draft context.
  2. **Citation Grounding & Viewport Focus**: Clicking citation chip dispatches `focusCitationOnViewer` with normalized bounding box; `ChestXrayViewport` receives focus coordinates; focus clears when source ID differs; Evidence Provenance modal opens; TipTap editor retains document state on citation click.
  3. **Report Studio & Document Sync**: Saving report draft increments version history; switching TipTap document to structured section mode preserves edits; approving report updates case status to `Reviewed`; Reviewed status filters immediately in Cases screen; export triggers toast confirmation.
  4. **Document Extraction & Interactive Mark Highlighting**: Clicking lab field row sets `extractionField`; matching `<mark>` tag receives active highlight styling; switching to date field shifts highlight; inline value editing updates store while preserving locator link; verified fields export contains provenance metadata.
  5. **Modal Workflows & Global State Integration**: Submitting New Case modal prepends case and resets filters; sequential toasts replace active toast and reset dismiss timer; changing `imagingMode` switches viewport configuration; W/L synchronizer flag updates shared window range; upload modal records new file in library.

### Tier 4: Real-World Clinical Workflows (`apps/web/test/tier4-clinical-workflows.test.mjs`)
*Requirement: Full doctor clinical journeys and complex acute pathways.*
- **Tests**: 14 tests
- **Pass Rate**: 100% (14 / 14)
- **Workflows Covered**:
  1. **Primary Workflow: End-to-End Radiologist Case Journey (9 Phases)**:
     - Phase 1: Clinician Login & Workspace Access (KPI review, queue intake)
     - Phase 2: Case Selection & Triage (Case 024 Chest review triage)
     - Phase 3: Multiplanar Diagnostic Imaging Review (Axial series inspection, slice depth 145/240)
     - Phase 4: Longitudinal Temporal Comparison (95-day interval comparison, opacity reduction check)
     - Phase 5: Multimodal Assistant Clinical Q&A (Grounded clinical questioning regarding pulmonary changes)
     - Phase 6: Document & Lab Extraction (Hemoglobin and WBC extraction with interactive locators)
     - Phase 7: Clinical Reasoning & EHR Reconciliation (Problem list check, explicit absence of allergies note)
     - Phase 8: Report Drafting, Safety Verification & Export (Checklist verification, PDF/text export)
     - Phase 9: Workflow Completion & Audit State (Case marked `Reviewed`, audit event recorded)
  2. **Complex Clinical Pathways**:
     - T4.10: Emergency Trauma Case Workflow (Rapid intake, multi-series navigation, immediate impression)
     - T4.11: Multi-Document Reconciliation Workflow (Ingesting encounter note and lab report, cross-referencing contradictions)
     - T4.12: Second Opinion & Peer Review Workflow (Clinician inspects v1 prior report, records signed v2 revision)
     - T4.13: Patient Discharge Summary Assembly Workflow (Aggregating verified lab data, imaging findings, and clinical summary)
     - T4.14: Quality Assurance & Uncertainty Governance Workflow (Verifying AI grounding, uncertainty badges, and provenance visibility)

---

## 4. Execution Commands

### 4.1 Running All Tiers from Root
```powershell
node test-runner.mjs
```

### 4.2 Running via Web Package NPM Scripts
```powershell
cd apps/web
npm run test:e2e
```

### 4.3 Running Individual Tiers
```powershell
# Tier 1 only
node test-runner.mjs --tier=1

# Tier 2 only
node test-runner.mjs --tier=2

# Tier 3 only
node test-runner.mjs --tier=3

# Tier 4 only
node test-runner.mjs --tier=4
```

### 4.4 Running Direct Node Tests
```powershell
node --test apps/web/test/tier1-features.test.mjs
node --test apps/web/test/tier2-boundary-corner.test.mjs
node --test apps/web/test/tier3-cross-feature.test.mjs
node --test apps/web/test/tier4-clinical-workflows.test.mjs
```

---

## 5. Summary Metrics

| Tier | Focus Area | Total Tests | Passed | Failed | Duration |
|---|---|---|---|---|---|
| **Tier 1** | Feature Coverage (15 screens, tokens, layout, routing, Zustand) | 98 | 98 | 0 | ~10.9s |
| **Tier 2** | Boundary & Corner Cases (empty data, clamping, mismatches, responsive) | 25 | 25 | 0 | ~0.6s |
| **Tier 3** | Cross-Feature Interactions (case propagation, citations, sync, marks) | 25 | 25 | 0 | ~10.6s |
| **Tier 4** | Real-World Clinical Workflows (9-phase doctor journey + 5 complex pathways) | 14 | 14 | 0 | ~10.1s |
| **Total** | **Full End-to-End Suite** | **162** | **162** | **0** | **~32.3s** |
