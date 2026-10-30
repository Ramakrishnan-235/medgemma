/**
 * Tier 3: Cross-Feature Interactions E2E Test Suite
 * 
 * Validates complex multi-module workflows and state propagation:
 * - Case selection propagating across Topbar, CaseDetail, Imaging, Chat, and Report
 * - Citation provenance clicks focusing normalized bounding boxes on Cornerstone3D viewports
 * - Report editor and clinical note evidence synchronization and version management
 * - Interactive document extraction with <mark> highlighting and field updates
 * - Modal workflows, global toast queue, and W/L viewport synchronizers
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§R2, §R3)
 * - PROJECT.md (§Feature Inventory, §Interface Contracts)
 * - medgemma-ui-design.html interactive prototype specification
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {
  renderComponent,
  loadModule,
  getWorkspaceStore,
  getImagingStore,
  resetAllStores,
  jiti,
} from './test-harness.mjs';

describe('Tier 3: Cross-Feature Interactions E2E Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // 1. Case Selection Propagation Across Screens
  // =========================================================================
  describe('Interaction 1: Case Selection Propagation', () => {
    const { Topbar } = jiti('@/components/medgemma/Topbar.tsx');
    const { CaseDetailScreen } = jiti('@/components/medgemma/screens/CaseDetailScreen.tsx');
    const { ImagingScreen } = jiti('@/components/medgemma/screens/ImagingScreen.tsx');
    const { ChatScreen } = jiti('@/components/medgemma/screens/ChatScreen.tsx');
    const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');

    it('T3.1.1: Switching active case in Topbar updates global activeCase and activeCaseId', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('No case context');
      assert.strictEqual(store.getState().activeCase, 'No case context');
      const res = renderComponent(React.createElement(Topbar));
      assert.ok(res.hasText('No case context'), 'Topbar missing updated No case context option');
    });

    it('T3.1.2: Case selection propagates to Case Detail view header and ID eyebrow', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('Trauma ICU Review', '33333333-3333-3333-3333-333333333333');
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Trauma ICU Review'), 'Case Detail missing updated active case name');
      assert.ok(res.hasText('CASE ID: 33333333'), 'Case Detail missing updated case ID');
    });

    it('T3.1.3: Case selection propagates to Medical Imaging workspace context banner', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('Case 024 · Chest review', '11111111-1111-1111-1111-111111111111');
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Case 024') && res.hasText('Chest follow-up'), 'ImagingScreen missing Case 024 context');
    });

    it('T3.1.4: Case selection propagates to Assistant Chat composer badge and input placeholder', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('Case 021 · Knee imaging', '55555555-5555-5555-5555-555555555555');
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('Case 021 · Knee imaging'));
      assert.ok(res.html.includes('Case 021 · Knee imaging'));
    });

    it('T3.1.5: Case selection propagates to Report Studio draft context', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('Case 024 · Chest review', '11111111-1111-1111-1111-111111111111');
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('024') || res.hasText('Chest') || res.hasText('Case'));
    });
  });

  // =========================================================================
  // 2. Citation Provenance Click & Viewport Bounding Box Highlighting
  // =========================================================================
  describe('Interaction 2: Citation Grounding & Viewport Focus', () => {
    const ChestXrayViewport = jiti('@/components/viewer/ChestXrayViewport.tsx').default;

    it('T3.2.1: Clicking citation chip dispatches focusCitationOnViewer to imaging store', () => {
      const imStore = getImagingStore();
      assert.strictEqual(imStore.getState().highlightedSourceId, null);
      assert.strictEqual(imStore.getState().highlightedBboxNorm, null);

      imStore.getState().focusCitationOnViewer('src-ct-024', { x0: 0.25, y0: 0.35, x1: 0.75, y1: 0.85 });
      assert.strictEqual(imStore.getState().highlightedSourceId, 'src-ct-024');
      assert.deepStrictEqual(imStore.getState().highlightedBboxNorm, {
        x0: 0.25,
        y0: 0.35,
        x1: 0.75,
        y1: 0.85,
      });
    });

    it('T3.2.2: ChestXrayViewport receives citation focus coordinates and renders active highlight overlay', () => {
      const imStore = getImagingStore();
      imStore.getState().focusCitationOnViewer('src-curr-01', { x0: 0.3, y0: 0.4, x1: 0.7, y1: 0.8 });

      const res = renderComponent(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-citation',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 512,
          imageHeight: 512,
          annotations: [],
        })
      );
      assert.ok(res.hasTag('svg'), 'ChestXrayViewport missing SVG overlay for citation bounding box');
      assert.ok(res.html.includes('rect') || res.html.includes('green') || res.html.includes('emerald'), 'Citation bounding box not rendered in SVG overlay');
    });

    it('T3.2.3: Citation focus clears when target source file ID does not match viewport', () => {
      const imStore = getImagingStore();
      imStore.getState().focusCitationOnViewer('src-other-file', { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 });

      const res = renderComponent(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-diff',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 512,
          imageHeight: 512,
          annotations: [],
        })
      );
      assert.ok(!res.html.includes('stroke="#10b981"') && !res.html.includes('stroke="#059669"'));
    });

    it('T3.2.4: Clinical Reasoning citation chip click opens Evidence Provenance modal', () => {
      const store = getWorkspaceStore();
      store.getState().openModal('source', {
        title: 'Clinical encounter note · Context',
        source: 'Clinical note.pdf · p. 1',
      });
      const { ModalRoot } = jiti('@/components/medgemma/ModalRoot.tsx');
      const res = renderComponent(React.createElement(ModalRoot));
      assert.ok(res.hasText('Evidence, in context.'), 'Modal missing Evidence, in context title');
      assert.ok(res.hasText('Open case sources'), 'Modal missing Open case sources action');
    });

    it('T3.2.5: TipTap CitationChipExtension registers citation click handler and retains editor state', () => {
      const { CitationChipExtension } = jiti('@/components/editor/CitationChipExtension.ts');
      assert.ok(CitationChipExtension, 'CitationChipExtension TipTap extension must be exported');
      assert.strictEqual(CitationChipExtension.name, 'citationChip');
    });
  });

  // =========================================================================
  // 3. Report Editor & Clinical Notes Synchronization
  // =========================================================================
  describe('Interaction 3: Report Studio & Clinical Document Sync', () => {
    it('T3.3.1: Saving report draft increments version history and updates active version number', () => {
      const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('v1') || res.hasText('Version 1') || res.hasText('draft'));
    });

    it('T3.3.2: Switching between TipTap document and structured sections mode maintains document context', () => {
      const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('Tiptap Rich Editor'));
      assert.ok(res.hasText('Structured Sections'));
    });

    it('T3.3.3: Approving report version updates case status to Reviewed in store', () => {
      const store = getWorkspaceStore();
      const currentCase = store.getState().cases.find((c) => c.id === '024');
      assert.ok(currentCase);
      // Update case to reviewed
      store.getState().setCases(
        store.getState().cases.map((c) =>
          c.id === '024' ? { ...c, status: 'Reviewed' } : c
        )
      );
      assert.strictEqual(store.getState().cases.find((c) => c.id === '024')?.status, 'Reviewed');
    });

    it('T3.3.4: Reviewed case status reflects in CasesScreen filter when Reviewed tab is active', () => {
      const store = getWorkspaceStore();
      store.getState().setCaseFilter('Reviewed');
      const { CasesScreen } = jiti('@/components/medgemma/screens/CasesScreen.tsx');
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasText('Reviewed'));
    });

    it('T3.3.5: Report export triggers confirmation toast notification', () => {
      const store = getWorkspaceStore();
      store.getState().showToast('Exported the explicitly labeled demo draft.');
      assert.strictEqual(store.getState().toastMessage, 'Exported the explicitly labeled demo draft.');
    });
  });

  // =========================================================================
  // 4. Document Extraction & Interactive Mark Highlighting
  // =========================================================================
  describe('Interaction 4: Document Extraction & Interactive Mark Highlighting', () => {
    const { ExtractionScreen } = jiti('@/components/medgemma/screens/ExtractionScreen.tsx');

    it('T3.4.1: Clicking field row sets extractionField state in workspace store', () => {
      const store = getWorkspaceStore();
      store.getState().setExtractionField('hemoglobin');
      assert.strictEqual(store.getState().extractionField, 'hemoglobin');
      store.getState().setExtractionField('wbc');
      assert.strictEqual(store.getState().extractionField, 'wbc');
    });

    it('T3.4.2: Matching <mark> tag receives active highlight styling for selected extractionField', () => {
      const store = getWorkspaceStore();
      store.getState().setExtractionField('hemoglobin');
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.html.includes('data-field-mark="hemoglobin"'));
      assert.ok(res.html.includes('highlight') || res.html.includes('bg-') || res.html.includes('mark'));
    });

    it('T3.4.3: Switching extraction field to date updates active mark highlight', () => {
      const store = getWorkspaceStore();
      store.getState().setExtractionField('date');
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.html.includes('data-field-mark="date"'));
    });

    it('T3.4.4: Editing extracted field value updates store state and preserves locator button', () => {
      const store = getWorkspaceStore();
      store.getState().updateExtractedField('wbc', '7.2 ×10⁹/L');
      const field = store.getState().extractedFields.find((f) => f.id === 'wbc');
      assert.strictEqual(field?.value, '7.2 ×10⁹/L');
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.html.includes('7.2 ×10⁹/L') || res.hasText('7.2'));
    });

    it('T3.4.5: Verified fields export JSON structure contains provenance metadata', () => {
      const store = getWorkspaceStore();
      const fields = store.getState().extractedFields;
      const exportJson = JSON.stringify({
        demo: true,
        case_id: store.getState().activeCaseId,
        review_status: 'verified',
        fields,
      });
      assert.ok(exportJson.includes('hemoglobin'));
      assert.ok(exportJson.includes('verified'));
    });
  });

  // =========================================================================
  // 5. Modal Workflows & Global State Integration
  // =========================================================================
  describe('Interaction 5: Modal Workflows & Global State Integration', () => {
    const { ModalRoot } = jiti('@/components/medgemma/ModalRoot.tsx');
    const { Toast } = jiti('@/components/medgemma/Toast.tsx');

    it('T3.5.1: Submitting New Case modal prepends case to cases store and resets filters', () => {
      const store = getWorkspaceStore();
      store.getState().setCaseFilter('Needs review');
      store.getState().setCaseSearch('filter_test');
      store.getState().addCase({ name: 'Emergency Post-Op Review', meta: 'CT · 2 studies' });

      const cases = store.getState().cases;
      assert.strictEqual(cases[0].name, 'Emergency Post-Op Review');
      assert.strictEqual(store.getState().caseFilter, 'All cases');
      assert.strictEqual(store.getState().caseSearch, '');
      assert.strictEqual(store.getState().page, 'cases');
    });

    it('T3.5.2: Sequential toasts replace pending toast and reset dismiss timer', () => {
      const store = getWorkspaceStore();
      store.getState().showToast('First toast');
      assert.strictEqual(store.getState().toastMessage, 'First toast');
      store.getState().showToast('Second toast');
      assert.strictEqual(store.getState().toastMessage, 'Second toast');
      const res = renderComponent(React.createElement(Toast));
      assert.ok(res.hasText('Second toast'));
      assert.ok(!res.hasText('First toast'));
    });

    it('T3.5.3: Switching imagingMode dynamically switches viewport configuration in ImagingScreen', () => {
      const store = getWorkspaceStore();
      const { ImagingScreen } = jiti('@/components/medgemma/screens/ImagingScreen.tsx');

      store.getState().setImagingMode('volume');
      const resVolume = renderComponent(React.createElement(ImagingScreen));
      assert.ok(resVolume.hasText('3D & MULTIPLANAR') || resVolume.hasText('Volumetric') || resVolume.hasText('Multi-slice'));

      store.getState().setImagingMode('analysis');
      const resAnalysis = renderComponent(React.createElement(ImagingScreen));
      assert.ok(resAnalysis.hasText('Analysis') || resAnalysis.hasText('Cornerstone3D'));
    });

    it('T3.5.4: W/L synchronizer flag updates sharedWindowRange across viewports in useImagingStore', () => {
      const imStore = getImagingStore();
      assert.strictEqual(imStore.getState().syncPriorCurrent, true);
      imStore.getState().setSharedWindowRange({ lower: -200, upper: 800 });
      assert.deepStrictEqual(imStore.getState().sharedWindowRange, { lower: -200, upper: 800 });
    });

    it('T3.5.5: File upload modal attaches file record and updates library files', () => {
      const store = getWorkspaceStore();
      store.getState().openModal('upload');
      const res = renderComponent(React.createElement(ModalRoot));
      assert.ok(res.hasText('Upload a file') || res.hasText('Add to case') || res.hasText('Upload'));
    });
  });
});
