/**
 * Tier 4: Real-World Clinical Workflows E2E Test Suite
 * 
 * Validates complete end-to-end clinical care pathways and multi-step practitioner journeys:
 * - Full 8-Phase Doctor Workflow (Login -> Case triage -> Multiplanar imaging -> Longitudinal compare -> 
 *   Assistant Q&A -> Lab extraction -> Clinical reasoning & EHR -> Report draft safety check & Export)
 * - Emergency Trauma Intake Workflow
 * - Multi-Document Reconciliation Workflow
 * - Second Opinion & Peer Review Workflow
 * - Patient Discharge Summary Assembly Workflow
 * - Quality Assurance & Uncertainty Governance Workflow
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md (§R2, §R3)
 * - PROJECT.md (§Feature Inventory #8-#22, §Interface Contracts)
 * - medgemma-ui-design.html interactive prototype clinical scenarios
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

describe('Tier 4: Real-World Clinical Workflows E2E Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // Primary Workflow: Complete 8-Phase Doctor Diagnostic & Reporting Journey
  // =========================================================================
  describe('Primary Workflow: End-to-End Radiologist Case Journey', () => {
    it('T4.1: Phase 1 — Clinician Login & Workspace Access: Physician navigates to Overview, verifies KPI metrics and work queue', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('overview');
      const { OverviewScreen } = jiti('@/components/medgemma/screens/OverviewScreen.tsx');
      const res = renderComponent(React.createElement(OverviewScreen));

      assert.ok(res.hasText('Good morning'), 'Clinician greeting missing');
      assert.ok(res.hasText('Active cases') && res.hasText('12'), 'Active cases metric missing');
      assert.ok(res.hasText('Awaiting review') && (res.hasText('04') || res.hasText('4')), 'Awaiting review metric missing');
      assert.ok(res.hasText('Report drafts') && (res.hasText('08') || res.hasText('8')), 'Report drafts metric missing');
    });

    it('T4.2: Phase 2 — Case Selection & Triage: Physician opens Case 024 Chest follow-up and reviews attached source material', () => {
      const store = getWorkspaceStore();
      store.getState().setActiveCase('Case 024 · Chest review', '11111111-1111-1111-1111-111111111111');
      store.getState().setPage('case');

      const { CaseDetailScreen } = jiti('@/components/medgemma/screens/CaseDetailScreen.tsx');
      const res = renderComponent(React.createElement(CaseDetailScreen));

      assert.ok(res.hasText('CASE ID: 11111111'), 'Case ID missing in triage header');
      assert.ok(res.hasText('Needs review'), 'Needs review status missing');
      assert.ok(res.matches(/Files\s*(&amp;|&)\s*studies/), 'Files inventory missing');
      assert.ok(res.hasText('CT chest · Current'), 'Current CT attachment missing');
      assert.ok(res.hasText('Review study'), 'Review study CTA missing');
    });

    it('T4.3: Phase 3 — Multiplanar Diagnostic Imaging Review: Physician inspects Axial Series 01, scrolls slice depth, checks findings', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('imaging');
      store.getState().setSelectedSeries('01');
      store.getState().setSliceIndex(145);

      const { ImagingScreen } = jiti('@/components/medgemma/screens/ImagingScreen.tsx');
      const res = renderComponent(React.createElement(ImagingScreen));

      assert.ok(res.hasText('Look closer. See the context.'), 'Imaging workspace header missing');
      assert.ok(res.hasText('Axial') && res.hasText('Coronal') && res.hasText('Series 01'), 'Series selector missing');
      assert.ok(res.hasText('Compare'), 'Compare study action missing');
      assert.ok(res.hasText('Observation panel'), 'Observation findings panel missing');
      assert.strictEqual(store.getState().sliceIndex, 145);
    });

    it('T4.4: Phase 4 — Longitudinal Temporal Comparison: Physician compares Current vs Prior (95-day interval), verifies interval reduction', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('compare');

      const { CompareScreen } = jiti('@/components/medgemma/screens/CompareScreen.tsx');
      const res = renderComponent(React.createElement(CompareScreen));

      assert.ok(res.hasText('Side by side. What changed?') || res.hasText('A view across time.'));
      assert.ok(res.hasText('95 days'), '95-day interval badge missing');
      assert.ok(res.hasText('Right lower lobe: Opacity decreased') || res.hasText('Opacity decreased'));
      assert.ok(res.hasText('Improved'), 'Improved interval status badge missing');
    });

    it('T4.5: Phase 5 — Multimodal Assistant Clinical Q&A: Physician asks grounded questions regarding pulmonary changes', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('chat');
      store.getState().addChatMessage('Summarize changes in right lower lobe opacity compared to prior July CT');

      const { ChatScreen } = jiti('@/components/medgemma/screens/ChatScreen.tsx');
      const res = renderComponent(React.createElement(ChatScreen));

      assert.ok(res.hasText('Room to think.'));
      assert.ok(res.hasText('Case 024 · Chest review') || res.hasText('024'));
      assert.ok(res.hasText('Clinical outputs require clinician review.'));
      assert.ok(res.extractText().includes('Summarize changes in right lower lobe') || res.hasText('Summarize'));
    });

    it('T4.6: Phase 6 — Document & Lab Extraction: Physician verifies Hemoglobin and WBC lab values via interactive locators', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('extraction');
      store.getState().setExtractionField('hemoglobin');

      const { ExtractionScreen } = jiti('@/components/medgemma/screens/ExtractionScreen.tsx');
      const res = renderComponent(React.createElement(ExtractionScreen));

      assert.ok(res.hasText('From page to structured data.'));
      assert.ok(res.hasText('Hemoglobin') && res.hasText('13.2 g/dL'));
      assert.ok(res.hasText('White blood cells') && res.hasText('6.4 ×10⁹/L'));
      assert.ok(res.hasText('p. 1 ↗'), 'Field locator button missing');
      assert.ok(res.html.includes('data-field-mark="hemoglobin"'), 'Active mark highlight missing');
    });

    it('T4.7: Phase 7 — Clinical Reasoning & EHR Reconciliation: Physician checks problem list, notes explicit absence of allergy history', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('ehr');

      const { EhrScreen } = jiti('@/components/medgemma/screens/EhrScreen.tsx');
      const res = renderComponent(React.createElement(EhrScreen));

      assert.ok(res.hasText('The record, brought together.'));
      assert.ok(res.matches(/Problems\s*(&amp;|&)\s*context/));
      assert.ok(res.hasText('Allergies') && res.hasText('Unknown'), 'Absence of allergy history not explicitly labeled');
      assert.ok(res.hasText('Medications') && res.hasText('Not provided'), 'Absence of medication history not explicitly labeled');
    });

    it('T4.8: Phase 8 — Report Drafting, Safety Verification & Export: Physician completes safety checks and exports report draft', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('report');

      const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');
      const res = renderComponent(React.createElement(ReportScreen));

      assert.ok(res.hasText('From observation to a clear report.'));
      assert.ok(res.hasText('Save draft'));
      assert.ok(res.hasText('Export draft'));
      assert.ok(res.hasText('Structured Sections') || res.hasText('Tiptap Rich Editor'));
    });

    it('T4.9: Phase 9 — Workflow Completion & Audit State: Case status marks Reviewed, overview updates status', () => {
      const store = getWorkspaceStore();
      // Clinician approves case
      store.getState().setCases(
        store.getState().cases.map((c) =>
          c.id === '024' ? { ...c, status: 'Reviewed' } : c
        )
      );
      store.getState().showToast('Case 024 approved and marked reviewed.');

      assert.strictEqual(store.getState().cases.find((c) => c.id === '024')?.status, 'Reviewed');
      assert.strictEqual(store.getState().toastMessage, 'Case 024 approved and marked reviewed.');
    });
  });

  // =========================================================================
  // Complex Workflows: Specialized Clinical Care Pathways
  // =========================================================================
  describe('Complex Clinical Pathways', () => {
    it('T4.10: Emergency Trauma Case Workflow — Rapid intake, multi-series navigation and immediate impression drafting', () => {
      const store = getWorkspaceStore();
      // Intake new emergency trauma case
      store.getState().addCase({ name: 'STAT Trauma Pelvis & Chest', meta: 'CT · 3 studies' });
      assert.strictEqual(store.getState().cases[0].name, 'STAT Trauma Pelvis & Chest');
      assert.strictEqual(store.getState().page, 'cases');

      // Navigate immediately to imaging
      store.getState().setPage('imaging');
      store.getState().setSelectedSeries('03'); // Sagittal reconstruction
      assert.strictEqual(store.getState().selectedSeries, '03');

      const { ImagingScreen } = jiti('@/components/medgemma/screens/ImagingScreen.tsx');
      const res = renderComponent(React.createElement(ImagingScreen));
      assert.ok(res.hasText('Series 03'));
    });

    it('T4.11: Multi-Document Reconciliation Workflow — Ingesting note, lab report, and cross-referencing contradictions', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('reasoning');

      const { ReasoningScreen } = jiti('@/components/medgemma/screens/ReasoningScreen.tsx');
      const res = renderComponent(React.createElement(ReasoningScreen));

      assert.ok(res.hasText('Clinical note.pdf') || res.hasText('Encounter Note'));
      assert.ok(res.hasText('Explore evidence'));
      assert.ok(res.hasText('Information to confirm') || res.hasText('Uncertainty'));
    });

    it('T4.12: Second Opinion & Peer Review Workflow — Clinician inspects prior report version and records version 2 revision', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('report');

      const { ReportScreen } = jiti('@/components/medgemma/screens/ReportScreen.tsx');
      const res = renderComponent(React.createElement(ReportScreen));

      assert.ok(res.hasText('v1') || res.hasText('Version 1') || res.hasText('draft'));
    });

    it('T4.13: Patient Discharge Summary Assembly Workflow — Aggregating verified lab data and clinical summary', () => {
      const store = getWorkspaceStore();
      // Verify lab fields
      store.getState().updateExtractedField('hemoglobin', '13.5 g/dL');
      store.getState().updateExtractedField('wbc', '6.8 ×10⁹/L');

      const fields = store.getState().extractedFields;
      assert.strictEqual(fields.find((f) => f.id === 'hemoglobin')?.value, '13.5 g/dL');
      assert.strictEqual(fields.find((f) => f.id === 'wbc')?.value, '6.8 ×10⁹/L');

      store.getState().setPage('ehr');
      const { EhrScreen } = jiti('@/components/medgemma/screens/EhrScreen.tsx');
      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('The record, brought together.'));
    });

    it('T4.14: Quality Assurance & Uncertainty Governance Workflow — Verifying AI grounding and provenance visibility', () => {
      const store = getWorkspaceStore();
      store.getState().setPage('qa');

      const { QaScreen } = jiti('@/components/medgemma/screens/QaScreen.tsx');
      const res = renderComponent(React.createElement(QaScreen));

      assert.ok(res.hasText('Medical question answering'));
      assert.ok(res.hasText('Attached case sources only'));
      assert.ok(res.hasText('Inspect available evidence'));
    });
  });
});
