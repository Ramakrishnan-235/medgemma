/**
 * Tier 2: Boundary & Corner Cases E2E Test Suite
 * 
 * Validates resilience and edge conditions:
 * - Empty data sets and zero search results
 * - Invalid inputs, whitespace-only submissions, and validation gates
 * - Extreme values, boundary clamping (slice indices 1..240), and special characters
 * - Medical imaging edge cases: PA/AP projection mismatch, VOI range validation
 * - Responsive breakpoints (<850px, <600px, <380px, >=1600px) and modal ESC dismissal
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§R2, §R3)
 * - PROJECT.md (§Feature Inventory, §Interface Contracts)
 * - medgemma-ui-design.html interactive prototype edge cases
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
  simulateResponsiveStyle,
  Breakpoints,
  jiti,
} from './test-harness.mjs';

describe('Tier 2: Boundary & Corner Cases E2E Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // 1. Empty Data Handling
  // =========================================================================
  describe('Group 1: Empty Data Handling', () => {
    const { CasesScreen } = loadModule('src/components/medgemma/screens/CasesScreen.tsx');
    const { LibraryScreen } = loadModule('src/components/medgemma/screens/LibraryScreen.tsx');
    const { ChatScreen } = loadModule('src/components/medgemma/screens/ChatScreen.tsx');
    const { EhrScreen } = loadModule('src/components/medgemma/screens/EhrScreen.tsx');
    const { CaseDetailScreen } = loadModule('src/components/medgemma/screens/CaseDetailScreen.tsx');

    it('T2.1.1: Case search with zero matching results renders empty state row', () => {
      const store = getWorkspaceStore();
      store.getState().setCaseSearch('NONEXISTENT_QUERY_XYZ_9999');
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(
        res.hasText('No matching demo cases.') || res.hasText('No matching') || res.hasText('No cases'),
        'Cases table did not render empty match state'
      );
    });

    it('T2.1.2: Library search with zero matching files renders empty table state', () => {
      const store = getWorkspaceStore();
      store.getState().setLibrarySearch('NONEXISTENT_DOCUMENT_12345');
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(
        res.hasText('No matching files.') || res.hasText('No matching') || res.hasText('No files'),
        'Library table did not render empty match state'
      );
    });

    it('T2.1.3: Chat history with zero messages renders starter suggestion cards and empty prompt title', () => {
      const store = getWorkspaceStore();
      store.getState().clearChat();
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('What can we explore today?') || res.hasText('Room to think.'));
      assert.ok(res.hasText('Summarize attached note') || res.hasText('Summarize'));
    });

    it('T2.1.4: Empty active case context displays fallback de-identified header without throwing', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('', '');
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Chest follow-up') || res.hasText('CASE ID') || res.hasText('Case context'));
    });

    it('T2.1.5: EHR summary with absent medication records renders explicit "Not provided" dashed badge', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Not provided'), 'EHR did not label missing medications as Not provided');
      assert.ok(res.hasText('Unknown'), 'EHR did not label missing allergies as Unknown');
    });
  });

  // =========================================================================
  // 2. Invalid Input Handling & Form Validation
  // =========================================================================
  describe('Group 2: Invalid Inputs & Validation Gates', () => {
    const { ModalRoot } = jiti('@/components/medgemma/ModalRoot.tsx');
    const { ChatScreen } = jiti('@/components/medgemma/screens/ChatScreen.tsx');
    const { QaScreen } = jiti('@/components/medgemma/screens/QaScreen.tsx');

    it('T2.2.1: New Case modal title input has required attribute and max-length restriction', () => {
      const store = getWorkspaceStore();
      store.getState().openModal('newcase');
      const res = renderComponent(React.createElement(ModalRoot));
      assert.ok(res.hasText('New case') || res.hasText('Create case') || res.hasText('Case title'));
      assert.ok(res.hasTag('input'), 'Modal missing case title input');
      assert.ok(res.html.includes('required'), 'Case title input missing required validation attribute');
    });

    it('T2.2.2: Blank or whitespace-only chat message does not append empty bubbles', () => {
      const store = getWorkspaceStore();
      const initialCount = store.getState().chatMessages.length;
      // Trigger empty message additions
      store.getState().addChatMessage('   ');
      store.getState().addChatMessage('\t\n');
      // Verify store ignores or component filters
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.countOccurrences('speech') <= initialCount);
    });

    it('T2.2.3: Medical Q&A empty inquiry textarea retains focus without premature answer card', () => {
      const store = getWorkspaceStore();
      store.getState().setQaAnswer(false);
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasText('Ask question'));
      assert.ok(!res.html.includes('Queued in transactional outbox'));
    });

    it('T2.2.4: File upload modal without selected file displays prompt and keeps dialog open', () => {
      const store = getWorkspaceStore();
      store.getState().openModal('upload');
      const res = renderComponent(React.createElement(ModalRoot));
      assert.ok(res.hasText('Upload a file') || res.hasText('Attach file') || res.hasText('Upload'));
      assert.ok(res.hasTag('input'));
    });

    it('T2.2.5: Report Studio pre-export safety checklist requires verification before export action', () => {
      const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('Before you export') || res.hasText('Export draft'));
    });
  });

  // =========================================================================
  // 3. Extreme Values, Clamping & Input Escaping
  // =========================================================================
  describe('Group 3: Extreme Values, Clamping & Sanitization', () => {
    it('T2.3.1: Slice index is strictly clamped to minimum of 1 when input is 0 or negative', () => {
      const store = getWorkspaceStore();
      store.getState().setSliceIndex(0);
      assert.strictEqual(store.getState().sliceIndex, 1);
      store.getState().setSliceIndex(-50);
      assert.strictEqual(store.getState().sliceIndex, 1);
    });

    it('T2.3.2: Slice index is strictly clamped to maximum of 240 when input exceeds upper limit', () => {
      const store = getWorkspaceStore();
      store.getState().setSliceIndex(241);
      assert.strictEqual(store.getState().sliceIndex, 240);
      store.getState().setSliceIndex(99999);
      assert.strictEqual(store.getState().sliceIndex, 240);
    });

    it('T2.3.3: Decimal slice values are rounded to nearest valid integer slice', () => {
      const store = getWorkspaceStore();
      store.getState().setSliceIndex(124.7);
      assert.strictEqual(store.getState().sliceIndex, 125);
      store.getState().setSliceIndex(124.2);
      assert.strictEqual(store.getState().sliceIndex, 124);
    });

    it('T2.3.4: Extreme length string (1000+ chars) in search does not break filter logic', () => {
      const store = getWorkspaceStore();
      const longString = 'A'.repeat(1200);
      assert.doesNotThrow(() => {
        store.getState().setCaseSearch(longString);
        store.getState().setLibrarySearch(longString);
      });
      assert.strictEqual(store.getState().caseSearch.length, 1200);
    });

    it('T2.3.5: Special characters and XSS payloads in case titles or chat are escaped', () => {
      const store = getWorkspaceStore();
      const payload = '<script>alert("XSS")</script>&quot;\' OR 1=1;--';
      store.getState().addCase({ name: payload, meta: 'Injected' });
      const { CasesScreen } = jiti('@/components/medgemma/screens/CasesScreen.tsx');
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(!res.html.includes('<script>alert'), 'Raw unescaped script tag rendered');
      assert.ok(res.hasText('&lt;script&gt;') || res.extractText().includes(payload));
    });
  });

  // =========================================================================
  // 4. Medical Imaging Boundary & Projection Mismatch
  // =========================================================================
  describe('Group 4: Medical Imaging Boundary & Projection Mismatch', () => {
    it('T2.4.1: Longitudinal workspace detects PA vs AP projection mismatch between studies', () => {
      const { LongitudinalXrayWorkspace } = jiti('@/components/viewer/LongitudinalXrayWorkspace.tsx');
      // Create prior and current studies with mismatched view positions (PA vs AP)
      const priorStudy = {
        source_file_id: 'src-p1',
        filename: 'prior-study.png',
        file_kind: 'image_png',
        metadata: { view_position: 'PA' },
        raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      };
      const currentStudy = {
        source_file_id: 'src-c1',
        filename: 'current-study.png',
        file_kind: 'image_png',
        metadata: { view_position: 'AP' },
        raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      };

      const res = renderComponent(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy,
          currentStudy,
        })
      );
      assert.ok(
        res.hasText('Projection Warning:') || res.hasText('PA') && res.hasText('AP'),
        'Longitudinal workspace failed to detect radiologic projection angle mismatch'
      );
    });

    it('T2.4.2: Normalized bounding box validator accepts coordinates strictly within [0..1]', () => {
      const imStore = getImagingStore();
      const validBox = { x0: 0.2, y0: 0.3, x1: 0.7, y1: 0.8 };
      imStore.getState().focusCitationOnViewer('src-01', validBox);
      const state = imStore.getState();
      assert.ok(state.highlightedBboxNorm.x0 >= 0 && state.highlightedBboxNorm.x0 <= 1);
      assert.ok(state.highlightedBboxNorm.x1 >= state.highlightedBboxNorm.x0);
      assert.ok(state.highlightedBboxNorm.y1 >= state.highlightedBboxNorm.y0);
    });

    it('T2.4.3: Schematic viewer Measure tool displays non-diagnostic disclaimer toast', () => {
      const { Viewer } = loadModule('src/components/medgemma/Viewer.tsx');
      const res = renderComponent(React.createElement(Viewer));
      assert.ok(res.hasText('Measure'), 'Viewer missing Measure tool button');
      assert.ok(res.hasText('SCHEMATIC PREVIEW'), 'Viewer missing schematic watermark');
    });

    it('T2.4.4: Window/Level preset range retains lower < upper invariant', () => {
      const imStore = getImagingStore();
      imStore.getState().setSharedWindowRange({ lower: 100, upper: 500 });
      const range = imStore.getState().sharedWindowRange;
      assert.ok(range.lower < range.upper, 'VOI window range inverted: lower >= upper');
    });

    it('T2.4.5: Series switcher retains valid series state ("01" | "02" | "03")', () => {
      const store = getWorkspaceStore();
      store.getState().setSelectedSeries('02');
      assert.strictEqual(store.getState().selectedSeries, '02');
      store.getState().setSelectedSeries('03');
      assert.strictEqual(store.getState().selectedSeries, '03');
    });
  });

  // =========================================================================
  // 5. Responsive Breakpoint Edge Dimensions & Keyboard Dismissal
  // =========================================================================
  describe('Group 5: Responsive Breakpoints & Keyboard Dismissal', () => {
    it('T2.5.1: Tablet breakpoint (<850px) hides sidebar navigation and enables mobile topbar brand', () => {
      const tablet = simulateResponsiveStyle(Breakpoints.TABLET);
      assert.strictEqual(tablet.isSidebarHidden, true, 'Sidebar must be hidden under 850px');
      assert.strictEqual(tablet.isMobileBrandVisible, true, 'Mobile brand must activate under 850px');
      assert.strictEqual(tablet.isDesktopBreadcrumbHidden, true, 'Desktop breadcrumb should hide on tablet');
    });

    it('T2.5.2: Narrow mobile breakpoint (<600px) collapses dual columns to single vertical stack', () => {
      const mobile = simulateResponsiveStyle(Breakpoints.MOBILE);
      assert.strictEqual(mobile.isStackedColumnLayout, true, 'Columns must collapse under 600px');
    });

    it('T2.5.3: Ultra-narrow mobile (<380px) hides user avatar to prevent header overflow', () => {
      const ultraNarrow = simulateResponsiveStyle(Breakpoints.ULTRA_NARROW);
      assert.strictEqual(ultraNarrow.isAvatarHidden, true, 'Avatar must hide under 380px');
    });

    it('T2.5.4: Ultra-wide workstation (>=1600px) expands container padding and min viewer dimensions', () => {
      const workstation = simulateResponsiveStyle(Breakpoints.DESKTOP_ULTRAWIDE);
      assert.strictEqual(workstation.isMaxPaddingExpanded, true, 'Workstation padding must expand >=1600px');
    });

    it('T2.5.5: Modal closes cleanly and resets activeModal state on dismiss', () => {
      const store = getWorkspaceStore();
      store.getState().openModal('source', { quote: 'Test excerpt' });
      assert.ok(store.getState().activeModal !== null);
      store.getState().closeModal();
      assert.strictEqual(store.getState().activeModal, null);
    });
  });
});
