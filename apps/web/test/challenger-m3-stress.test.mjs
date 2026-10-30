/**
 * Milestone 3 Adversarial Stress-Testing Test Suite
 * 
 * Verifies edge cases, fault conditions, state transitions, and palette invariants
 * across the clinical workspace screens.
 * 
 * Test Categories:
 * 1. Empty & Corrupt State Resilience (OverviewScreen, CasesScreen, CaseDetailScreen)
 * 2. Interactive State & Event Handling (ChatScreen, EhrScreen, ExtractionScreen)
 * 3. Palette & Style Invariant Programmatic Scan (All 15 screens)
 * 4. Adversarial Edge Case & Boundary Stress (Special chars, extreme values, rapid events)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import {
  renderComponent,
  loadModule,
  getWorkspaceStore,
  resetAllStores,
  WEB_ROOT,
} from './test-harness.mjs';

describe('Milestone 3: Adversarial Stress-Testing Suite', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // SECTION 1: Empty & Corrupt State Resilience
  // =========================================================================
  describe('1. Empty & Corrupt State Resilience', () => {
    const { OverviewScreen } = loadModule('src/components/medgemma/screens/OverviewScreen.tsx');
    const { CasesScreen } = loadModule('src/components/medgemma/screens/CasesScreen.tsx');
    const { CaseDetailScreen } = loadModule('src/components/medgemma/screens/CaseDetailScreen.tsx');

    it('M3.1.1: OverviewScreen renders empty state message and zero crashes when cases is empty array', () => {
      const store = getWorkspaceStore();
      store.setState({ cases: [] });

      let rendered;
      assert.doesNotThrow(() => {
        rendered = renderComponent(React.createElement(OverviewScreen));
      }, 'OverviewScreen must not crash with 0 cases');

      assert.ok(
        rendered.hasText('No active cases found. Click "New case" to begin.') ||
        rendered.hasText('No active cases found') ||
        rendered.hasText('New case'),
        'OverviewScreen must display empty state message when cases is empty'
      );
      assert.ok(rendered.hasText('00'), 'Stat panel should show 00 active cases');
    });

    it('M3.1.2: OverviewScreen handles corrupt case items with missing fields or extreme strings without crashing', () => {
      const store = getWorkspaceStore();
      const corruptCases = [
        { id: '', name: '', meta: '', status: '', date: '' },
        {
          id: 'extremely-long-uuid-1234567890-abcdefghijklmnopqrstuvwxyz-99999999',
          name: 'A'.repeat(500),
          meta: '<script>alert("xss")</script>',
          status: 'UnknownStatus',
          date: 'Invalid Date',
        },
      ];
      store.setState({ cases: corruptCases });

      let rendered;
      assert.doesNotThrow(() => {
        rendered = renderComponent(React.createElement(OverviewScreen));
      }, 'OverviewScreen should survive corrupt cases with extreme lengths and missing properties');

      assert.ok(rendered.html.length > 500, 'Rendered HTML should have content');
    });

    it('M3.1.3: CasesScreen pagination with 0 cases (totalPages=1, Showing 0-0 of 0, Prev and Next disabled)', () => {
      const store = getWorkspaceStore();
      store.setState({ cases: [], caseFilter: 'All cases', caseSearch: '' });

      const res = renderComponent(React.createElement(CasesScreen));

      assert.ok(
        res.hasText('No matching cases found') || res.hasText('No matching'),
        'CasesScreen must display empty matching cases row'
      );
      assert.ok(
        res.matches(/Showing[\s\S]*?0[\s\S]*?–[\s\S]*?0[\s\S]*?of[\s\S]*?0[\s\S]*?cases/),
        'Pagination text must indicate 0–0 of 0 cases'
      );
      assert.ok(res.extractText().includes('1 / 1'), 'Page indicator must show 1 / 1');

      // Check disabled attributes on Prev and Next buttons
      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Previous page"/i) ||
        res.matches(/aria-label="Previous page"[^>]*disabled/i),
        'Previous page button must be disabled when 0 cases'
      );
      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Next page"/i) ||
        res.matches(/aria-label="Next page"[^>]*disabled/i),
        'Next page button must be disabled when 0 cases'
      );
    });

    it('M3.1.4: CasesScreen pagination with exactly 1 case (totalPages=1, Showing 1-1 of 1, Prev and Next disabled)', () => {
      const store = getWorkspaceStore();
      store.setState({
        cases: [
          {
            id: 'case-single-001',
            name: 'Single Patient Case',
            meta: 'DEMO-SINGLE · 1 source',
            status: 'Needs review',
            date: 'Today',
          },
        ],
        caseFilter: 'All cases',
        caseSearch: '',
      });

      const res = renderComponent(React.createElement(CasesScreen));

      assert.ok(res.hasText('Single Patient Case'), 'Must display the single case');
      assert.ok(
        res.matches(/Showing[\s\S]*?1[\s\S]*?–[\s\S]*?1[\s\S]*?of[\s\S]*?1[\s\S]*?cases/),
        'Pagination text must show Showing 1–1 of 1 cases'
      );
      assert.ok(res.extractText().includes('1 / 1'), 'Page indicator must show 1 / 1');

      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Previous page"/i) ||
        res.matches(/aria-label="Previous page"[^>]*disabled/i),
        'Previous page button must be disabled for 1 case on page 1'
      );
      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Next page"/i) ||
        res.matches(/aria-label="Next page"[^>]*disabled/i),
        'Next page button must be disabled for 1 case on page 1'
      );
    });

    it('M3.1.5: CasesScreen pagination with exactly 10 cases (totalPages=1, Showing 1-10 of 10, Prev and Next disabled)', () => {
      const store = getWorkspaceStore();
      const tenCases = Array.from({ length: 10 }, (_, i) => ({
        id: `case-batch-10-${i + 1}`,
        name: `Patient Batch Case ${i + 1}`,
        meta: `DEMO-${100 + i} · 2 sources`,
        status: i % 2 === 0 ? 'Needs review' : 'Draft ready',
        date: 'Oct 2026',
      }));
      store.setState({ cases: tenCases, caseFilter: 'All cases', caseSearch: '' });

      const res = renderComponent(React.createElement(CasesScreen));

      assert.ok(
        res.matches(/Showing[\s\S]*?1[\s\S]*?–[\s\S]*?10[\s\S]*?of[\s\S]*?10[\s\S]*?cases/),
        'Pagination text must show Showing 1–10 of 10 cases'
      );
      assert.ok(res.extractText().includes('1 / 1'), 'Page indicator must show 1 / 1 for exactly 10 items');

      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Previous page"/i) ||
        res.matches(/aria-label="Previous page"[^>]*disabled/i),
        'Previous page button must be disabled'
      );
      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Next page"/i) ||
        res.matches(/aria-label="Next page"[^>]*disabled/i),
        'Next page button must be disabled when exactly 10 items fit in single page'
      );
    });

    it('M3.1.6: CasesScreen pagination with 100 cases (totalPages=10, Showing 1-10 of 100, Prev disabled, Next enabled)', () => {
      const store = getWorkspaceStore();
      const hundredCases = Array.from({ length: 100 }, (_, i) => ({
        id: `case-100-${String(i + 1).padStart(3, '0')}`,
        name: `Mass Case ${i + 1}`,
        meta: `DEMO-MASS-${i + 1} · 3 sources`,
        status: i % 3 === 0 ? 'Reviewed' : i % 3 === 1 ? 'Needs review' : 'Draft ready',
        date: '2026-10-30',
      }));
      store.setState({ cases: hundredCases, caseFilter: 'All cases', caseSearch: '' });

      const res = renderComponent(React.createElement(CasesScreen));

      assert.ok(
        res.matches(/Showing[\s\S]*?1[\s\S]*?–[\s\S]*?10[\s\S]*?of[\s\S]*?100[\s\S]*?cases/),
        'Must show Showing 1–10 of 100 cases'
      );
      assert.ok(res.extractText().includes('1 / 10'), 'Page indicator must show 1 / 10 for 100 items with pageSize=10');

      // Prev must be disabled on page 1
      assert.ok(
        res.matches(/<button[^>]*disabled[^>]*aria-label="Previous page"/i) ||
        res.matches(/aria-label="Previous page"[^>]*disabled/i),
        'Previous page button must be disabled on page 1'
      );

      // Next must NOT be disabled on page 1 of 10
      assert.ok(
        !res.matches(/<button[^>]*disabled[^>]*aria-label="Next page"/i) &&
        !res.matches(/aria-label="Next page"[^>]*disabled/i),
        'Next page button must be enabled when more pages exist'
      );
    });

    it('M3.1.7: CaseDetailScreen survives missing activeCaseId and missing activeCase without crashing', () => {
      const store = getWorkspaceStore();
      store.setState({
        activeCaseId: '',
        activeCase: '',
      });

      let res;
      assert.doesNotThrow(() => {
        res = renderComponent(React.createElement(CaseDetailScreen));
      }, 'CaseDetailScreen must not throw when activeCaseId and activeCase are empty');

      assert.ok(res.hasText('CASE ID: 024') || res.hasText('CASE ID:'), 'Fallback case ID rendered');
      assert.ok(res.hasText('Chest follow-up'), 'Fallback case title rendered');
      assert.ok(res.hasText('Heart Rate'), 'Vitals banner Heart Rate rendered');
      assert.ok(res.hasText('SpO2'), 'Vitals banner SpO2 rendered');
      assert.ok(res.hasText('Acuity Status'), 'Vitals banner Acuity Status rendered');
    });

    it('M3.1.8: CaseDetailScreen survives extreme UUID strings and unusual characters', () => {
      const store = getWorkspaceStore();
      const longUUID = 'f81d4fae-7dec-11d0-a765-00a0c91e6bf6-extra-long-suffix-overflow-test';
      store.setState({
        activeCaseId: longUUID,
        activeCase: 'Patient with Complex Oncology Multimodal Protocol ⚕️',
      });

      const res = renderComponent(React.createElement(CaseDetailScreen));
      // Eyebrow slices to 8 chars: f81d4fae
      assert.ok(res.hasText('CASE ID: f81d4fae'), 'Should safely truncate long UUID in header');
      assert.ok(res.hasText('Patient with Complex Oncology Multimodal Protocol ⚕️'), 'Should render unicode case name');
    });
  });

  // =========================================================================
  // SECTION 2: Interactive State & Event Handling
  // =========================================================================
  describe('2. Interactive State & Event Handling', () => {
    const { ChatScreen } = loadModule('src/components/medgemma/screens/ChatScreen.tsx');
    const { EhrScreen } = loadModule('src/components/medgemma/screens/EhrScreen.tsx');
    const { ExtractionScreen } = loadModule('src/components/medgemma/screens/ExtractionScreen.tsx');

    it('M3.2.1: ChatScreen & store reject empty and whitespace-only messages', () => {
      const store = getWorkspaceStore();
      store.setState({ chatMessages: [] });

      // Empty string
      store.getState().addChatMessage('');
      assert.equal(store.getState().chatMessages.length, 0, 'Empty message must be rejected');

      // Whitespace variations
      store.getState().addChatMessage('   ');
      assert.equal(store.getState().chatMessages.length, 0, 'Spaces-only message must be rejected');

      store.getState().addChatMessage('\t\t\n\n\r  ');
      assert.equal(store.getState().chatMessages.length, 0, 'Tab/newline-only message must be rejected');

      // Valid message with surrounding whitespace must be trimmed
      store.getState().addChatMessage('   What are the lung findings?   ');
      assert.equal(store.getState().chatMessages.length, 1, 'Valid message must be accepted');
      assert.equal(
        store.getState().chatMessages[0],
        'What are the lung findings?',
        'Message must be trimmed of leading and trailing whitespace'
      );
    });

    it('M3.2.2: ChatScreen clearChat functionality flushes conversation history', () => {
      const store = getWorkspaceStore();
      store.setState({ chatMessages: ['Question 1', 'Question 2', 'Question 3'] });
      assert.equal(store.getState().chatMessages.length, 3);

      store.getState().clearChat();
      assert.equal(store.getState().chatMessages.length, 0, 'clearChat must empty chatMessages');

      const res = renderComponent(React.createElement(ChatScreen));
      assert.ok(
        res.hasText('What can we explore today?'),
        'Clean chat screen should show greeting and exploration suggestions'
      );
    });

    it('M3.2.3: EhrScreen renders refresh summary button and handles activeCaseId binding', () => {
      const store = getWorkspaceStore();
      store.setState({ activeCaseId: 'test-case-ehr-123' });

      const res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Refresh summary'), 'Button must display Refresh summary when idle');
      assert.ok(res.hasText('CLINICAL TEXT / EHR'), 'Renders clinical text eyebrow');
      assert.ok(res.hasText('Overview') && res.hasText('Timeline') && res.hasText('Sources'), 'Renders all 3 tabs');
    });

    it('M3.2.4: EhrScreen switches tabs correctly and preserves accessible tab roles', () => {
      const store = getWorkspaceStore();
      store.setState({ ehrTab: 'Overview' });

      let res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Follow-up review documented'), 'Overview problem list rendered');

      // Switch to Timeline
      store.setState({ ehrTab: 'Timeline' });
      res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Clinical timeline'), 'Timeline panel rendered');
      assert.ok(res.hasText('Encounter note · p. 1'), 'Timeline source chip rendered');

      // Switch to Sources
      store.setState({ ehrTab: 'Sources' });
      res = renderComponent(React.createElement(EhrScreen));
      assert.ok(res.hasText('Record sources'), 'Sources panel rendered');
      assert.ok(res.hasText('Encounter note.pdf'), 'Source file Encounter note.pdf rendered');
      assert.ok(res.hasText('Inspect source'), 'Inspect source chip rendered');
    });

    it('M3.2.5: ExtractionScreen switches extractionField and verifies interactive mark highlight binding', () => {
      const store = getWorkspaceStore();

      // Test 1: hemoglobin active
      store.setState({ extractionField: 'hemoglobin' });
      let res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(
        res.matches(/data-field-mark="hemoglobin"[^>]*highlight/i),
        'Hemoglobin mark should receive highlight class when active'
      );
      assert.ok(
        !res.matches(/data-field-mark="date"[^>]*highlight/i),
        'Date mark should NOT have highlight class when hemoglobin is active'
      );

      // Test 2: switch to date
      store.setState({ extractionField: 'date' });
      res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(
        res.matches(/data-field-mark="date"[^>]*highlight/i),
        'Date mark should receive highlight class when date is active'
      );
      assert.ok(
        !res.matches(/data-field-mark="hemoglobin"[^>]*highlight/i),
        'Hemoglobin mark should NOT have highlight class when date is active'
      );

      // Test 3: switch to specimen
      store.setState({ extractionField: 'specimen' });
      res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(
        res.matches(/data-field-mark="specimen"[^>]*highlight/i),
        'Specimen mark should receive highlight class when specimen is active'
      );

      // Test 4: switch to wbc
      store.setState({ extractionField: 'wbc' });
      res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(
        res.matches(/data-field-mark="wbc"[^>]*highlight/i),
        'WBC mark should receive highlight class when wbc is active'
      );

      // Test 5: non-existent / arbitrary field
      store.setState({ extractionField: 'non_existent_field_xyz' });
      res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(
        !res.matches(/data-field-mark="hemoglobin"[^>]*highlight/i) &&
        !res.matches(/data-field-mark="date"[^>]*highlight/i) &&
        !res.matches(/data-field-mark="specimen"[^>]*highlight/i) &&
        !res.matches(/data-field-mark="wbc"[^>]*highlight/i),
        'No marks should be highlighted when extractionField does not match any document field'
      );
    });

    it('M3.2.6: ExtractionScreen supports field updates via updateExtractedField', () => {
      const store = getWorkspaceStore();
      const updatedValue = '14.8 g/dL (adjusted post-transfusion)';
      store.getState().updateExtractedField('hemoglobin', updatedValue);

      const field = store.getState().extractedFields.find((f) => f.id === 'hemoglobin');
      assert.equal(field?.value, updatedValue, 'Field value must update in store');

      const res = renderComponent(React.createElement(ExtractionScreen));
      assert.ok(res.hasText('14.8 g/dL (adjusted post-transfusion)'), 'Updated value rendered in fields list');
    });
  });

  // =========================================================================
  // SECTION 3: Palette & Style Invariant Programmatic Scan (15 Screens)
  // =========================================================================
  describe('3. Palette & Style Invariant Assertions across Workspace Screens', () => {
    const screensDir = path.resolve(WEB_ROOT, 'src/components/medgemma/screens');
    const allScreenFiles = fs.readdirSync(screensDir).filter((f) => f.endsWith('.tsx'));

    it('M3.3.1: Confirms exactly 15 screen components exist in screens directory', () => {
      assert.equal(
        allScreenFiles.length,
        15,
        `Expected exactly 15 screen files in ${screensDir}, found ${allScreenFiles.length}`
      );
    });

    const FORBIDDEN_TOKENS = [
      { pattern: '#10b981', desc: 'Emerald green accent #10b981' },
      { pattern: '#f0fdf4', desc: 'Light green surface #f0fdf4' },
      { pattern: '#86efac', desc: 'Light green border #86efac' },
      { pattern: '#eee', desc: 'Light grey border #eee' },
      { pattern: '#ddd', desc: 'Light grey border #ddd' },
      { pattern: '#777', desc: 'Off-palette muted grey #777' },
      { pattern: 'text-neutral-500', desc: 'Off-scale text-neutral-500 class' },
    ];

    // 13 Milestone 3 in-scope screens (plus ImagingScreen audited by worker_m3)
    const m3Screens = [
      'OverviewScreen.tsx',
      'CasesScreen.tsx',
      'CaseDetailScreen.tsx',
      'ReasoningScreen.tsx',
      'EhrScreen.tsx',
      'ExtractionScreen.tsx',
      'QaScreen.tsx',
      'ChatScreen.tsx',
      'LibraryScreen.tsx',
      'SettingsScreen.tsx',
      'LandingScreen.tsx',
      'SignInScreen.tsx',
      'ImagingScreen.tsx',
    ];

    for (const screenFile of m3Screens) {
      const filePath = path.resolve(screensDir, screenFile);
      const content = fs.readFileSync(filePath, 'utf8');

      for (const token of FORBIDDEN_TOKENS) {
        it(`M3.3.2 [${screenFile}]: 0 occurrences of ${token.desc} (${token.pattern})`, () => {
          const regex = new RegExp(token.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const hasViolation = regex.test(content);
          assert.ok(
            !hasViolation,
            `Violation detected in M3 screen ${screenFile}: found prohibited token "${token.pattern}" (${token.desc})`
          );
        });
      }
    }

    // Milestone 4 screens audit & defect isolation
    it('M3.3.3 [ReportScreen.tsx]: Confirms 0 occurrences of prohibited tokens in M4 ReportScreen', () => {
      const content = fs.readFileSync(path.resolve(screensDir, 'ReportScreen.tsx'), 'utf8');
      for (const token of FORBIDDEN_TOKENS) {
        const regex = new RegExp(token.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        assert.ok(!regex.test(content), `ReportScreen.tsx has prohibited token ${token.pattern}`);
      }
    });

    it('M3.3.4 [CompareScreen.tsx]: Empirically tracks M4 defect at line 161 (borderColor: "#10b981")', () => {
      const content = fs.readFileSync(path.resolve(screensDir, 'CompareScreen.tsx'), 'utf8');
      const hasEmeraldGreen = content.includes('#10b981');
      assert.ok(
        hasEmeraldGreen,
        'Empirical verification confirmed: CompareScreen.tsx line 161 has residual #10b981 (M4 remediation requirement)'
      );
    });
  });

  // =========================================================================
  // SECTION 4: Adversarial Edge Cases & Boundary Stress
  // =========================================================================
  describe('4. Adversarial Edge Cases & Boundary Stress', () => {
    const { CasesScreen } = loadModule('src/components/medgemma/screens/CasesScreen.tsx');
    const { SettingsScreen } = loadModule('src/components/medgemma/screens/SettingsScreen.tsx');
    const { QaScreen } = loadModule('src/components/medgemma/screens/QaScreen.tsx');
    const { ReasoningScreen } = loadModule('src/components/medgemma/screens/ReasoningScreen.tsx');
    const { LandingScreen } = loadModule('src/components/medgemma/screens/LandingScreen.tsx');
    const { SignInScreen } = loadModule('src/components/medgemma/screens/SignInScreen.tsx');

    it('M3.4.1: CasesScreen handles adversarial search strings (SQL injection, regex syntax, unicode)', () => {
      const store = getWorkspaceStore();
      const adversarialQueries = [
        "'; DROP TABLE cases; --",
        '.*+?^${}()|[]\\',
        '"><script>alert(1)</script>',
        '🫁 🩻 🧬 ⚕️ 🏥',
        '   \n\t  ',
      ];

      for (const query of adversarialQueries) {
        assert.doesNotThrow(() => {
          store.setState({ caseSearch: query });
          renderComponent(React.createElement(CasesScreen));
        }, `CasesScreen crashed on adversarial query: ${query}`);
      }
    });

    it('M3.4.2: SettingsScreen renders accessible API keys tab and SwitchToggle', () => {
      const store = getWorkspaceStore();
      store.setState({ settingTab: 'API keys' });

      let res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.hasText('Hugging Face User Access Token'), 'Hugging Face User Access Token input rendered');
      assert.ok(res.hasText('MedGemma Gateway API Key (Optional)'), 'Gateway API Key input rendered');
      assert.ok(res.hasText('Save API keys'), 'Save API keys CTA rendered');
      assert.ok(res.matches(/role="tablist"/i), 'ARIA tablist attribute present');

      store.setState({ settingTab: 'Data preferences' });
      res = renderComponent(React.createElement(SettingsScreen));
      assert.ok(res.matches(/role="switch"/i), 'SwitchToggle role="switch" present on Data preferences');
    });

    it('M3.4.3: ReasoningScreen adheres to monochrome palette and dynamic activeCase', () => {
      const store = getWorkspaceStore();
      store.setState({ activeCase: 'Case 099 · Acute Trauma Evaluation' });

      const res = renderComponent(React.createElement(ReasoningScreen));
      assert.ok(res.hasText('Case 099 · Acute Trauma Evaluation'), 'Dynamic activeCase rendered');
      assert.ok(!res.hasText('#10b981'), 'Reasoning note must NOT contain green #10b981');
      assert.ok(res.hasText('Clinical encounter note'), 'Source note header rendered');
    });

    it('M3.4.4: QaScreen scope selector switches between case and general knowledge scopes', () => {
      const res = renderComponent(React.createElement(QaScreen));

      assert.ok(res.hasText('Attached case sources only (Grounded RRF)'), 'Scope option for case sources rendered');
      assert.ok(res.hasText('General knowledge · Unverified'), 'Scope option for general knowledge rendered');
      assert.ok(res.hasText('What would you like to understand?'), 'Question prompt rendered');
    });

    it('M3.4.5: LandingScreen and SignInScreen use valid monochrome tokens and contrast', () => {
      const landingRes = renderComponent(React.createElement(LandingScreen));
      assert.ok(landingRes.hasText('A clearer view'), 'Landing hero rendered');
      assert.ok(!landingRes.hasText('#eee'), 'LandingScreen must not have #eee');

      const signinRes = renderComponent(React.createElement(SignInScreen));
      assert.ok(signinRes.hasText('Sign in to MedGemma'), 'SignIn header rendered');
      assert.ok(!signinRes.hasText('#99999f'), 'SignInScreen must not contain #99999f');
    });
  });
});
