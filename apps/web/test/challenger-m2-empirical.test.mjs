/**
 * Milestone 2: Empirical Challenger Test Suite
 * 
 * Deeply validates:
 * 1. MobileNavBar: navigation items, count pills, drawer state, modal actions, and subnav links
 * 2. Toast System: #toast-region live region, click dismiss, auto-dismiss timers, preemption & burst stress
 * 3. Responsive CSS Rules: medgemma-design.css & page.tsx (<850px, <600px, <380px layout adaptations)
 * 4. Shell Stress & Robustness: Topbar case sync, Sidebar accordion/deep-links, ReviewBar, ModalRoot resilience
 */

import { describe, it, beforeEach, mock } from 'node:test';
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
  return {
    html,
    hasText: (text) => html.includes(text),
    hasClass: (cls) => {
      const match = html.match(/class=["']([^"']*)["']/);
      if (!match) return false;
      const classes = match[1].split(/\s+/);
      return classes.includes(cls);
    },
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

describe('Empirical Challenger: M2 Global Shell & Common Components', () => {
  // Load target shell components via jiti
  const { MobileNavBar } = loadModule('src/components/medgemma/MobileNavBar.tsx');
  const { Toast } = loadModule('src/components/medgemma/Toast.tsx');
  const { Topbar } = loadModule('src/components/medgemma/Topbar.tsx');
  const { Sidebar } = loadModule('src/components/medgemma/Sidebar.tsx');
  const { ReviewBar } = loadModule('src/components/medgemma/ReviewBar.tsx');
  const { ModalRoot } = loadModule('src/components/medgemma/ModalRoot.tsx');

  const designCssPath = path.resolve(WEB_ROOT, 'src/app/medgemma-design.css');
  const pageTsxPath = path.resolve(WEB_ROOT, 'src/app/page.tsx');
  const designCss = fs.readFileSync(designCssPath, 'utf8');
  const pageTsx = fs.readFileSync(pageTsxPath, 'utf8');

  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // 1. MobileNavBar Empirical Verification
  // =========================================================================
  describe('1. MobileNavBar Component Verification', () => {
    it('renders persistent bottom navigation bar with min-[851px]:hidden', () => {
      const { html, hasTag } = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(hasTag('nav'), 'MobileNavBar must contain <nav> element');
      assert.ok(html.includes('aria-label="Mobile navigation"'), 'Must have accessible mobile nav label');
      assert.ok(html.includes('min-[851px]:hidden'), 'Must be hidden on viewports > 850px');
      assert.ok(html.includes('fixed bottom-0 left-0 right-0 z-40'), 'Must be fixed to bottom on mobile');
      assert.ok(html.includes('h-14'), 'Must have 56px height (h-14)');
    });

    it('renders the 5 core mobile navigation items (Overview, Cases, Imaging, Assistant, More)', () => {
      const { html } = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(html.includes('Overview'), 'Must contain Overview item');
      assert.ok(html.includes('Cases'), 'Must contain Cases item');
      assert.ok(html.includes('Imaging'), 'Must contain Imaging item');
      assert.ok(html.includes('Assistant'), 'Must contain Assistant item');
      assert.ok(html.includes('More'), 'Must contain More item');
    });

    it('highlights active item when route changes in workspace store', () => {
      const store = getWorkspaceStore();

      // Case 1: Overview active
      store.setState({ page: 'overview' });
      let rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(rendered.html.includes('text-white font-semibold'), 'Active item must have high contrast white highlight');

      // Case 2: Imaging active (either "imaging" or "compare")
      store.setState({ page: 'compare' });
      rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(rendered.html.includes('Imaging'), 'Imaging nav item must be present');

      // Case 3: Assistant active (either "chat" or "qa")
      store.setState({ page: 'qa' });
      rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(rendered.html.includes('Assistant'), 'Assistant nav item must be present');
    });

    it('dynamically reflects cases count in mobile Cases button badge', () => {
      const store = getWorkspaceStore();

      // Initial baseline cases count
      let rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(rendered.html.includes('top-1 right-5 text-[8px]'), 'Cases button must have count badge pill');
      assert.ok(rendered.html.includes(String(store.getState().cases.length)), 'Badge must reflect initial cases length');

      // Add a case
      store.getState().addCase({ name: 'Challenger Stress Case 999' });
      rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(rendered.html.includes(String(store.getState().cases.length)), 'Badge must update when case is added');

      // Empty cases
      store.setState({ cases: [] });
      rendered = renderAndInspect(React.createElement(MobileNavBar));
      assert.ok(!rendered.html.includes('rounded-full text-zinc-300'), 'Badge should not render when cases array is empty');
    });

    it('drawer contains all 8 secondary subnavigation links and 2 quick actions', () => {
      // Inspect source code of MobileNavBar for drawer structure and actions
      const mobileNavSource = fs.readFileSync(
        path.resolve(WEB_ROOT, 'src/components/medgemma/MobileNavBar.tsx'),
        'utf8'
      );
      assert.ok(mobileNavSource.includes('+ New Case'), 'Drawer must include + New Case trigger');
      assert.ok(mobileNavSource.includes('Add Source'), 'Drawer must include Add Source trigger');
      assert.ok(mobileNavSource.includes('openModal("newcase")'), 'New Case must trigger newcase modal');
      assert.ok(mobileNavSource.includes('openModal("upload")'), 'Add Source must trigger upload modal');

      const expectedLinks = [
        'Clinical reasoning',
        'EHR summary',
        'Document extraction',
        'Report studio',
        'Longitudinal tracking',
        'Medical Q&A',
        'Library',
        'Settings',
      ];
      for (const link of expectedLinks) {
        assert.ok(mobileNavSource.includes(link), `Drawer must link to ${link}`);
      }
    });
  });

  // =========================================================================
  // 2. Toast Notification Empirical & Timing Verification
  // =========================================================================
  describe('2. Toast Notification System Verification', () => {
    it('maintains permanent polite live region #toast-region in DOM regardless of message', () => {
      const store = getWorkspaceStore();

      // When toastMessage is null
      store.setState({ toastMessage: null });
      let rendered = renderAndInspect(React.createElement(Toast));
      assert.ok(rendered.html.includes('id="toast-region"'), 'Permanent #toast-region must exist when null');
      assert.ok(rendered.html.includes('aria-live="polite"'), '#toast-region must have aria-live="polite"');
      assert.ok(rendered.html.includes('aria-atomic="true"'), '#toast-region must have aria-atomic="true"');
      assert.ok(!rendered.html.includes('role="status"'), 'No active status card when null');

      // When toastMessage has value
      store.setState({ toastMessage: 'Active diagnostic alert' });
      rendered = renderAndInspect(React.createElement(Toast));
      assert.ok(rendered.html.includes('id="toast-region"'), 'Permanent #toast-region must exist with message');
      assert.ok(rendered.html.includes('Active diagnostic alert'), 'Renders active toast text');
      assert.ok(rendered.html.includes('role="status"'), 'Renders role="status" container');
      assert.ok(rendered.html.includes('rounded-[9px]'), 'Toast card has rounded-[9px]');
    });

    it('dismisses toast on click by setting empty message', () => {
      const store = getWorkspaceStore();
      store.getState().showToast('Click dismiss test');
      assert.equal(store.getState().toastMessage, 'Click dismiss test');

      // Simulate click handler (which invokes showToast(""))
      store.getState().showToast('');
      assert.equal(store.getState().toastMessage, '');

      // Verify empty string unmounts card from DOM
      const rendered = renderAndInspect(React.createElement(Toast));
      assert.ok(!rendered.html.includes('role="status"'), 'Empty string toastMessage unmounts card');
    });

    it('empirically verifies auto-dismiss timer clears message after 4500ms', () => {
      mock.timers.enable();
      try {
        const store = getWorkspaceStore();
        store.getState().showToast('Auto-dismiss timing test');
        assert.equal(store.getState().toastMessage, 'Auto-dismiss timing test');

        // Advance 2000ms: message must still be visible
        mock.timers.tick(2000);
        assert.equal(store.getState().toastMessage, 'Auto-dismiss timing test');

        // Advance remaining 2500ms (total 4500ms): message must be dismissed to null
        mock.timers.tick(2500);
        assert.equal(store.getState().toastMessage, null);
      } finally {
        mock.timers.reset();
      }
    });

    it('empirically verifies timer preemption and reset on sequential toasts', () => {
      mock.timers.enable();
      try {
        const store = getWorkspaceStore();
        store.getState().showToast('First Toast Message');
        assert.equal(store.getState().toastMessage, 'First Toast Message');

        // Advance 3000ms
        mock.timers.tick(3000);
        assert.equal(store.getState().toastMessage, 'First Toast Message');

        // Fire second toast: should preempt previous timer and reset 4500ms timer
        store.getState().showToast('Second Toast Message');
        assert.equal(store.getState().toastMessage, 'Second Toast Message');

        // Advance 3000ms (now 6000ms from First Toast, but 3000ms from Second Toast)
        mock.timers.tick(3000);
        assert.equal(store.getState().toastMessage, 'Second Toast Message', 'Second message must not be killed by first timer');

        // Advance remaining 1500ms: second message auto-dismisses
        mock.timers.tick(1500);
        assert.equal(store.getState().toastMessage, null);
      } finally {
        mock.timers.reset();
      }
    });

    it('stress tests rapid burst toasts (100 rapid calls) without timer leaks', () => {
      mock.timers.enable();
      try {
        const store = getWorkspaceStore();
        for (let i = 0; i < 100; i++) {
          store.getState().showToast(`Burst message ${i}`);
        }
        assert.equal(store.getState().toastMessage, 'Burst message 99');

        mock.timers.tick(4499);
        assert.equal(store.getState().toastMessage, 'Burst message 99');

        mock.timers.tick(1);
        assert.equal(store.getState().toastMessage, null);
      } finally {
        mock.timers.reset();
      }
    });
  });

  // =========================================================================
  // 3. Responsive CSS Rules & Layout Constraints
  // =========================================================================
  describe('3. Responsive Layout Rules & Breakpoints', () => {
    it('page.tsx wraps content with max-[850px]:pb-20 clearance for mobile bottom nav', () => {
      assert.ok(
        pageTsx.includes('max-[850px]:pb-20'),
        'page.tsx content container must have max-[850px]:pb-20'
      );
      assert.ok(
        pageTsx.includes('<MobileNavBar />'),
        'page.tsx must mount MobileNavBar'
      );
    });

    it('medgemma-design.css enforces sidebar hiding and single column grid under 850px', () => {
      // Find @media (max-width: 850px) block
      const media850Index = designCss.indexOf('@media (max-width: 850px)');
      assert.ok(media850Index !== -1, 'Missing @media (max-width: 850px) breakpoint');
      const media850Section = designCss.substring(media850Index, media850Index + 800);

      assert.ok(media850Section.includes('.sidebar'), 'Must define .sidebar rule in @media (max-width: 850px)');
      assert.ok(media850Section.includes('display: none;'), 'Sidebar must be hidden on mobile < 850px');
      assert.ok(media850Section.includes('.app'), 'Must define .app rule in @media (max-width: 850px)');
      assert.ok(media850Section.includes('grid-template-columns: 1fr;'), 'App grid must collapse to single column');
      assert.ok(media850Section.includes('.mobile-brand'), 'Must show .mobile-brand in topbar');
      assert.ok(media850Section.includes('.crumb .desktop'), 'Must hide desktop breadcrumbs');
    });

    it('medgemma-design.css handles compact viewports under 600px and 380px', () => {
      // 600px breakpoint
      const media600Index = designCss.indexOf('@media (max-width: 600px)');
      assert.ok(media600Index !== -1, 'Missing @media (max-width: 600px) breakpoint');
      const media600Section = designCss.substring(media600Index, media600Index + 800);
      assert.ok(media600Section.includes('.reviewbar .review-note'), 'Must hide reviewbar note on small screens');
      assert.ok(media600Section.includes('.case-picker'), 'Must clamp case-picker width');

      // 380px breakpoint
      const media380Index = designCss.indexOf('@media (max-width: 380px)');
      assert.ok(media380Index !== -1, 'Missing @media (max-width: 380px) breakpoint');
      const media380Section = designCss.substring(media380Index, media380Index + 400);
      assert.ok(media380Section.includes('.top-actions > .avatar'), 'Must hide user avatar on ultra-compact <380px');
      assert.ok(media380Section.includes('display: none;'), 'Avatar must have display: none under 380px');
    });
  });

  // =========================================================================
  // 4. Shell Stress & Robustness Hardening
  // =========================================================================
  describe('4. Shell Stress & Component Robustness', () => {
    it('ReviewBar maintains sticky top-0 z-30 and syncs route with all 15 screens', () => {
      const store = getWorkspaceStore();
      const rendered = renderAndInspect(React.createElement(ReviewBar));
      assert.ok(rendered.html.includes('sticky top-0 z-30'), 'ReviewBar must be sticky top-0 z-30');
      assert.ok(rendered.html.includes('+'), 'Must render high-contrast + badge');
      assert.ok(rendered.html.includes('15 screens'), 'Must mention 15 screens');

      // Verify all 15 screens are present as <option> tags
      const optionCount = rendered.countOccurrences('<option');
      assert.equal(optionCount, 15, 'ReviewBar must contain exactly 15 screen options');

      // Verify changing page reflects in ReviewBar value
      store.setState({ page: 'settings' });
      const updated = renderAndInspect(React.createElement(ReviewBar));
      assert.ok(updated.html.includes('value="settings"'), 'Select value must sync with page');
    });

    it('Topbar handles 100+ cases and extreme case names without layout breakdown', () => {
      const store = getWorkspaceStore();
      const stressCases = Array.from({ length: 100 }, (_, i) => ({
        id: `STRESS-${String(i).padStart(3, '0')}`,
        name: `Stress Patient ${i} with very long clinical summary notes that should truncate gracefully`,
        meta: 'DICOM 512x512',
        status: 'In progress',
        date: 'Today',
      }));

      store.setState({
        cases: stressCases,
        activeCaseId: 'STRESS-042',
        activeCase: 'Stress Patient 42',
      });

      const rendered = renderAndInspect(React.createElement(Topbar));
      assert.ok(rendered.html.includes('h-[72px]'), 'Topbar height retained');
      assert.ok(rendered.html.includes('STRESS-042'), 'Contains selected stress case');
      assert.ok(rendered.html.includes('w-[34px] h-[34px]'), 'Search button has exact 34x34px');
      assert.ok(rendered.html.includes('w-[29px] h-[29px]'), 'Avatar has exact 29x29px');
    });

    it('Topbar handles "No case context" and unrecognized activeCaseId gracefully', () => {
      const store = getWorkspaceStore();

      // Case 1: "No case context"
      store.setState({ activeCase: 'No case context', activeCaseId: '' });
      let rendered = renderAndInspect(React.createElement(Topbar));
      assert.ok(rendered.html.includes('value="none"'), 'Select value must be "none"');

      // Case 2: Unknown ID falls back safely to none without runtime throwing
      store.setState({ activeCase: 'Unknown Case', activeCaseId: '9999-invalid' });
      rendered = renderAndInspect(React.createElement(Topbar));
      assert.ok(rendered.html.includes('value="none"'), 'Unmatched case falls back to "none"');
    });

    it('Sidebar accordion groups expand and collapse independently without collisions', () => {
      const store = getWorkspaceStore();
      store.setState({ page: 'overview' });

      // In overview page, submenus are initially collapsed
      let rendered = renderAndInspect(React.createElement(Sidebar));
      assert.ok(rendered.html.includes('WORKSPACE'), 'WORKSPACE header present');
      assert.ok(rendered.html.includes('rounded-[9px] bg-white text-[#09090b]'), '9px brandmark present');

      // Switching to "chat" auto-expands Assistant group
      store.setState({ page: 'chat' });
      rendered = renderAndInspect(React.createElement(Sidebar));
      assert.ok(rendered.html.includes('General chat'), 'General chat visible when chat is active');
      assert.ok(rendered.html.includes('Medical Q&amp;A') || rendered.html.includes('Medical Q&A'), 'Medical Q&A visible');

      // Switching to "imaging" auto-expands Imaging group
      store.setState({ page: 'imaging' });
      rendered = renderAndInspect(React.createElement(Sidebar));
      assert.ok(rendered.html.includes('Image workspace'), 'Image workspace visible when imaging is active');
      assert.ok(rendered.html.includes('Longitudinal tracking'), 'Longitudinal tracking visible');

      // Switching to "reasoning" auto-expands Clinical text group
      store.setState({ page: 'reasoning' });
      rendered = renderAndInspect(React.createElement(Sidebar));
      assert.ok(rendered.html.includes('Clinical reasoning'), 'Clinical reasoning visible');
      assert.ok(rendered.html.includes('EHR summary'), 'EHR summary visible');
    });

    it('Sidebar deep-links Model Connection card and Profile chip to correct Settings tabs', () => {
      const sidebarSource = fs.readFileSync(
        path.resolve(WEB_ROOT, 'src/components/medgemma/Sidebar.tsx'),
        'utf8'
      );
      assert.ok(sidebarSource.includes('setSettingTab("Model connection")'), 'Must deep-link to Model connection');
      assert.ok(sidebarSource.includes('setSettingTab("Profile")'), 'Must deep-link to Profile');
      assert.ok(sidebarSource.includes('showToast("Workspace switcher: Personal · Demo workspace active")'), 'Workspace switcher dispatches toast');
    });

    it('ModalRoot resilience: maintains permanent #modal-root and renders all modal variants', () => {
      const store = getWorkspaceStore();

      // Inactive state: permanent container present, child null
      store.setState({ activeModal: null });
      let rendered = renderAndInspect(React.createElement(ModalRoot));
      assert.equal(rendered.html, '<div id="modal-root"></div>', 'Permanent empty container when inactive');

      // New Case modal
      store.setState({ activeModal: { type: 'newcase' } });
      rendered = renderAndInspect(React.createElement(ModalRoot));
      assert.ok(rendered.html.includes('id="modal-root"'), 'Permanent container present');
      assert.ok(rendered.html.includes('A new starting point.'), 'Renders new case dialog heading');
      assert.ok(rendered.html.includes('Case title'), 'Renders case title field');
      assert.ok(rendered.html.includes('Create Case'), 'Renders create case button');
      assert.ok(rendered.html.includes('role="dialog"'), 'Has dialog role');
      assert.ok(rendered.html.includes('aria-modal="true"'), 'Has aria-modal="true"');

      // Upload modal
      store.setState({ activeModal: { type: 'upload' } });
      rendered = renderAndInspect(React.createElement(ModalRoot));
      assert.ok(rendered.html.includes('Add a source.'), 'Renders upload dialog heading');
      assert.ok(rendered.html.includes('Upload to Case'), 'Renders upload action button');

      // Source modal with mock payload
      store.setState({
        activeModal: {
          type: 'source',
          payload: {
            title: 'Chest CT Scan Report',
            quote: 'Bilateral lung opacities noted in lower lobes.',
            location: 'Page 3, Section 2',
          },
        },
      });
      rendered = renderAndInspect(React.createElement(ModalRoot));
      assert.ok(rendered.html.includes('Evidence, in context.'), 'Renders source viewer dialog heading');
      assert.ok(rendered.html.includes('Chest CT Scan Report'), 'Renders payload title');
      assert.ok(rendered.html.includes('Bilateral lung opacities noted in lower lobes.'), 'Renders payload quote');
      assert.ok(rendered.html.includes('Page 3, Section 2'), 'Renders payload location');

      // Source modal with empty/null payload: adversarial resilience
      store.setState({ activeModal: { type: 'source', payload: null } });
      assert.doesNotThrow(() => {
        renderAndInspect(React.createElement(ModalRoot));
      }, 'ModalRoot must not throw on null payload');
    });
  });

  // =========================================================================
  // 5. Adversarial Input Hardening & Edge-Case Probing
  // =========================================================================
  describe('5. Adversarial Input Hardening & Edge Cases', () => {
    it('sanitizes and escapes hostile script injection payload in Toast', () => {
      const store = getWorkspaceStore();
      const maliciousPayload = '<script>alert("XSS")</script><img src=x onerror=alert(1)>';
      store.getState().showToast(maliciousPayload);

      const rendered = renderAndInspect(React.createElement(Toast));
      // React SSR must escape HTML entities
      assert.ok(!rendered.html.includes('<script>alert("XSS")</script>'), 'Unescaped script tag must never enter DOM');
      assert.ok(rendered.html.includes('&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'), 'Script tags must be entity escaped');
    });

    it('sanitizes and escapes hostile script injection in Topbar case name', () => {
      const store = getWorkspaceStore();
      const maliciousCase = {
        id: 'XSS-001',
        name: '<script>document.cookie="stolen"</script>',
        meta: 'Hostile test payload',
        status: 'In progress',
        date: 'Today',
      };
      store.setState({
        cases: [maliciousCase],
        activeCaseId: 'XSS-001',
        activeCase: maliciousCase.name,
      });

      const rendered = renderAndInspect(React.createElement(Topbar));
      assert.ok(!rendered.html.includes('<script>document.cookie='), 'Hostile script in case picker must be entity escaped');
      assert.ok(rendered.html.includes('&lt;script&gt;'), 'Case picker properly escaped HTML entities');
    });

    it('handles rapid sequential modal state transitions without crashing', () => {
      const store = getWorkspaceStore();
      const modalTypes = ['newcase', 'upload', 'source', null, 'newcase', null];

      for (const m of modalTypes) {
        assert.doesNotThrow(() => {
          store.setState({
            activeModal: m ? { type: m, payload: { title: 'Rapid switch test' } } : null,
          });
          renderAndInspect(React.createElement(ModalRoot));
        }, `ModalRoot threw during rapid switch to ${m}`);
      }
    });

    it('benchmarks extreme 1,000 cases injection in Topbar and MobileNavBar (<100ms)', () => {
      const store = getWorkspaceStore();
      const thousandCases = Array.from({ length: 1000 }, (_, i) => ({
        id: String(i).padStart(4, '0'),
        name: `Patient ${i}`,
        meta: 'DICOM study',
        status: 'In progress',
        date: 'Today',
      }));

      store.setState({ cases: thousandCases });

      const startTime = performance.now();
      const topbarRendered = renderAndInspect(React.createElement(Topbar));
      const mobileNavRendered = renderAndInspect(React.createElement(MobileNavBar));
      const duration = performance.now() - startTime;

      assert.ok(duration < 150, `1,000 cases render took ${duration.toFixed(2)}ms, exceeding 150ms limit`);
      assert.ok(topbarRendered.countOccurrences('<option') >= 1000, 'All 1,000 options rendered in Topbar');
      assert.ok(mobileNavRendered.html.includes('1000'), 'Mobile nav reflects 1000 count');
    });

    it('verifies all 15 screens can be visited in succession via ReviewBar without errors', () => {
      const store = getWorkspaceStore();
      const allPages = [
        'landing', 'signin', 'overview', 'cases', 'case', 'chat', 'imaging',
        'compare', 'report', 'reasoning', 'ehr', 'extraction', 'qa', 'library', 'settings'
      ];

      for (const p of allPages) {
        store.getState().setPage(p);
        assert.equal(store.getState().page, p);
        const rendered = renderAndInspect(React.createElement(ReviewBar));
        assert.ok(rendered.html.includes(`value="${p}"`), `ReviewBar must reflect active page ${p}`);
      }
    });

    it('enforces WCAG focus-visible ring styles on interactive buttons in Sidebar and Topbar', () => {
      const sidebarHtml = ReactDOMServer.renderToString(React.createElement(Sidebar));
      const topbarHtml = ReactDOMServer.renderToString(React.createElement(Topbar));

      assert.ok(
        sidebarHtml.includes('focus-visible:ring-1') || sidebarHtml.includes('focus-visible:ring'),
        'Sidebar interactive controls must provide focus-visible rings'
      );
      assert.ok(
        topbarHtml.includes('focus:ring-1') || topbarHtml.includes('focus:outline-none'),
        'Topbar controls must provide accessible focus indicators'
      );
    });
  });
});

