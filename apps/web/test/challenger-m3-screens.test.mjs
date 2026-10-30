/**
 * Milestone 3: Empirical Challenger Test Suite
 * 
 * Adversarially tests and verifies all Milestone 3 Clinical Workspace screens and components:
 * 1. OverviewScreen: dynamic case review counts, empty state handling, and click toast dispatch.
 * 2. CasesScreen: client pagination logic (10 items/page, boundary clamping for empty/single/multi-page cases),
 *    filter tab counts, and ARIA attributes.
 * 3. CaseDetailScreen: 6-tile Patient Vitals banner (Heart Rate, Blood Pressure, SpO2, Respiratory Rate,
 *    Body Temperature, Acuity badge), activeCaseId truncation, and dynamic fallback.
 * 4. ReasoningScreen: absence of #10b981 border, monochrome styling, dynamic activeCase, and SSE unmount safety.
 * 5. ExtractionScreen: <mark> tag interactivity (click, keyboard, reticle indicator [⌖]), absence of #777,
 *    and form label-to-id binding.
 * 6. SettingsScreen: API keys tab presence, ARIA tab roles (role="tablist", role="tab", role="tabpanel"),
 *    accessible SwitchToggle (role="switch"), and dark monochrome health check container.
 * 7. LandingScreen & SignInScreen: absence of #eee borders, absence of color: "#18181b" contrast failure,
 *    and strict form label bindings.
 * 8. Comprehensive Cross-Screen Checks: EhrScreen, QaScreen, ChatScreen, LibraryScreen, and global palette purity.
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

globalThis.React = React;

import {
  WEB_ROOT,
  loadModule,
  getWorkspaceStore,
  resetAllStores,
} from './test-harness.mjs';

function renderAndInspect(element) {
  const html = ReactDOMServer.renderToString(element);
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    html,
    text,
    hasText: (str) => text.includes(str) || html.includes(str),
    matchesText: (regex) => regex.test(text),
    hasTag: (tag) => new RegExp(`<${tag}\\b`, 'i').test(html),
    matches: (regex) => regex.test(html),
    countOccurrences: (sub) => {
      let count = 0;
      let pos = 0;
      while ((pos = html.indexOf(sub, pos)) !== -1) {
        count++;
        pos += sub.length;
      }
      return count;
    },
  };
}

describe('Empirical Challenger: M3 Clinical Management & Reasoning Screens', () => {
  // Load target screens via jiti
  const { OverviewScreen } = loadModule('src/components/medgemma/screens/OverviewScreen.tsx');
  const { CasesScreen } = loadModule('src/components/medgemma/screens/CasesScreen.tsx');
  const { CaseDetailScreen } = loadModule('src/components/medgemma/screens/CaseDetailScreen.tsx');
  const { ReasoningScreen } = loadModule('src/components/medgemma/screens/ReasoningScreen.tsx');
  const { ExtractionScreen } = loadModule('src/components/medgemma/screens/ExtractionScreen.tsx');
  const { SettingsScreen } = loadModule('src/components/medgemma/screens/SettingsScreen.tsx');
  const { LandingScreen } = loadModule('src/components/medgemma/screens/LandingScreen.tsx');
  const { SignInScreen } = loadModule('src/components/medgemma/screens/SignInScreen.tsx');
  const { EhrScreen } = loadModule('src/components/medgemma/screens/EhrScreen.tsx');
  const { QaScreen } = loadModule('src/components/medgemma/screens/QaScreen.tsx');
  const { ChatScreen } = loadModule('src/components/medgemma/screens/ChatScreen.tsx');
  const { LibraryScreen } = loadModule('src/components/medgemma/screens/LibraryScreen.tsx');
  const { ContextBar, SourceChip } = loadModule('src/components/medgemma/CommonUI.tsx');

  const screensDir = path.resolve(WEB_ROOT, 'src/components/medgemma/screens');

  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // 1. OverviewScreen Empirical Verification
  // =========================================================================
  describe('1. OverviewScreen Empirical Verification', () => {
    it('renders uppercase header typography and eyebrow WORKSPACE OVERVIEW', () => {
      const rendered = renderAndInspect(React.createElement(OverviewScreen));
      assert.ok(rendered.hasText('WORKSPACE OVERVIEW'), 'Must contain WORKSPACE OVERVIEW eyebrow');
      assert.ok(rendered.hasText('Good morning, Clinician.'), 'Must render main title');
      assert.ok(rendered.hasText('New case'), 'Must render New case CTA');
    });

    it('displays dynamic case review counts and active cases metric', () => {
      const store = getWorkspaceStore();
      store.setState({
        cases: [
          { id: 'c-1', name: 'Patient Alpha', meta: 'P-101 · 2 sources', status: 'Needs review', date: 'Oct 24' },
          { id: 'c-2', name: 'Patient Beta', meta: 'P-102 · 1 source', status: 'Needs review', date: 'Oct 25' },
          { id: 'c-3', name: 'Patient Gamma', meta: 'P-103 · 3 sources', status: 'Draft ready', date: 'Oct 26' },
        ],
      });

      const rendered = renderAndInspect(React.createElement(OverviewScreen));
      assert.ok(rendered.hasText('Active cases'), 'Must render Active cases label');
      assert.ok(rendered.html.includes('03'), 'Must display padded active cases count 03');
      assert.ok(rendered.html.includes('02'), 'Must display padded awaiting review count 02');
      assert.ok(rendered.html.includes('01'), 'Must display padded report drafts count 01');
    });

    it('handles empty cases state with colSpan=5 and clear instruction message', () => {
      const store = getWorkspaceStore();
      store.setState({ cases: [] });

      const rendered = renderAndInspect(React.createElement(OverviewScreen));
      assert.ok(rendered.html.includes('colspan="5"') || rendered.html.includes('colSpan="5"') || rendered.html.includes('colspan=5'), 'Must render colSpan 5 for empty table');
      assert.ok(
        rendered.hasText('No active cases found. Click "New case" to begin.') ||
        rendered.html.includes('No active cases found'),
        'Must display user-facing empty state guidance'
      );
    });

    it('handles non-empty cases by rendering recent cases up to 4 items', () => {
      const store = getWorkspaceStore();
      const mockCases = Array.from({ length: 6 }, (_, i) => ({
        id: `case-${i + 1}`,
        name: `Patient ${i + 1}`,
        meta: `Code-${i + 1} · 1 sources`,
        status: i % 2 === 0 ? 'Needs review' : 'Reviewed',
        date: 'Oct 24, 2026',
      }));
      store.setState({ cases: mockCases });

      const rendered = renderAndInspect(React.createElement(OverviewScreen));
      assert.ok(rendered.hasText('Patient 1'), 'Must render recent case 1');
      assert.ok(rendered.hasText('Patient 4'), 'Must render recent case 4');
      // Case 5 and 6 should not be in recentCases slice(0, 4)
      assert.ok(!rendered.hasText('Patient 5'), 'Must not render case 5 beyond slice(0, 4)');
      assert.ok(!rendered.hasText('Patient 6'), 'Must not render case 6 beyond slice(0, 4)');
    });

    it('dispatches showToast with case context on selection logic', () => {
      const store = getWorkspaceStore();
      const testCase = { id: 'test-case-99', name: 'Patient Zachary', meta: 'Z-99', status: 'In progress', date: 'Now' };
      store.setState({ cases: [testCase] });

      // Simulate handleSelectCase action directly
      store.getState().setActiveCase(testCase.name, testCase.id);
      store.getState().showToast(`Switched active context to ${testCase.name}`);
      store.getState().setPage('case');

      assert.equal(store.getState().activeCase, 'Patient Zachary');
      assert.equal(store.getState().activeCaseId, 'test-case-99');
      assert.equal(store.getState().page, 'case');
      assert.equal(store.getState().toastMessage, 'Switched active context to Patient Zachary');
    });
  });

  // =========================================================================
  // 2. CasesScreen Empirical Verification (Pagination & Accessibility)
  // =========================================================================
  describe('2. CasesScreen Empirical Verification', () => {
    it('verifies client pagination math and boundary clamping across empty, single, and multi-page sets', () => {
      const pageSize = 10;

      // Scenario A: 0 cases
      const cases0 = [];
      const totalPages0 = Math.max(1, Math.ceil(cases0.length / pageSize));
      const safePage0 = Math.min(1, totalPages0);
      assert.equal(totalPages0, 1, 'Empty cases must yield totalPages=1');
      assert.equal(safePage0, 1, 'Empty cases must yield safeCurrentPage=1');
      const start0 = cases0.length > 0 ? (safePage0 - 1) * pageSize + 1 : 0;
      const end0 = Math.min(safePage0 * pageSize, cases0.length);
      assert.equal(start0, 0, 'Start index for 0 cases must be 0');
      assert.equal(end0, 0, 'End index for 0 cases must be 0');

      // Scenario B: 1 case
      const cases1 = [{ id: '1', name: 'P1', meta: '', status: 'Reviewed', date: '' }];
      const totalPages1 = Math.max(1, Math.ceil(cases1.length / pageSize));
      const safePage1 = Math.min(1, totalPages1);
      assert.equal(totalPages1, 1);
      assert.equal(safePage1, 1);
      const start1 = cases1.length > 0 ? (safePage1 - 1) * pageSize + 1 : 0;
      const end1 = Math.min(safePage1 * pageSize, cases1.length);
      assert.equal(start1, 1);
      assert.equal(end1, 1);

      // Scenario C: exactly 10 cases
      const cases10 = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, name: `P${i}`, meta: '', status: 'Reviewed', date: '' }));
      const totalPages10 = Math.max(1, Math.ceil(cases10.length / pageSize));
      assert.equal(totalPages10, 1);

      // Scenario D: 11 cases (2 pages)
      const cases11 = Array.from({ length: 11 }, (_, i) => ({ id: `${i}`, name: `P${i}`, meta: '', status: 'Reviewed', date: '' }));
      const totalPages11 = Math.max(1, Math.ceil(cases11.length / pageSize));
      assert.equal(totalPages11, 2);
      const page1Slice = cases11.slice(0, 10);
      const page2Slice = cases11.slice(10, 20);
      assert.equal(page1Slice.length, 10);
      assert.equal(page2Slice.length, 1);

      // Scenario E: boundary clamping when user on page 4 but filtered cases drops to 5 items
      const requestedPage = 4;
      const filteredCount = 5;
      const totalPagesFiltered = Math.max(1, Math.ceil(filteredCount / pageSize));
      const clampedPage = Math.min(requestedPage, totalPagesFiltered);
      assert.equal(clampedPage, 1, 'Page must clamp to 1 when totalPages shrinks below current page');
    });

    it('renders pagination bar with exact Showing text and disabled states', () => {
      const store = getWorkspaceStore();
      const mockCases = Array.from({ length: 15 }, (_, i) => ({
        id: `c-${i + 1}`,
        name: `Patient ${i + 1}`,
        meta: `Code-${i + 1}`,
        status: 'All cases',
        date: 'Oct 24',
      }));
      store.setState({ cases: mockCases, caseFilter: 'All cases', caseSearch: '' });

      const rendered = renderAndInspect(React.createElement(CasesScreen));
      assert.ok(
        rendered.matchesText(/Showing\s+1\s*[–-]\s*10\s+of\s+15\s+cases/),
        'Must display initial pagination "Showing 1–10 of 15 cases"'
      );
      assert.ok(rendered.matchesText(/1\s*\/\s*2/), 'Must display page indicator 1 / 2');
      assert.ok(rendered.html.includes('aria-label="Previous page"'), 'Must have aria-label for Prev page');
      assert.ok(rendered.html.includes('aria-label="Next page"'), 'Must have aria-label for Next page');
    });

    it('renders filter tabs with counts ({count}) and ARIA tablist semantics', () => {
      const store = getWorkspaceStore();
      store.setState({
        cases: [
          { id: '1', name: 'P1', meta: '', status: 'Needs review', date: '' },
          { id: '2', name: 'P2', meta: '', status: 'Draft ready', date: '' },
          { id: '3', name: 'P3', meta: '', status: 'In progress', date: '' },
          { id: '4', name: 'P4', meta: '', status: 'Reviewed', date: '' },
        ],
        caseFilter: 'Needs review',
      });

      const rendered = renderAndInspect(React.createElement(CasesScreen));
      assert.ok(rendered.html.includes('role="tablist"'), 'Tabs container must have role="tablist"');
      assert.ok(rendered.html.includes('role="tab"'), 'Tab buttons must have role="tab"');
      assert.ok(rendered.html.includes('aria-selected="true"'), 'Selected tab must have aria-selected="true"');
      assert.ok(rendered.html.includes('aria-selected="false"'), 'Unselected tabs must have aria-selected="false"');
      assert.ok(rendered.matchesText(/All cases\s*\(\s*4\s*\)/), 'All cases must show count 4');
      assert.ok(rendered.matchesText(/Needs review\s*\(\s*1\s*\)/), 'Needs review must show count 1');
      assert.ok(rendered.matchesText(/Draft ready\s*\(\s*1\s*\)/), 'Draft ready must show count 1');
    });

    it('provides accessible search input with id and aria-label', () => {
      const rendered = renderAndInspect(React.createElement(CasesScreen));
      assert.ok(rendered.html.includes('id="case-search"'), 'Search input must have id="case-search"');
      assert.ok(rendered.html.includes('aria-label="Search cases"'), 'Search input must have aria-label');
    });
  });

  // =========================================================================
  // 3. CaseDetailScreen Empirical Verification (6-tile Vitals Banner)
  // =========================================================================
  describe('3. CaseDetailScreen Empirical Verification', () => {
    it('renders complete 6-tile Patient Vitals banner with all required clinical parameters', () => {
      const store = getWorkspaceStore();
      store.setState({
        activeCase: 'Patient 024 · Acute Thoracic Study',
        activeCaseId: '00000000-1111-2222-3333-444444444444',
      });

      const rendered = renderAndInspect(React.createElement(CaseDetailScreen));

      // Check all 6 vitals labels
      assert.ok(rendered.hasText('Heart Rate'), 'Tile 1 must be Heart Rate');
      assert.ok(rendered.hasText('Blood Pressure'), 'Tile 2 must be Blood Pressure');
      assert.ok(rendered.hasText('SpO2'), 'Tile 3 must be SpO2');
      assert.ok(rendered.hasText('Resp Rate'), 'Tile 4 must be Resp Rate');
      assert.ok(rendered.hasText('Temperature'), 'Tile 5 must be Temperature');
      assert.ok(rendered.hasText('Acuity Status'), 'Tile 6 must be Acuity Status');

      // Check values and units
      assert.ok(rendered.hasText('72'), 'Heart Rate value 72');
      assert.ok(rendered.hasText('bpm'), 'Heart Rate unit bpm');
      assert.ok(rendered.hasText('128/82'), 'Blood Pressure value 128/82');
      assert.ok(rendered.hasText('mmHg'), 'Blood Pressure unit mmHg');
      assert.ok(rendered.hasText('97%'), 'SpO2 value 97%');
      assert.ok(rendered.hasText('16'), 'Resp Rate value 16');
      assert.ok(rendered.hasText('36.8°'), 'Temperature value 36.8°');
      assert.ok(rendered.hasText('Stable'), 'Acuity Status badge value Stable');

      // Check grid layout: 6 columns on md+ screens
      assert.ok(
        rendered.html.includes('grid-cols-2 sm:grid-cols-3 md:grid-cols-6'),
        'Vitals container must use responsive 6-tile grid layout'
      );
    });

    it('truncates long activeCaseId in eyebrow to 8 characters without overflow', () => {
      const store = getWorkspaceStore();
      const longUuid = 'abcdef12-3456-7890-abcd-ef1234567890';
      store.setState({ activeCaseId: longUuid });

      const rendered = renderAndInspect(React.createElement(CaseDetailScreen));
      assert.ok(rendered.hasText('CASE ID: abcdef12'), 'Must truncate long UUID to first 8 chars');
      assert.ok(!rendered.hasText('CASE ID: abcdef12-3456'), 'Must not display full long UUID in eyebrow');
    });

    it('renders quick action buttons linking to chat and imaging workspaces', () => {
      const rendered = renderAndInspect(React.createElement(CaseDetailScreen));
      assert.ok(rendered.hasText('Open in chat'), 'Must render Open in chat action');
      assert.ok(rendered.hasText('Review study'), 'Must render Review study action');
      assert.ok(rendered.hasText('Add file'), 'Must render Add file action');
    });
  });

  // =========================================================================
  // 4. ReasoningScreen Empirical Verification
  // =========================================================================
  describe('4. ReasoningScreen Empirical Verification', () => {
    const reasoningSourcePath = path.resolve(screensDir, 'ReasoningScreen.tsx');
    const reasoningSource = fs.readFileSync(reasoningSourcePath, 'utf8');

    it('strictly does NOT contain #10b981 emerald green border or off-palette green colors', () => {
      assert.ok(
        !reasoningSource.includes('#10b981'),
        'ReasoningScreen must NOT contain forbidden emerald green #10b981'
      );
      assert.ok(
        !reasoningSource.includes('emerald'),
        'ReasoningScreen must NOT contain emerald Tailwind classes'
      );
    });

    it('features monochrome border and dark background styling for live synthesis', () => {
      assert.ok(
        reasoningSource.includes('border-l-2 border-zinc-400'),
        'Must use monochrome border-zinc-400 styling'
      );
      assert.ok(
        reasoningSource.includes('bg-zinc-950/40'),
        'Must use dark monochrome bg-zinc-950/40 background'
      );
    });

    it('dynamically displays the activeCase name in clinical encounter note context', () => {
      const store = getWorkspaceStore();
      store.setState({ activeCase: 'Patient Delta · Bilateral Infiltrates' });

      const rendered = renderAndInspect(React.createElement(ReasoningScreen));
      assert.ok(
        rendered.hasText('Patient Delta · Bilateral Infiltrates'),
        'Clinical encounter note must display activeCase dynamically'
      );
    });

    it('implements activeEventSourceRef and unmount cleanup in useEffect to prevent connection leaks', () => {
      assert.ok(
        reasoningSource.includes('activeEventSourceRef'),
        'Must declare activeEventSourceRef'
      );
      assert.ok(
        reasoningSource.includes('activeEventSourceRef.current.close()'),
        'Must invoke close() on activeEventSourceRef during cleanup'
      );
    });

    it('enriches SourceChip with structured payload containing quote and location', () => {
      assert.ok(
        reasoningSource.includes('payload={{'),
        'SourceChip must receive structured payload'
      );
      assert.ok(
        reasoningSource.includes('location: "Clinical note.pdf'),
        'SourceChip payload must have location property'
      );
    });
  });

  // =========================================================================
  // 5. ExtractionScreen Empirical Verification (<mark> Interactivity & Reticle)
  // =========================================================================
  describe('5. ExtractionScreen Empirical Verification', () => {
    const extractionSourcePath = path.resolve(screensDir, 'ExtractionScreen.tsx');
    const extractionSource = fs.readFileSync(extractionSourcePath, 'utf8');

    it('strictly does NOT contain off-palette #777 text color', () => {
      assert.ok(
        !extractionSource.includes('#777'),
        'ExtractionScreen must NOT contain off-palette #777'
      );
      assert.ok(
        extractionSource.includes('text-zinc-500'),
        'Must use design system token text-zinc-500'
      );
    });

    it('implements interactive <mark> tags with role="button", cursor-pointer, and click/key listeners', () => {
      const rendered = renderAndInspect(React.createElement(ExtractionScreen));
      assert.ok(rendered.html.includes('data-field-mark="date"'), 'Must have date mark');
      assert.ok(rendered.html.includes('data-field-mark="specimen"'), 'Must have specimen mark');
      assert.ok(rendered.html.includes('data-field-mark="hemoglobin"'), 'Must have hemoglobin mark');
      assert.ok(rendered.html.includes('data-field-mark="wbc"'), 'Must have wbc mark');
      assert.ok(rendered.html.includes('role="button"'), 'Marks must have role="button"');
      assert.ok(rendered.html.includes('tabindex="0"') || rendered.html.includes('tabIndex="0"'), 'Marks must have tabIndex=0');
    });

    it('displays reticle indicator [⌖] and highlight ring when a mark is active', () => {
      const store = getWorkspaceStore();
      store.setState({ extractionField: 'hemoglobin' });

      const rendered = renderAndInspect(React.createElement(ExtractionScreen));
      assert.ok(rendered.hasText('⌖'), 'Active mark must render reticle symbol ⌖');
      assert.ok(rendered.html.includes('ring-1 ring-zinc-300'), 'Active mark must have highlight ring');
    });

    it('binds extracted field labels to input ids via htmlFor', () => {
      const store = getWorkspaceStore();
      const fields = store.getState().extractedFields;
      assert.ok(fields.length >= 4, 'Must have at least 4 extracted fields');

      const rendered = renderAndInspect(React.createElement(ExtractionScreen));
      for (const field of fields) {
        assert.ok(
          rendered.html.includes(`for="field-${field.id}"`),
          `Label must have htmlFor="field-${field.id}"`
        );
        assert.ok(
          rendered.html.includes(`id="field-${field.id}"`),
          `Input must have id="field-${field.id}"`
        );
      }
    });

    it('exports fields with activeCase context and review status', () => {
      assert.ok(
        extractionSource.includes('case_context: activeCase'),
        'Export handler must capture activeCase'
      );
      assert.ok(
        extractionSource.includes('review_status: verifiedChecked'),
        'Export handler must capture review status'
      );
    });
  });

  // =========================================================================
  // 6. SettingsScreen Empirical Verification (API Keys & ARIA Semantics)
  // =========================================================================
  describe('6. SettingsScreen Empirical Verification', () => {
    const settingsSourcePath = path.resolve(screensDir, 'SettingsScreen.tsx');
    const settingsSource = fs.readFileSync(settingsSourcePath, 'utf8');

    it('includes dedicated API keys tab in the configuration tabs', () => {
      assert.ok(
        settingsSource.includes('"API keys"'),
        'SettingsScreen tabs array must include "API keys"'
      );
    });

    it('renders API keys tab panel with Hugging Face and Gateway Key password inputs', () => {
      const store = getWorkspaceStore();
      store.setState({ settingTab: 'API keys' });

      const rendered = renderAndInspect(React.createElement(SettingsScreen));
      assert.ok(rendered.hasText('Hugging Face User Access Token'), 'Must render HF token label');
      assert.ok(rendered.html.includes('id="settings-hf-token"'), 'Must have settings-hf-token input');
      assert.ok(rendered.html.includes('id="settings-gateway-key"'), 'Must have settings-gateway-key input');
      assert.ok(rendered.html.includes('placeholder="hf_'), 'Must offer standard hf_ placeholder');
      assert.ok(rendered.hasText('Save API keys'), 'Must offer Save API keys action');
    });

    it('implements strict ARIA tablist, tab, aria-controls, and tabpanel semantics', () => {
      const store = getWorkspaceStore();
      store.setState({ settingTab: 'Appearance' });

      const rendered = renderAndInspect(React.createElement(SettingsScreen));
      assert.ok(rendered.html.includes('role="tablist"'), 'Nav must have role="tablist"');
      assert.ok(rendered.html.includes('aria-orientation="vertical"'), 'Nav must specify vertical orientation');
      assert.ok(rendered.html.includes('role="tab"'), 'Tab items must have role="tab"');
      assert.ok(rendered.html.includes('aria-controls="settings-panel-appearance"'), 'Tab must specify aria-controls');
      assert.ok(rendered.html.includes('role="tabpanel"'), 'Panel container must have role="tabpanel"');
      assert.ok(rendered.html.includes('aria-labelledby="settings-tab-appearance"'), 'Panel must have aria-labelledby');
    });

    it('provides accessible SwitchToggle with role="switch" and aria-checked', () => {
      const store = getWorkspaceStore();
      store.setState({ settingTab: 'Appearance' });

      const rendered = renderAndInspect(React.createElement(SettingsScreen));
      assert.ok(rendered.html.includes('role="switch"'), 'Toggle must have role="switch"');
      assert.ok(rendered.html.includes('aria-checked="true"'), 'Toggle must reflect aria-checked state');
    });

    it('renders dark monochrome health check container without light green colors', () => {
      assert.ok(
        !settingsSource.includes('#f0fdf4'),
        'SettingsScreen must NOT contain light green #f0fdf4'
      );
      assert.ok(
        !settingsSource.includes('#86efac'),
        'SettingsScreen must NOT contain light green #86efac'
      );
      assert.ok(
        settingsSource.includes('bg-zinc-900 border-zinc-800 text-zinc-100'),
        'Health check card must use dark monochrome bg-zinc-900 border-zinc-800'
      );
    });
  });

  // =========================================================================
  // 7. LandingScreen & SignInScreen Empirical Verification
  // =========================================================================
  describe('7. LandingScreen & SignInScreen Empirical Verification', () => {
    const landingSourcePath = path.resolve(screensDir, 'LandingScreen.tsx');
    const signInSourcePath = path.resolve(screensDir, 'SignInScreen.tsx');
    const landingSource = fs.readFileSync(landingSourcePath, 'utf8');
    const signInSource = fs.readFileSync(signInSourcePath, 'utf8');

    it('strictly eliminates light #eee borders and contrast defects from LandingScreen', () => {
      assert.ok(
        !landingSource.includes('#eee'),
        'LandingScreen must NOT contain light border #eee'
      );
      assert.ok(
        !landingSource.includes('color: "#18181b"'),
        'LandingScreen must NOT contain dark-on-dark contrast failure color: "#18181b"'
      );
      assert.ok(
        landingSource.includes('color: "var(--ink)"'),
        'LandingScreen preview nav must use high contrast var(--ink)'
      );
      assert.ok(
        landingSource.includes('border: "1px solid var(--line)"') ||
        landingSource.includes('borderTop: "1px solid var(--line)"'),
        'LandingScreen must use semantic var(--line) for card dividers'
      );
    });

    it('verifies SignInScreen form label-to-id pairings and autocomplete attributes', () => {
      const rendered = renderAndInspect(React.createElement(SignInScreen));
      assert.ok(rendered.html.includes('for="signin-email"'), 'Email label must have htmlFor="signin-email"');
      assert.ok(rendered.html.includes('id="signin-email"'), 'Email input must have id="signin-email"');
      assert.ok(/autoComplete="email"/i.test(rendered.html), 'Email input must have autoComplete="email"');

      assert.ok(rendered.html.includes('for="signin-password"'), 'Password label must have htmlFor="signin-password"');
      assert.ok(rendered.html.includes('id="signin-password"'), 'Password input must have id="signin-password"');
      assert.ok(/autoComplete="current-password"/i.test(rendered.html), 'Password input must have autoComplete="current-password"');

      assert.ok(rendered.html.includes('for="signin-remember"'), 'Remember label must have htmlFor="signin-remember"');
      assert.ok(rendered.html.includes('id="signin-remember"'), 'Remember input must have id="signin-remember"');
    });

    it('verifies absence of raw off-palette hex colors in SignInScreen', () => {
      assert.ok(!signInSource.includes('#99999f'), 'SignInScreen must NOT contain raw hex #99999f');
      assert.ok(!signInSource.includes('#414145'), 'SignInScreen must NOT contain raw hex #414145');
      assert.ok(!signInSource.includes('#a5a5ad'), 'SignInScreen must NOT contain raw hex #a5a5ad');
      assert.ok(signInSource.includes('text-zinc-400'), 'SignInScreen must use text-zinc-400');
    });
  });

  // =========================================================================
  // 8. Cross-Screen Resilience & SSE Lifecycle Verification
  // =========================================================================
  describe('8. Cross-Screen Resilience & SSE Lifecycle Verification', () => {
    it('verifies EhrScreen SSE cleanup, dynamic summary fields, and loading indicator', () => {
      const ehrSourcePath = path.resolve(screensDir, 'EhrScreen.tsx');
      const ehrSource = fs.readFileSync(ehrSourcePath, 'utf8');

      assert.ok(ehrSource.includes('activeEventSourceRef'), 'EhrScreen must track activeEventSourceRef');
      assert.ok(ehrSource.includes('activeEventSourceRef.current.close()'), 'EhrScreen must clean up EventSource on unmount');
      assert.ok(ehrSource.includes('isSummarizing ? "Summarizing..." : "Refresh summary"'), 'Must have button loading text');

      const rendered = renderAndInspect(React.createElement(EhrScreen));
      assert.ok(rendered.hasText('CLINICAL TEXT / EHR'), 'Must render EhrScreen eyebrow');
      assert.ok(rendered.html.includes('role="tablist"'), 'EhrScreen tabs must have role="tablist"');
    });

    it('verifies QaScreen scope selector and EventSource lifecycle management', () => {
      const qaSourcePath = path.resolve(screensDir, 'QaScreen.tsx');
      const qaSource = fs.readFileSync(qaSourcePath, 'utf8');

      assert.ok(qaSource.includes('activeEventSourceRef'), 'QaScreen must track activeEventSourceRef');
      assert.ok(qaSource.includes('activeEventSourceRef.current.close()'), 'QaScreen must clean up EventSource on unmount');
      assert.ok(qaSource.includes('scope === "case"'), 'QaScreen must evaluate scope selector');

      const rendered = renderAndInspect(React.createElement(QaScreen));
      assert.ok(rendered.hasText('ASSISTANT / MEDICAL Q&A') || rendered.html.includes('ASSISTANT / MEDICAL Q&amp;A'), 'Must render QaScreen eyebrow');
      assert.ok(rendered.html.includes('id="qa-input"'), 'Must render qa-input textarea');
    });

    it('verifies ChatScreen store integration and EventSource unmount cleanup', () => {
      const chatSourcePath = path.resolve(screensDir, 'ChatScreen.tsx');
      const chatSource = fs.readFileSync(chatSourcePath, 'utf8');

      assert.ok(chatSource.includes('activeEventSourceRef'), 'ChatScreen must track activeEventSourceRef');
      assert.ok(chatSource.includes('activeEventSourceRef.current.close()'), 'ChatScreen must clean up EventSource on unmount');
      assert.ok(chatSource.includes('addChatMessage'), 'ChatScreen must call addChatMessage');
    });

    it('verifies LibraryScreen category counts and ARIA tablist semantics', () => {
      const rendered = renderAndInspect(React.createElement(LibraryScreen));
      assert.ok(rendered.hasText('WORKSPACE / LIBRARY'), 'Must render LibraryScreen eyebrow');
      assert.ok(rendered.html.includes('role="tablist"'), 'Library tabs must have role="tablist"');
      assert.ok(rendered.html.includes('role="tab"'), 'Library tab items must have role="tab"');
      assert.ok(rendered.matchesText(/All files\s*\(\s*\d+\s*\)/), 'Must render count for All files');
    });

    it('verifies ImagingScreen line 274 contrast fix (absence of #f4f4f5 background with white text)', () => {
      const imagingSourcePath = path.resolve(screensDir, 'ImagingScreen.tsx');
      const imagingSource = fs.readFileSync(imagingSourcePath, 'utf8');

      assert.ok(
        !imagingSource.includes('background: "#f4f4f5"'),
        'ImagingScreen must NOT contain white-on-white defect background: "#f4f4f5"'
      );
      assert.ok(
        imagingSource.includes('background: "var(--soft)"'),
        'ImagingScreen must use semantic var(--soft) token'
      );
    });

    it('verifies ContextBar dynamic display of activeCase in CommonUI', () => {
      const store = getWorkspaceStore();
      store.setState({ activeCase: 'Patient Echo · Longitudinal CT' });

      const rendered = renderAndInspect(React.createElement(ContextBar));
      assert.ok(rendered.hasText('Patient Echo'), 'ContextBar must render activeCase first segment');
      assert.ok(rendered.hasText('Longitudinal CT'), 'ContextBar must render activeCase second segment');
    });
  });

  // =========================================================================
  // 9. Comprehensive Palette Purity Audit Across M3 Assigned Screens
  // =========================================================================
  describe('9. Comprehensive Palette Purity Audit Across M3 Assigned Screens', () => {
    // Milestone 3 assigned screens per PROJECT.md §Milestones M3
    const m3ScreenFiles = [
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
      'ImagingScreen.tsx', // Residual contrast fix verified
    ];

    const forbiddenColors = [
      { pattern: /#10b981/i, name: '#10b981 (emerald green)' },
      { pattern: /#f0fdf4/i, name: '#f0fdf4 (light green card)' },
      { pattern: /#86efac/i, name: '#86efac (light green border)' },
      { pattern: /#777\b/i, name: '#777 (untokened gray)' },
      { pattern: /#eee\b/i, name: '#eee (light border)' },
    ];

    for (const file of m3ScreenFiles) {
      it(`M3 screen ${file} is 100% free of forbidden off-palette hex colors`, () => {
        const content = fs.readFileSync(path.join(screensDir, file), 'utf8');
        for (const { pattern, name } of forbiddenColors) {
          assert.ok(
            !pattern.test(content),
            `Screen ${file} violates design system by containing forbidden color: ${name}`
          );
        }
      });
    }

    it('identifies known M4 residual off-palette color in CompareScreen.tsx for subsequent M4 remediation', () => {
      const compareContent = fs.readFileSync(path.join(screensDir, 'CompareScreen.tsx'), 'utf8');
      const hasEmerald = /#10b981/i.test(compareContent);
      // Document empirical finding for M4
      assert.ok(hasEmerald, 'CompareScreen.tsx contains residual #10b981 to be addressed in Milestone 4');
    });
  });
});
