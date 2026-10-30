/**
 * MedGemma E2E Test Suite - Shared Test Harness & Runtime Utilities
 * 
 * Provides:
 * - Module resolution with jiti for Next.js App Router, React 19, and TypeScript path aliases (@/*)
 * - Headless React SSR rendering and DOM assertion helpers
 * - Token parser for globals.css and medgemma-design.css (verifying #09090b, #18181b, #27272a, etc.)
 * - Zustand store state inspection, actions, and resets
 * - Breakpoint and responsive layout simulation helpers
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { createJiti } from 'jiti';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const WEB_ROOT = path.resolve(__dirname, '..');
export const REPO_ROOT = path.resolve(WEB_ROOT, '..');

// Ensure React.useSyncExternalStore evaluates current live store snapshot during test SSR
React.useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot();

// Initialize jiti compiler with @/ path alias pointing to apps/web/src and JSX support
export const jiti = createJiti(WEB_ROOT, {
  alias: {
    '@': path.resolve(WEB_ROOT, 'src'),
  },
  jsx: true,
  cache: true,
});

/**
 * Loads a module safely via jiti
 */
export function loadModule(relPath) {
  const fullPath = path.resolve(WEB_ROOT, relPath);
  return jiti(fullPath);
}

/**
 * Render a React element to string and return inspection helpers
 */
export function renderComponent(element) {
  const html = ReactDOMServer.renderToString(element);
  return {
    html,
    hasText: (text) => html.includes(text),
    hasClass: (cls) => new RegExp(`class=["'][^"']*\\b${cls}\\b[^"']*["']`).test(html),
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
    extractText: () => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  };
}

/**
 * Design System Token Inspector
 * Reads CSS files and validates the black-and-white monochrome design tokens
 */
export class TokenInspector {
  constructor() {
    this.globalsCssPath = path.resolve(WEB_ROOT, 'src/app/globals.css');
    this.designCssPath = path.resolve(WEB_ROOT, 'src/app/medgemma-design.css');
    this.layoutPath = path.resolve(WEB_ROOT, 'src/app/layout.tsx');
    this.pagePath = path.resolve(WEB_ROOT, 'src/app/page.tsx');

    this.globalsCss = fs.existsSync(this.globalsCssPath) ? fs.readFileSync(this.globalsCssPath, 'utf8') : '';
    this.designCss = fs.existsSync(this.designCssPath) ? fs.readFileSync(this.designCssPath, 'utf8') : '';
    this.layoutTsx = fs.existsSync(this.layoutPath) ? fs.readFileSync(this.layoutPath, 'utf8') : '';
    this.pageTsx = fs.existsSync(this.pagePath) ? fs.readFileSync(this.pagePath, 'utf8') : '';
  }

  /**
   * Expected monochrome token values per ORIGINAL_REQUEST.md & PROJECT.md
   */
  static TOKENS = {
    BASE_BACKGROUND: '#09090b', // zinc-950
    CARD_SURFACE: '#18181b',    // zinc-900
    BORDER_CONTRAST: '#27272a', // zinc-800
    PRIMARY_ACTION_BG: '#ffffff', // High-contrast white CTA
    PRIMARY_ACTION_TEXT: '#09090b',
    PRIMARY_TEXT: '#f4f4f5',    // zinc-100
    MUTED_TEXT: '#a1a1aa',      // zinc-400
    SUBTLE_TEXT: '#71717a',     // zinc-500
    VIEWER_BG: '#000000',       // Medical imaging viewport black
  };

  hasDarkClassOnHtml() {
    return this.layoutTsx.includes('className="dark"') || this.layoutTsx.includes("className='dark'");
  }

  hasDarkBackgroundOnRoot() {
    return this.pageTsx.includes('bg-[#09090b]') || 
           this.pageTsx.includes('bg-background') || 
           this.layoutTsx.includes('bg-[#09090b]') ||
           this.layoutTsx.includes('bg-background');
  }

  hasTokenDefinition(cssVarName, expectedHex) {
    const combined = this.globalsCss + '\n' + this.designCss;
    const cleanHex = expectedHex.toLowerCase();
    const regex = new RegExp(`${cssVarName}\\s*:\\s*(${expectedHex}|${cleanHex}|var\\([^)]+\\)|oklch\\([^)]+\\))`, 'i');
    return regex.test(combined);
  }

  hasCssClass(className) {
    const combined = this.globalsCss + '\n' + this.designCss;
    return combined.includes(className);
  }
}

/**
 * Zustand Store Accessors
 */
export function getWorkspaceStore() {
  const mod = jiti('@/stores/useWorkspaceStore');
  return mod.useWorkspaceStore;
}

export function getImagingStore() {
  const mod = jiti('@/stores/useImagingStore');
  return mod.useImagingStore;
}

/**
 * Resets stores to baseline state
 */
export function resetAllStores() {
  const ws = getWorkspaceStore();
  const im = getImagingStore();

  const types = loadModule('src/types/workspace.ts');

  ws.setState({
    page: 'overview',
    activeCase: 'Case 024 · Chest review',
    activeCaseId: '11111111-1111-1111-1111-111111111111',
    activeSourceId: null,
    imagingMode: 'analysis',
    sliceIndex: 124,
    selectedSeries: '01',
    caseFilter: 'All cases',
    caseSearch: '',
    cases: JSON.parse(JSON.stringify(types.INITIAL_CASES)),
    ehrTab: 'Overview',
    libraryType: 'All files',
    librarySearch: '',
    settingTab: 'Profile',
    extractionField: 'hemoglobin',
    extractedFields: JSON.parse(JSON.stringify(types.INITIAL_EXTRACTED_FIELDS)),
    chatMessages: [],
    qaAnswer: false,
    activeModal: null,
    toastMessage: null,
  });

  im.setState({
    activeTool: 'WindowLevel',
    syncPriorCurrent: true,
    showModelBoxes: true,
    sharedWindowRange: null,
    highlightedSourceId: null,
    highlightedBboxNorm: null,
  });
}

/**
 * Responsive viewport breakpoint simulation helper
 */
export const Breakpoints = {
  DESKTOP_ULTRAWIDE: 1600,
  DESKTOP_STANDARD: 1280,
  TABLET: 840,
  MOBILE: 580,
  ULTRA_NARROW: 360,
};

export function simulateResponsiveStyle(breakpointWidth) {
  return {
    isSidebarHidden: breakpointWidth < 850,
    isMobileBrandVisible: breakpointWidth < 850,
    isDesktopBreadcrumbHidden: breakpointWidth < 850,
    isStackedColumnLayout: breakpointWidth < 600,
    isAvatarHidden: breakpointWidth < 380,
    isMaxPaddingExpanded: breakpointWidth >= 1600,
  };
}
