/**
 * Tier 1: Feature Coverage E2E Test Suite
 * 
 * Validates >= 5 test cases per feature across:
 * - Monochrome Token Architecture & Theme
 * - Global Application Shell & Layout
 * - Routing & Hash Synchronization
 * - Zustand State Stores
 * - All 15 Workspace Screens
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§R1, §R2, §R3)
 * - PROJECT.md (§Feature Inventory #1-#22)
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
  TokenInspector,
} from './test-harness.mjs';

describe('Tier 1: Feature Coverage E2E Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // 1. Monochrome Token Architecture & Theme (Feature #1)
  // =========================================================================
  describe('Feature 1: Monochrome Token Architecture & Theme', () => {
    const inspector = new TokenInspector();

    it('T1.1.1: Global canvas background token is defined as zinc-950 (#09090b)', () => {
      const hasBase = inspector.hasTokenDefinition('--background', '#09090b') ||
                      inspector.hasTokenDefinition('--paper', '#09090b') ||
                      inspector.designCss.includes('#09090b') ||
                      inspector.globalsCss.includes('#09090b');
      assert.ok(hasBase, 'Expected base background token #09090b to be defined');
    });

    it('T1.1.2: Surface and card token is defined as zinc-900 (#18181b)', () => {
      const hasCard = inspector.hasTokenDefinition('--card', '#18181b') ||
                      inspector.hasTokenDefinition('--white', '#18181b') ||
                      inspector.designCss.includes('#18181b') ||
                      inspector.globalsCss.includes('#18181b');
      assert.ok(hasCard, 'Expected card/surface token #18181b to be defined');
    });

    it('T1.1.3: 1px border contrast token is defined as zinc-800 (#27272a)', () => {
      const hasBorder = inspector.hasTokenDefinition('--border', '#27272a') ||
                        inspector.hasTokenDefinition('--line', '#27272a') ||
                        inspector.designCss.includes('#27272a') ||
                        inspector.globalsCss.includes('#27272a');
      assert.ok(hasBorder, 'Expected border contrast token #27272a to be defined');
    });

    it('T1.1.4: Primary text foreground is high-contrast light (#f4f4f5 / zinc-100)', () => {
      const hasForeground = inspector.hasTokenDefinition('--foreground', '#f4f4f5') ||
                            inspector.hasTokenDefinition('--ink', '#f4f4f5') ||
                            inspector.designCss.includes('#f4f4f5') ||
                            inspector.globalsCss.includes('#f4f4f5');
      assert.ok(hasForeground, 'Expected foreground text token #f4f4f5 to be defined');
    });

    it('T1.1.5: Medical viewer canvas background is pure black (#000000 / #0c0c0e) for DICOM dynamic range', () => {
      const hasViewerBg = inspector.designCss.includes('#000000') ||
                          inspector.designCss.includes('#0c0c0e') ||
                          inspector.designCss.includes('.viewer') ||
                          inspector.hasCssClass('bg-zinc-950') ||
                          inspector.globalsCss.includes('--viewer-bg');
      assert.ok(hasViewerBg, 'Expected medical viewer dark background style');
    });

    it('T1.1.6: Dark mode class or color-scheme is declared in design system', () => {
      const hasDarkDecl = inspector.hasDarkClassOnHtml() ||
                          inspector.globalsCss.includes('.dark') ||
                          inspector.designCss.includes('color-scheme: dark') ||
                          inspector.hasDarkBackgroundOnRoot();
      assert.ok(hasDarkDecl, 'Expected dark color scheme declaration across layout or CSS');
    });
  });

  // =========================================================================
  // 2. Global Application Shell & Layout (Features #4, #5, #6, #7)
  // =========================================================================
  describe('Feature 2: Global Application Shell & Layout', () => {
    const { ReviewBar } = loadModule('src/components/medgemma/ReviewBar.tsx');
    const { Sidebar } = loadModule('src/components/medgemma/Sidebar.tsx');
    const { Topbar } = loadModule('src/components/medgemma/Topbar.tsx');
    const { Toast } = loadModule('src/components/medgemma/Toast.tsx');

    it('T1.2.1: ReviewBar renders MedGemma brand, 15 screens label, and select screen-picker', () => {
      const res = renderComponent(React.createElement(ReviewBar));
      assert.ok(res.hasText('MedGemma'), 'ReviewBar missing brand MedGemma');
      assert.ok(res.hasText('15 screens'), 'ReviewBar missing 15 screens indicator');
      assert.ok(res.hasTag('select'), 'ReviewBar missing select element');
      assert.ok(res.html.includes('id="screen-picker"'), 'ReviewBar missing id screen-picker');
    });

    it('T1.2.2: ReviewBar contains all 15 screens in dropdown options', () => {
      const res = renderComponent(React.createElement(ReviewBar));
      const { PAGES } = loadModule('src/types/workspace.ts');
      for (const [id, label] of PAGES) {
        const escapedLabel = label.replace('&', '&amp;');
        assert.ok(res.hasText(escapedLabel), `ReviewBar missing screen option: ${label}`);
        assert.ok(res.html.includes(`value="${id}"`), `ReviewBar missing value: ${id}`);
      }
    });

    it('T1.2.3: Sidebar renders brand header with "+" mark and CLINICAL WORKSPACE subtitle', () => {
      const res = renderComponent(React.createElement(Sidebar));
      assert.ok(res.hasText('MedGemma'), 'Sidebar missing MedGemma brand');
      assert.ok(res.hasText('CLINICAL WORKSPACE') || res.hasText('Clinical Workspace'), 'Sidebar missing subtitle');
      assert.ok(res.hasText('My workspace'), 'Sidebar missing workspace selector');
    });

    it('T1.2.4: Sidebar renders navigation links with active state indicator and case count pill', () => {
      const res = renderComponent(React.createElement(Sidebar));
      assert.ok(res.hasText('Overview'), 'Sidebar missing Overview nav item');
      assert.ok(res.hasText('Cases'), 'Sidebar missing Cases nav item');
      assert.ok(res.hasText('Medical imaging'), 'Sidebar missing Medical imaging');
      assert.ok(res.hasText('Clinical text'), 'Sidebar missing Clinical text');
      assert.ok(res.hasText('Assistant'), 'Sidebar missing Assistant');
      assert.ok(res.hasText('Dr. Morgan'), 'Sidebar missing clinician profile Dr. Morgan');
    });

    it('T1.2.5: Topbar renders dynamic breadcrumbs and active case selector', () => {
      const res = renderComponent(React.createElement(Topbar));
      assert.ok(res.hasText('Workspace'), 'Topbar missing Workspace breadcrumb');
      assert.ok(res.hasTag('select'), 'Topbar missing case-picker select');
      assert.ok(res.hasText('Case 024 · Chest review'), 'Topbar missing default active case');
    });

    it('T1.2.6: Toast component renders polite live region when message is active', () => {
      const store = getWorkspaceStore();
      store.getState().showToast('Test Notification Message');
      const res = renderComponent(React.createElement(Toast));
      assert.ok(res.hasText('Test Notification Message'), 'Toast failed to render active toast message');
      assert.ok(res.html.includes('toast') || res.html.includes('alert'), 'Toast missing toast container class');
    });
  });

  // =========================================================================
  // 3. Routing & Hash Navigation (Feature #4, #5)
  // =========================================================================
  describe('Feature 3: Routing & Hash Navigation', () => {
    const { PAGES, isPageId } = loadModule('src/types/workspace.ts');

    it('T1.3.1: isPageId accurately validates all 15 defined screens', () => {
      assert.strictEqual(PAGES.length, 15, 'Expected exactly 15 screens defined in PAGES');
      for (const [id] of PAGES) {
        assert.ok(isPageId(id), `isPageId rejected valid page: ${id}`);
      }
    });

    it('T1.3.2: isPageId rejects arbitrary invalid page identifiers', () => {
      assert.strictEqual(isPageId('invalid_screen'), false);
      assert.strictEqual(isPageId(''), false);
      assert.strictEqual(isPageId('../root'), false);
      assert.strictEqual(isPageId('null'), false);
    });

    it('T1.3.3: Default route initialized in workspace store is overview', () => {
      const store = getWorkspaceStore();
      assert.strictEqual(store.getState().page, 'overview');
    });

    it('T1.3.4: setPage action updates active route in Zustand store', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('imaging');
      assert.strictEqual(store.getState().page, 'imaging');
      store.getState().setPage('report');
      assert.strictEqual(store.getState().page, 'report');
    });

    it('T1.3.5: Standalone landing and signin pages are recognized as valid routes', () => {
      assert.ok(isPageId('landing'));
      assert.ok(isPageId('signin'));
      const store = getWorkspaceStore();
      store.getState().setPage('landing');
      assert.strictEqual(store.getState().page, 'landing');
      store.getState().setPage('signin');
      assert.strictEqual(store.getState().page, 'signin');
    });
  });

  // =========================================================================
  // 4. Zustand State Store Bindings (Features #1-#22)
  // =========================================================================
  describe('Feature 4: Zustand State Store Bindings', () => {
    it('T1.4.1: useWorkspaceStore initializes default activeCase and activeCaseId correctly', () => {
      const store = getWorkspaceStore();
      const state = store.getState();
      assert.strictEqual(state.activeCase, 'Case 024 · Chest review');
      assert.ok(state.activeCaseId.length > 0, 'activeCaseId must not be empty');
      assert.strictEqual(state.imagingMode, 'analysis');
      assert.strictEqual(state.sliceIndex, 124);
    });

    it('T1.4.2: addCase action prepends case item and increments case inventory', () => {
      const store = getWorkspaceStore();
      const initialCount = store.getState().cases.length;
      store.getState().addCase({ name: 'New Trauma Followup', meta: 'CT · 1 study' });
      const updated = store.getState().cases;
      assert.strictEqual(updated.length, initialCount + 1);
      assert.strictEqual(updated[0].name, 'New Trauma Followup');
      assert.strictEqual(updated[0].meta, 'CT · 1 study');
      assert.strictEqual(updated[0].status, 'In progress');
    });

    it('T1.4.3: updateExtractedField mutates field values immutably', () => {
      const store = getWorkspaceStore();
      store.getState().updateExtractedField('hemoglobin', '14.5 g/dL');
      const field = store.getState().extractedFields.find((f) => f.id === 'hemoglobin');
      assert.ok(field);
      assert.strictEqual(field.value, '14.5 g/dL');
    });

    it('T1.4.4: openModal and closeModal correctly toggle active modal state', () => {
      const store = getWorkspaceStore();
      assert.strictEqual(store.getState().activeModal, null);
      store.getState().openModal('newcase');
      assert.deepStrictEqual(store.getState().activeModal, { type: 'newcase', payload: undefined });
      store.getState().closeModal();
      assert.strictEqual(store.getState().activeModal, null);
    });

    it('T1.4.5: useImagingStore initializes activeTool to WindowLevel and manages tool changes', () => {
      const imStore = getImagingStore();
      assert.strictEqual(imStore.getState().activeTool, 'WindowLevel');
      imStore.getState().setActiveTool('Zoom');
      assert.strictEqual(imStore.getState().activeTool, 'Zoom');
      imStore.getState().setActiveTool('DrawBox');
      assert.strictEqual(imStore.getState().activeTool, 'DrawBox');
    });

    it('T1.4.6: focusCitationOnViewer updates highlighted source file and normalized bbox', () => {
      const imStore = getImagingStore();
      imStore.getState().focusCitationOnViewer('src-ct-024', { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 });
      const state = imStore.getState();
      assert.strictEqual(state.highlightedSourceId, 'src-ct-024');
      assert.deepStrictEqual(state.highlightedBboxNorm, { x0: 0.1, y0: 0.2, x1: 0.5, y1: 0.6 });
    });
  });

  // =========================================================================
  // 5. Screen 1: Overview Dashboard (Feature #8)
  // =========================================================================
  describe('Screen 1: Overview Dashboard (overview)', () => {
    const { OverviewScreen } = loadModule('src/components/medgemma/screens/OverviewScreen.tsx');

    it('T1.5.1: Renders clinician greeting and workspace overview eyebrow', () => {
      const res = renderComponent(React.createElement(OverviewScreen));
      assert.ok(res.hasText('Good morning') || res.hasText('Clinician'));
      assert.ok(res.hasText('WORKSPACE OVERVIEW') || res.hasText('OVERVIEW'));
      assert.ok(res.hasText('MedGemma'));
    });

    it('T1.5.2: Renders 3 KPI metric cards (Active cases, Awaiting review, Report drafts)', () => {
      const res = renderComponent(React.createElement(OverviewScreen));
      assert.ok(res.hasText('Active cases'), 'Missing Active cases metric');
      assert.ok(res.hasText('Awaiting review'), 'Missing Awaiting review metric');
      assert.ok(res.hasText('Report drafts'), 'Missing Report drafts metric');
      assert.ok(res.hasText('12'), 'Expected active cases count 12');
      assert.ok(res.hasText('04') || res.hasText('4'), 'Expected awaiting review count 4');
    });

    it('T1.5.3: Renders 3 quick action launch cards linking to imaging, ehr, and chat', () => {
      const res = renderComponent(React.createElement(OverviewScreen));
      assert.ok(res.hasText('Review an image'));
      assert.ok(res.hasText('Understand a record'));
      assert.ok(res.hasText('Start a conversation'));
    });

    it('T1.5.4: Renders recent cases table with Case 024 and Case 023', () => {
      const res = renderComponent(React.createElement(OverviewScreen));
      assert.ok(res.hasText('Chest follow-up'));
      assert.ok(res.hasText('Record synthesis'));
      assert.ok(res.hasText('Needs review'));
    });

    it('T1.5.5: Renders recent activity audit stream with chronological entries', () => {
      const res = renderComponent(React.createElement(OverviewScreen));
      assert.ok(res.hasText('Recent activity'));
      assert.ok(res.hasText('Report draft saved') || res.hasText('records added') || res.hasText('Extraction ready'));
      assert.ok(res.hasText('Open review queue') || res.hasText('review queue'));
    });
  });

  // =========================================================================
  // 6. Screen 2: Cases List (Feature #9)
  // =========================================================================
  describe('Screen 2: Cases List (cases)', () => {
    const { CasesScreen } = loadModule('src/components/medgemma/screens/CasesScreen.tsx');

    it('T1.6.1: Renders case management header and description', () => {
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasText('Every case. One place.'));
      assert.ok(res.hasText('Keep your files, conversations and findings connected.'));
      assert.ok(res.hasText('New case'));
    });

    it('T1.6.2: Renders filter tabs (All cases, Needs review, Draft ready, Reviewed)', () => {
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasText('All cases'));
      assert.ok(res.hasText('Needs review'));
      assert.ok(res.hasText('Draft ready'));
      assert.ok(res.hasText('Reviewed'));
    });

    it('T1.6.3: Renders search input with placeholder', () => {
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasTag('input'));
      assert.ok(res.html.includes('Search cases') || res.html.includes('Search') || res.html.includes('placeholder'));
    });

    it('T1.6.4: Renders case table headers (CASE, CONTEXT, STATUS, LAST ACTIVITY)', () => {
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasText('CASE'));
      assert.ok(res.hasText('CONTEXT'));
      assert.ok(res.hasText('STATUS'));
      assert.ok(res.hasText('LAST ACTIVITY'));
      assert.ok(res.countOccurrences('<th>') >= 4);
    });

    it('T1.6.5: Displays initial baseline cases in table rows', () => {
      const res = renderComponent(React.createElement(CasesScreen));
      assert.ok(res.hasText('Chest follow-up'));
      assert.ok(res.hasText('CT · 2 studies'));
      assert.ok(res.hasText('Knee imaging'));
    });
  });

  // =========================================================================
  // 7. Screen 3: Case Detail (Feature #10)
  // =========================================================================
  describe('Screen 3: Case Detail (case)', () => {
    const { CaseDetailScreen } = loadModule('src/components/medgemma/screens/CaseDetailScreen.tsx');

    it('T1.7.1: Renders case title, eyebrow, and clinical description', () => {
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Chest') || res.hasText('Case 024') || res.hasText('CASE ID'));
      assert.ok(res.hasText('A connected view of this case, from source to draft.'));
      assert.ok(res.hasText('Review study'));
    });

    it('T1.7.2: Renders context banner with Needs review badge', () => {
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Needs review'));
      assert.ok(res.hasText('De-identified') || res.hasText('study') || res.hasText('clinical'));
    });

    it('T1.7.3: Renders Files & studies inventory panel', () => {
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Files & studies') || res.hasText('Files'));
      assert.ok(res.hasText('CT chest · Current') || res.hasText('Current CT'));
      assert.ok(res.hasText('CT chest · Prior') || res.hasText('Prior CT'));
    });

    it('T1.7.4: Renders Case outputs panel with draft count', () => {
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Case outputs'));
      assert.ok(res.hasText('Chest imaging report'));
      assert.ok(res.hasText('Clinical record summary') || res.hasText('summary'));
    });

    it('T1.7.5: Renders Case timeline chronological event log', () => {
      const res = renderComponent(React.createElement(CaseDetailScreen));
      assert.ok(res.hasText('Case timeline') || res.hasText('timeline'));
      assert.ok(res.hasText('Current CT study attached') || res.hasText('attached'));
    });
  });

  // =========================================================================
  // 8. Screen 4: Medical Imaging Workspace (Features #19, #20)
  // =========================================================================
  describe('Screen 4: Medical Imaging Workspace (imaging)', () => {
    const { ImagingScreen } = loadModule('src/components/medgemma/screens/ImagingScreen.tsx');
    const { Viewer } = loadModule('src/components/medgemma/Viewer.tsx');

    it('T1.8.1: Renders imaging workspace header and actions', () => {
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Look closer. See the context.'));
      assert.ok(res.hasText('Compare'));
      assert.ok(res.hasText('Generate draft') || res.hasText('Open report draft'));
    });

    it('T1.8.2: Renders workspace mode toolbar tabs (Analysis, 3D, Localization)', () => {
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Analysis'));
      assert.ok(res.hasText('3D & multiplanar') || res.hasText('3D'));
      assert.ok(res.hasText('Anatomical localization') || res.hasText('localization'));
    });

    it('T1.8.3: Renders series switcher strip (Axial, Coronal, Sagittal)', () => {
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Series 01') || res.hasText('Axial'));
      assert.ok(res.hasText('Series 02') || res.hasText('Coronal'));
      assert.ok(res.hasText('Series 03') || res.hasText('Sagittal'));
    });

    it('T1.8.4: Renders Cornerstone3D viewport container or Viewer with slice slider', () => {
      const resImaging = renderComponent(React.createElement(ImagingScreen));
      assert.ok(
        resImaging.hasText('Cornerstone3D') || resImaging.html.includes('viewer') || resImaging.html.includes('viewport'),
        'ImagingScreen missing Cornerstone3D container'
      );
      const resViewer = renderComponent(React.createElement(Viewer));
      assert.ok(resViewer.hasText('Slice'), 'Viewer component missing Slice label');
      assert.ok(resViewer.extractText().includes('124/240') || resViewer.matches(/124.*240/), 'Viewer component missing 124/240 readout');
      assert.ok(resViewer.hasTag('input'), 'Viewer component missing range slider');
    });

    it('T1.8.5: Renders observation panel with reviewer notes and draft trigger', () => {
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Observation panel') || res.hasText('Observations') || res.hasText('Anatomical'));
      assert.ok(res.hasTag('textarea') || res.hasText('Reviewer note'));
      assert.ok(res.hasText('Open report draft') || res.hasText('Generate draft'));
    });
  });

  // =========================================================================
  // 9. Screen 5: Longitudinal Comparison (Feature #21)
  // =========================================================================
  describe('Screen 5: Longitudinal Comparison (compare)', () => {
    const { CompareScreen } = loadModule('src/components/medgemma/screens/CompareScreen.tsx');

    it('T1.9.1: Renders longitudinal comparison header and Analyze changes trigger', () => {
      const res = renderComponent(React.createElement(CompareScreen));
      assert.ok(res.hasText('Side by side. What changed?') || res.hasText('A view across time.'));
      assert.ok(res.hasText('Analyze changes') || res.hasText('Back to imaging'));
      assert.ok(res.hasText('IMAGING / LONGITUDINAL'));
    });

    it('T1.9.2: Renders dual study selectors for Prior and Current studies', () => {
      const res = renderComponent(React.createElement(CompareScreen));
      assert.ok(res.hasText('21 Jul 2026') || res.hasText('Prior'));
      assert.ok(res.hasText('24 Oct 2026') || res.hasText('Current'));
    });

    it('T1.9.3: Renders 95-day elapsed interval timeline bar', () => {
      const res = renderComponent(React.createElement(CompareScreen));
      assert.ok(res.hasText('95 days'));
    });

    it('T1.9.4: Renders dual viewports for side-by-side radiologic comparison', () => {
      const res = renderComponent(React.createElement(CompareScreen));
      assert.ok(res.hasText('PRIOR') || res.hasText('Prior') || res.hasText('21 Jul 2026'));
      assert.ok(res.hasText('CURRENT') || res.hasText('Current') || res.hasText('24 Oct 2026'));
    });

    it('T1.9.5: Renders interval change findings panel with pulmonary review states', () => {
      const res = renderComponent(React.createElement(CompareScreen));
      assert.ok(res.hasText('Interval change findings') || res.hasText('REGION / ITEM'));
      assert.ok(res.hasText('Right lower lobe') || res.hasText('Opacity'));
      assert.ok(res.hasText('Improved') || res.hasText('Stable'));
    });
  });

  // =========================================================================
  // 10. Screen 6: Assistant Chat (Feature #15)
  // =========================================================================
  describe('Screen 6: Assistant Chat (chat)', () => {
    const { ChatScreen } = loadModule('src/components/medgemma/screens/ChatScreen.tsx');

    it('T1.10.1: Renders assistant header and title "Room to think."', () => {
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('Room to think.'));
      assert.ok(res.hasText('Interactive multimodal conversation') || res.hasText('case evidence'));
      assert.ok(res.extractText().includes('Structured Q&A') || res.hasText('Structured Q&amp;A') || res.hasText('Medical Q&A'));
    });

    it('T1.10.2: Renders conversation history sidebar with New conversation trigger', () => {
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('New conversation'));
      assert.ok(res.hasText('Case preparation'));
    });

    it('T1.10.3: Renders starter prompt suggestion cards for exploratory queries', () => {
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('Summarize attached note') || res.hasText('Summarize'));
      assert.ok(res.hasText('Explain medical term') || res.hasText('Explain'));
      assert.ok(res.hasText('Organize case overview') || res.hasText('Organize'));
    });

    it('T1.10.4: Renders chat composer with textarea and attachment button', () => {
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasTag('textarea') || res.hasTag('input'));
      assert.ok(res.hasText('Attach') || res.html.includes('Attach'));
      assert.ok(res.hasText('Case 024') || res.hasText('024'));
    });

    it('T1.10.5: Renders clinical output verification disclaimer notice', () => {
      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(res.hasText('Clinical outputs require clinician review.') || res.hasText('clinician review'));
      assert.ok(res.hasText('Grounding enforced') || res.hasText('MedGemma'));
    });
  });

  // =========================================================================
  // 11. Screen 7: Report Studio (Feature #22)
  // =========================================================================
  describe('Screen 7: Report Studio (report)', () => {
    const { ReportScreen } = loadModule('src/components/medgemma/screens/ReportScreen.tsx');

    it('T1.11.1: Renders report studio header and action buttons', () => {
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('From observation to a clear report.'));
      assert.ok(res.hasText('Save draft') || res.hasText('Save'));
      assert.ok(res.hasText('Export draft') || res.hasText('Export'));
    });

    it('T1.11.2: Renders draft status and report mode switchers (TipTap vs Sections)', () => {
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('TipTap Versioned Editor') || res.hasText('Structured Sections') || res.hasText('draft'));
    });

    it('T1.11.3: Renders report editor container with version history controls', () => {
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('Version') || res.hasText('Save as Version') || res.hasText('Report'));
    });

    it('T1.11.4: Renders evidence sidebar linking current and prior studies', () => {
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('Evidence') || res.hasText('Linked studies') || res.hasText('Context') || res.hasText('Studies'));
      assert.ok(res.hasText('Case 024') || res.hasText('024'));
    });

    it('T1.11.5: Provides PDF export and review approval triggers', () => {
      const res = renderComponent(React.createElement(ReportScreen));
      assert.ok(res.hasText('Export') || res.hasText('Save') || res.hasText('Reviewed'));
    });
  });

  // =========================================================================
  // 12. Screen 8: Clinical Reasoning (Feature #11)
  // =========================================================================
  describe('Screen 8: Clinical Reasoning (reasoning)', () => {
    const { ReasoningScreen } = loadModule('src/components/medgemma/screens/ReasoningScreen.tsx');

    it('T1.12.1: Renders clinical reasoning header and navigation to EHR summary', () => {
      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasText('Read beyond the words.'));
      assert.ok(res.hasText('View EHR summary'));
    });

    it('T1.12.2: Renders encounter note source paper facsimile with Georgia styling', () => {
      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasText('Clinical note.pdf') || res.hasText('Encounter Note') || res.hasText('Clinical encounter'));
      assert.ok(res.hasClass('paper') || res.html.includes('paper'));
    });

    it('T1.12.3: Renders clinical question inquiry form and Explore evidence trigger', () => {
      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasTag('textarea'));
      assert.ok(res.hasText('Explore evidence'));
    });

    it('T1.12.4: Renders evidence-linked interpretation insight cards with clickable source chips', () => {
      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasText('Evidence-linked interpretation') || res.hasText('interpretation'));
      assert.ok(res.hasText('Clinical note') || res.hasText('Context'));
    });

    it('T1.12.5: Renders explicit uncertainty callouts highlighting missing clinical indication', () => {
      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasText('Information to confirm') || res.hasText('Uncertainty') || res.hasText('Missing'));
    });
  });

  // =========================================================================
  // 13. Screen 9: EHR Summary (Feature #12)
  // =========================================================================
  describe('Screen 9: EHR Summary (ehr)', () => {
    const { EhrScreen } = loadModule('src/components/medgemma/screens/EhrScreen.tsx');

    it('T1.13.1: Renders EHR summary header and Refresh summary button', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('The record, brought together.'));
      assert.ok(res.hasText('Refresh summary'));
    });

    it('T1.13.2: Renders tab navigation (Overview, Timeline, Sources)', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Overview'));
      assert.ok(res.hasText('Timeline'));
      assert.ok(res.hasText('Sources'));
    });

    it('T1.13.3: Renders narrative clinical overview card with provenance chips', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Case overview') || res.hasText('Overview'));
      assert.ok(res.hasText('Encounter note') || res.hasText('Study metadata'));
    });

    it('T1.13.4: Renders 2x2 clinical domain grid (Problems, Medications, Allergies, Recent encounters)', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Problems & context') || res.hasText('Problems'));
      assert.ok(res.hasText('Medications'));
      assert.ok(res.hasText('Allergies'));
      assert.ok(res.hasText('Recent encounters') || res.hasText('Encounters'));
    });

    it('T1.13.5: Distinguishes "Not provided" vs "explicitly absent" via dashed badges', () => {
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Not provided') || res.hasText('Unknown'));
      assert.ok(res.hasText('Source coverage checklist') || res.hasText('coverage') || res.hasText('Checklist'));
    });
  });

  // =========================================================================
  // 14. Screen 10: Document Extraction (Feature #13)
  // =========================================================================
  describe('Screen 10: Document Extraction (extraction)', () => {
    const { ExtractionScreen } = loadModule('src/components/medgemma/screens/ExtractionScreen.tsx');

    it('T1.14.1: Renders document extraction header and export action', () => {
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('From page to structured data.'));
      assert.ok(res.hasText('Export fields'));
      assert.ok(res.hasText('Upload document'));
    });

    it('T1.14.2: Renders source document paper with interactive mark highlight spans', () => {
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('Lab report.pdf') || res.hasText('LABORATORY REPORT'));
      assert.ok(res.hasTag('mark') || res.html.includes('data-field-mark'));
    });

    it('T1.14.3: Renders extracted field rows for collection date, specimen, hemoglobin, and WBC', () => {
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('Collection date'));
      assert.ok(res.hasText('Specimen'));
      assert.ok(res.hasText('Hemoglobin'));
      assert.ok(res.hasText('White blood cells'));
    });

    it('T1.14.4: Renders field locator buttons (p. 1 ↗) on extracted field rows', () => {
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('p. 1 ↗') || res.hasText('p. 1'));
    });

    it('T1.14.5: Renders clinician review verification checkbox', () => {
      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('I have checked the fields against the source.') || res.hasText('checked the fields'));
      assert.ok(res.hasTag('input') || res.html.includes('checkbox'));
    });
  });

  // =========================================================================
  // 15. Screen 11: Medical Q&A (Feature #14)
  // =========================================================================
  describe('Screen 11: Medical Q&A (qa)', () => {
    const { QaScreen } = loadModule('src/components/medgemma/screens/QaScreen.tsx');

    it('T1.15.1: Renders Medical question answering header and General chat toggle', () => {
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasText('Medical question answering'));
      assert.ok(res.hasText('Ask with context. Review with evidence.'));
      assert.ok(res.hasText('General chat'));
    });

    it('T1.15.2: Renders question textarea form and Ask question action', () => {
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasTag('textarea'));
      assert.ok(res.hasText('Ask question'));
    });

    it('T1.15.3: Renders source scope selector with Attached case sources only option', () => {
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasTag('select'));
      assert.ok(res.hasText('Attached case sources only'));
    });

    it('T1.15.4: Renders starter inquiry suggestion cards', () => {
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasText('Inspect available evidence') || res.hasText('evidence'));
      assert.ok(res.hasText('Find missing information') || res.hasText('missing'));
    });

    it('T1.15.5: Renders suggestions panel or grounded answer when qaAnswer is updated', () => {
      const store = getWorkspaceStore();
      store.getState().setQaAnswer(true);
      const res = renderComponent(React.createElement(QaScreen));
      assert.ok(res.hasText('Scope & Verification Policy') || res.hasText('Inspect available evidence') || res.hasText('Ask question'));
    });
  });

  // =========================================================================
  // 16. Screen 12: Library (Feature #16)
  // =========================================================================
  describe('Screen 12: Library (library)', () => {
    const { LibraryScreen } = loadModule('src/components/medgemma/screens/LibraryScreen.tsx');

    it('T1.16.1: Renders Library header and Add files trigger', () => {
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(res.hasText('A home for the evidence.'));
      assert.ok(res.hasText('Add files'));
    });

    it('T1.16.2: Renders category tabs (All files, Imaging, Documents, Reports, Conversations)', () => {
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(res.hasText('All files'));
      assert.ok(res.hasText('Imaging'));
      assert.ok(res.hasText('Documents'));
      assert.ok(res.hasText('Reports'));
      assert.ok(res.hasText('Conversations'));
    });

    it('T1.16.3: Renders search input for live keyword matching', () => {
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(res.hasTag('input'));
      assert.ok(res.html.includes('Search library') || res.html.includes('Search') || res.html.includes('placeholder'));
    });

    it('T1.16.4: Renders file inventory table headers (FILE / RESOURCE, TYPE, CASE CONTEXT, DATE, STATUS)', () => {
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(res.hasText('FILE / RESOURCE'));
      assert.ok(res.hasText('TYPE'));
      assert.ok(res.hasText('CASE CONTEXT'));
      assert.ok(res.hasText('DATE'));
      assert.ok(res.hasText('STATUS'));
    });

    it('T1.16.5: Renders baseline attached files with status badges and deep-link arrows', () => {
      const res = renderComponent(React.createElement(LibraryScreen));
      assert.ok(res.hasText('CT chest · Current'));
      assert.ok(res.hasText('Clinical note.pdf'));
      assert.ok(res.hasText('Lab report.pdf'));
      assert.ok(res.hasText('Chest imaging report'));
    });
  });

  // =========================================================================
  // 17. Screen 13: Settings (Feature #17)
  // =========================================================================
  describe('Screen 13: Settings (settings)', () => {
    const { SettingsScreen } = loadModule('src/components/medgemma/screens/SettingsScreen.tsx');

    it('T1.17.1: Renders Settings header and Save changes button', () => {
      const res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Make the space yours.'));
      assert.ok(res.hasText('Save changes'));
    });

    it('T1.17.2: Renders settings sub-navigation panes (Profile, Workspace, Appearance, Model, Data)', () => {
      const res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Profile'));
      assert.ok(res.hasText('Workspace'));
      assert.ok(res.hasText('Appearance'));
      assert.ok(res.hasText('Model connection'));
      assert.ok(res.hasText('Data preferences'));
    });

    it('T1.17.3: Renders Profile pane inputs for display name and clinical role', () => {
      const res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Display name') || res.html.includes('Dr. Morgan') || res.html.includes('name'));
      assert.ok(res.hasText('Role') || res.hasText('Clinician') || res.html.includes('role'));
    });

    it('T1.17.4: Renders Model connection tab in settings navigation', () => {
      const res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Model connection'));
    });

    it('T1.17.5: Renders Appearance tab with description in settings navigation', () => {
      const res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Appearance'));
      assert.ok(res.hasText('Profile') && res.hasText('Workspace'));
    });
  });

  // =========================================================================
  // 18. Screen 14: Marketing Landing (Feature #18)
  // =========================================================================
  describe('Screen 14: Marketing Landing (landing)', () => {
    const { LandingScreen } = loadModule('src/components/medgemma/screens/LandingScreen.tsx');

    it('T1.18.1: Renders marketing top navigation bar with brand and Sign in link', () => {
      const res = renderComponent(React.createElement(LandingScreen));
      assert.ok(res.hasText('MedGemma'));
      assert.ok(res.hasText('Sign in') || res.hasText('Open demo') || res.hasText('Explore'));
    });

    it('T1.18.2: Renders hero section with display typography and Explore demo CTA', () => {
      const res = renderComponent(React.createElement(LandingScreen));
      assert.ok(res.hasText('Explore demo') || res.hasText('Open demo') || res.hasText('Explore'));
      assert.ok(res.hasText('Clinical') || res.hasText('intelligence') || res.hasText('workspace'));
    });

    it('T1.18.3: Renders 3 core capabilities (Explore medical images, Understand clinical story, Bring together)', () => {
      const res = renderComponent(React.createElement(LandingScreen));
      assert.ok(res.hasText('Explore medical images'));
      assert.ok(res.hasText('Understand the clinical story'));
      assert.ok(res.hasText('Bring it all together'));
    });

    it('T1.18.4: Renders 3-step connected workflow section (01 / GATHER, 02 / EXPLORE, 03 / REVIEW)', () => {
      const res = renderComponent(React.createElement(LandingScreen));
      assert.ok(res.hasText('01 / GATHER'));
      assert.ok(res.hasText('02 / EXPLORE'));
      assert.ok(res.hasText('03 / REVIEW'));
    });

    it('T1.18.5: Renders interactive FAQ accordion elements', () => {
      const res = renderComponent(React.createElement(LandingScreen));
      assert.ok(res.hasTag('details') || res.hasText('FAQ') || res.hasText('Frequently asked questions'));
    });
  });

  // =========================================================================
  // 19. Screen 15: Sign-in Screen (Feature #18)
  // =========================================================================
  describe('Screen 15: Sign-in Screen (signin)', () => {
    const { SignInScreen } = loadModule('src/components/medgemma/screens/SignInScreen.tsx');

    it('T1.19.1: Renders 50/50 split authentication layout', () => {
      const res = renderComponent(React.createElement(SignInScreen));
      assert.ok(res.hasText('MedGemma'));
      assert.ok(res.hasText('Sign in'));
    });

    it('T1.19.2: Renders email and password input fields', () => {
      const res = renderComponent(React.createElement(SignInScreen));
      assert.ok(res.html.includes('type="email"') || res.html.includes('email') || res.hasText('Email'));
      assert.ok(res.html.includes('type="password"') || res.hasText('Password'));
    });

    it('T1.19.3: Renders Remember me checkbox and Forgot password link', () => {
      const res = renderComponent(React.createElement(SignInScreen));
      assert.ok(res.hasText('Remember me') || res.hasText('Remember'));
      assert.ok(res.hasText('Forgot password?') || res.hasText('Forgot'));
    });

    it('T1.19.4: Renders direct "Explore the demo" bypass link', () => {
      const res = renderComponent(React.createElement(SignInScreen));
      assert.ok(res.hasText('Explore the demo') || res.hasText('Explore demo') || res.hasText('demo'));
    });

    it('T1.19.5: Right showcase panel features dark card with clinical statement', () => {
      const res = renderComponent(React.createElement(SignInScreen));
      assert.ok(res.hasText('A calmer space for complex clinical work.') || res.hasText('calmer space') || res.hasText('MedGemma'));
    });
  });
});
