# Project: MedGemma Clinical Intelligence Workspace UI Overhaul

## Architecture
- **Framework**: Next.js 16.4.3 (App Router with Webpack mode for WASM support), React 19.3.1.
- **Styling**: Tailwind CSS 4.3.3 (`@tailwindcss/postcss`), `@theme inline` in `src/app/globals.css`, unified with `src/app/medgemma-design.css`.
- **Monochrome Design System Tokens**:
  - Canvas / Base Background: `#09090b` (zinc-950)
  - Card & Surface: `#18181b` (zinc-900)
  - 1px Border Contrast: `#27272a` (zinc-800)
  - Primary Action / High Contrast: `#ffffff` (text: `#09090b`)
  - Secondary Action / Hover Surface: `#27272a` (hover: `#3f3f46`)
  - Primary Text: `#f4f4f5` (zinc-100)
  - Muted Text / Labels: `#a1a1aa` (zinc-400)
  - Subtle / Footnotes / Eyebrows: `#71717a` (zinc-500)
- **State Architecture**: Zustand 5.0 (`useWorkspaceStore`, `useImagingStore`), URL hash synchronizer (`useWorkspaceNavigation`).
- **Medical Imaging Engine**: `@cornerstonejs/core`, `@cornerstonejs/tools` (WASM/WebGL stack viewports, SVG overlays, tool synchronizers).
- **Rich Document & Report Editor**: TipTap 3.32 with custom citation chip extension.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Monochrome Token Architecture | `#09090b` base, `#18181b` card, `#27272a` border CSS variables across globals.css and medgemma-design.css | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Component Primitives Dark Alignment | Shadcn UI (`src/components/ui/`) and CommonUI badges, buttons, inputs, tabs, separators | M1 | ORIGINAL_REQUEST §R3 |
| 3 | Package Scripts Enhancement | Add `lint` script to `apps/web/package.json` for ESLint verification | M1 | ORIGINAL_REQUEST §Acceptance |
| 4 | Global Application Shell | Top review bar, 224px sidebar grid, responsive layouts, brand header with monochrome `+` badge | M2 | ORIGINAL_REQUEST §R2 |
| 5 | Top Navigation Bar | Breadcrumbs, active case picker dropdown, search trigger, user avatar | M2 | ORIGINAL_REQUEST §R2 |
| 6 | Sidebar Hierarchical Navigation | 15 screens navigation links, count pills, nested subnavigation under Assistant, Imaging, and Clinical text | M2 | Prototype Spec Miner |
| 7 | Global Modals & Toast System | New Case modal, Source viewer modal, File upload dialog, auto-dismissing toast notifications | M2 | Prototype Spec Miner |
| 8 | Overview Dashboard Screen | 3 metric KPI cards, quick actions, recent cases table, recent activity audit log | M3 | ORIGINAL_REQUEST §R2 |
| 9 | Cases List Screen | Case status filter tabs ('All cases', 'Needs review', 'Draft ready', etc.), search input, case creation trigger | M3 | ORIGINAL_REQUEST §R2 |
| 10 | Case Detail Screen | Case context header, files & studies table, drafts review timeline, modal upload trigger | M3 | ORIGINAL_REQUEST §R2 |
| 11 | Clinical Reasoning Screen | Clinical encounter note paper view, MedGemma reasoning synthesis stream, evidence interpretation cards | M3 | ORIGINAL_REQUEST §R2 |
| 12 | EHR Summary Screen | Narrative overview card, 2x2 clinical grid (problems, medications, allergies, encounters), source coverage checklist | M3 | ORIGINAL_REQUEST §R2 |
| 13 | Document Extraction Screen | Lab report document display with interactive mark highlighting, extracted field table with crosshair locators | M3 | ORIGINAL_REQUEST §R2 |
| 14 | Medical Q&A Screen | Scope selector ('Attached case sources only' vs 'General knowledge'), SSE streaming answer card with citations | M3 | ORIGINAL_REQUEST §R2 |
| 15 | Assistant Chat Screen | Conversational assistant, recent history sidebar, suggestion pills, streaming response cards with tokens/sec | M3 | ORIGINAL_REQUEST §R2 |
| 16 | Library Screen | Asset catalog with tabs ('All files', 'Imaging', 'Documents', etc.), search filter, deep links | M3 | ORIGINAL_REQUEST §R2 |
| 17 | Settings Screen | Settings subnavigation, profile, appearance, data preferences, and model connection health check | M3 | ORIGINAL_REQUEST §R2 |
| 18 | Landing & Sign-in Screens | Marketing presentation hero and auth screen styled with dark monochrome aesthetic | M3 | Prototype Spec Miner |
| 19 | Medical Imaging Workspace | Mode tabs ('Analysis', '3D', 'Localization'), series switcher, Cornerstone3D vs schematic toggle, ROI annotation tool | M4 | ORIGINAL_REQUEST §R2 |
| 20 | Cornerstone3D Viewport Styling & Resizing | Monochrome container styling (`#09090b`), canvas resize handling, DICOM loading HUD, SVG annotation overlay | M4 | ORIGINAL_REQUEST §R2, §R3 |
| 21 | Longitudinal Comparison Workspace | 95-day interval timeline, synchronized dual Cornerstone3D viewports, AI interval change SSE stream, findings panel | M4 | ORIGINAL_REQUEST §R2 |
| 22 | Report Studio & TipTap Integration | Dual-mode editor (structured sections vs TipTap document), citation chip extension, version history, export actions | M4 | ORIGINAL_REQUEST §R2 |
| 23 | E2E Test Suite Pass (Tiers 1-4) | Pass 100% of requirement-driven test cases produced by E2E Testing Track | M5 | Project Pattern §Dual Track |
| 24 | Adversarial Coverage Hardening (Tier 5) | White-box edge-case and robustness hardening with Challenger verifier | M5 | Project Pattern §Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Design System & Token Infrastructure | Token definitions in `globals.css` and `medgemma-design.css`, `.dark` mode enforcement in `layout.tsx`, Shadcn and CommonUI primitives, `package.json` lint script | none | DONE |
| M2 | Global Shell & Common Components | Sidebar navigation, topbar with breadcrumbs & case selector, reviewbar, modals, toast system, responsive shell | M1 | DONE |
| M3 | Workspace Screens: Clinical Management & Reasoning | Overview, Cases, Case Detail, Clinical Reasoning, EHR Summary, Document Extraction, Medical Q&A, Chat, Library, Settings, Landing, Sign-in | M1, M2 | DONE |
| M4 | Medical Imaging & Longitudinal Workspace | ImagingScreen, CompareScreen, ReportScreen, Cornerstone3D viewports (`ChestXrayViewport`, `LongitudinalXrayWorkspace`), TipTap editor | M1, M2 | DONE |
| M5 | Final Integration & E2E Validation | Full build & lint pass, 100% pass of E2E Test Suite (Tiers 1-4), Tier 5 Adversarial Coverage Hardening | M3, M4, TEST_READY.md | IN_PROGRESS |

## Interface Contracts
### Shell ↔ Screen Contract
- Screen components receive `{}` or use `useWorkspaceStore` via Zustand.
- Active case context accessed via `useWorkspaceStore.getState().activeCaseId` and `useWorkspaceStore.getState().activeCase`.
- Toast notifications dispatched via `useWorkspaceStore.getState().showToast(message)`.
- Global modals opened via `useWorkspaceStore.getState().openModal(type, payload)`.

### Viewport ↔ Imaging Store Contract
- `useImagingStore.getState().activeTool`: `"WindowLevel" | "Pan" | "Zoom" | "DrawBox"`.
- `useImagingStore.getState().syncPriorCurrent`: boolean flag synchronizing prior/current window levels.
- `useImagingStore.getState().focusCitationOnViewer(sourceId, bboxNorm)`: highlights bounding box in active Cornerstone3D viewport.

### Styling & Theme Contract
- Background canvas: `bg-[#09090b]` / `bg-zinc-950`
- Surface / Cards: `bg-[#18181b]` / `bg-zinc-900`
- Border: `border-[#27272a]` / `border-zinc-800`
- Text: `text-[#f4f4f5]` / `text-zinc-100` (primary), `text-[#a1a1aa]` / `text-zinc-400` (muted)

## Code Layout
- `apps/web/src/app/globals.css`: Tailwind v4 `@theme inline` and global CSS tokens.
- `apps/web/src/app/medgemma-design.css`: CSS classes for application shell, panels, tables, buttons, badges, modals, toasts.
- `apps/web/src/app/layout.tsx`: Root HTML layout with `dark` class, fonts, and meta tags.
- `apps/web/src/app/page.tsx`: Shell container, sidebar, topbar, toast region, modal root, screen switcher.
- `apps/web/src/components/ui/`: Shadcn UI primitives (`badge.tsx`, `button.tsx`, `card.tsx`, `input.tsx`, `separator.tsx`, `tabs.tsx`).
- `apps/web/src/components/medgemma/CommonUI.tsx`: Shared UI badges, headings, context bars, source chips.
- `apps/web/src/components/medgemma/screens/`: 15 modular workspace screen components.
- `apps/web/src/components/viewer/`: Cornerstone3D viewports (`ChestXrayViewport.tsx`, `LongitudinalXrayWorkspace.tsx`).
- `apps/web/src/components/editor/`: TipTap rich text editor (`ClinicalReportEditor.tsx`, `CitationChipExtension.ts`).
- `apps/web/src/stores/`: Zustand state stores (`useWorkspaceStore.ts`, `useImagingStore.ts`).

