/**
 * Milestone 1: Empirical Challenger Stress Harness
 * 
 * Deeply validates:
 * 1. UI Primitives in `src/components/ui/` (badge, button, card, input, separator, tabs)
 * 2. Shared UI components in `src/components/medgemma/CommonUI.tsx`
 * 3. Interaction states: hover transitions, focus rings, tactile feedback, disabled states
 * 4. Micro-SaaS border radius constraints (6px - 8px, eliminating oversized pills)
 * 5. Compiled CSS token validation (.next/static/css/*.css)
 * 6. WCAG AAA mathematical contrast ratio verification
 * 7. Edge cases, custom className injection, slot attribute integrity
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Ensure global React is defined for components without explicit React import under SSR
globalThis.React = React;

import {
  WEB_ROOT,
  loadModule,
  TokenInspector,
} from './test-harness.mjs';

// Safe class matcher that handles Tailwind arbitrary values like ring-[3px]
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
  };
}

// Contrast ratio calculator using WCAG 2.1 relative luminance specification
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return [r, g, b];
}

function sRgbToLinear(c) {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  const R = sRgbToLinear(r);
  const G = sRgbToLinear(g);
  const B = sRgbToLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Empirical Challenger: M1 UI System & Component Primitives', () => {

  // Load modules via jiti
  const { Badge, badgeVariants } = loadModule('src/components/ui/badge.tsx');
  const { Button, buttonVariants } = loadModule('src/components/ui/button.tsx');
  const {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardAction,
    CardContent,
    CardFooter,
  } = loadModule('src/components/ui/card.tsx');
  const { Input } = loadModule('src/components/ui/input.tsx');
  const { Separator } = loadModule('src/components/ui/separator.tsx');
  const {
    Tabs,
    TabsList,
    TabsTrigger,
    TabsContent,
    tabsListVariants,
  } = loadModule('src/components/ui/tabs.tsx');
  const CommonUI = loadModule('src/components/medgemma/CommonUI.tsx');

  describe('1. Badge Component Primitives & Radius Constraints', () => {
    it('renders default badge with micro-SaaS radius (rounded-md, ~6px), NOT pill (rounded-4xl)', () => {
      const { html, hasClass } = renderAndInspect(
        React.createElement(Badge, null, 'Test Badge')
      );
      assert.ok(hasClass('rounded-md'), 'Badge must have rounded-md');
      assert.ok(!hasClass('rounded-4xl'), 'Badge must not have rounded-4xl pill');
      assert.ok(!hasClass('rounded-full'), 'Badge must not have rounded-full');
      assert.ok(html.includes('Test Badge'), 'Must contain children text');
    });

    it('renders all badge variants with proper monochrome tokens & hover classes', () => {
      const defaultBadge = renderAndInspect(React.createElement(Badge, { variant: 'default' }, 'Def'));
      assert.ok(defaultBadge.hasClass('bg-primary'), 'default variant must use bg-primary');
      assert.ok(defaultBadge.hasClass('text-primary-foreground'), 'default variant text-primary-foreground');
      assert.ok(defaultBadge.hasClass('hover:bg-zinc-200'), 'default variant must have hover:bg-zinc-200');

      const secBadge = renderAndInspect(React.createElement(Badge, { variant: 'secondary' }, 'Sec'));
      assert.ok(secBadge.hasClass('bg-secondary'), 'secondary variant must use bg-secondary');
      assert.ok(secBadge.hasClass('text-secondary-foreground'), 'secondary variant text-secondary-foreground');
      assert.ok(secBadge.hasClass('hover:bg-zinc-700'), 'secondary variant must have hover:bg-zinc-700');

      const outlineBadge = renderAndInspect(React.createElement(Badge, { variant: 'outline' }, 'Out'));
      assert.ok(outlineBadge.hasClass('border-border'), 'outline variant must use border-border');
      assert.ok(outlineBadge.hasClass('text-foreground'), 'outline variant text-foreground');
      assert.ok(outlineBadge.hasClass('hover:bg-muted'), 'outline variant hover:bg-muted');

      const ghostBadge = renderAndInspect(React.createElement(Badge, { variant: 'ghost' }, 'Ghost'));
      assert.ok(ghostBadge.hasClass('hover:bg-muted'), 'ghost variant hover:bg-muted');
      assert.ok(ghostBadge.hasClass('hover:text-muted-foreground'), 'ghost variant hover:text-muted-foreground');
    });

    it('includes accessibility focus rings and transition-all on badge', () => {
      const { hasClass } = renderAndInspect(React.createElement(Badge, null, 'Focus Ring'));
      assert.ok(hasClass('transition-all'), 'Must include transition-all');
      assert.ok(hasClass('focus-visible:border-ring'), 'Must include focus-visible:border-ring');
      assert.ok(hasClass('focus-visible:ring-[3px]'), 'Must include focus-visible:ring-[3px]');
      assert.ok(hasClass('focus-visible:ring-ring/50'), 'Must include focus-visible:ring-ring/50');
    });

    it('handles custom className merging without overriding core variant semantics', () => {
      const { hasClass } = renderAndInspect(
        React.createElement(Badge, { className: 'custom-challenger-cls shadow-md' }, 'Custom')
      );
      assert.ok(hasClass('custom-challenger-cls'), 'Custom class must be applied');
      assert.ok(hasClass('shadow-md'), 'Utility class must be applied');
      assert.ok(hasClass('rounded-md'), 'Base radius must be retained');
    });
  });

  describe('2. Button Component Primitives & Micro-Interactions', () => {
    it('renders button with micro-SaaS radius (rounded-md, ~6px/8px) and tactile click translation', () => {
      const { html, hasClass } = renderAndInspect(
        React.createElement(Button, null, 'Click Me')
      );
      assert.ok(hasClass('rounded-md'), 'Button base must be rounded-md');
      assert.ok(hasClass('transition-all'), 'Button must have transition-all');
      assert.ok(hasClass('active:not-aria-[haspopup]:translate-y-px'), 'Tactile active click effect must be present');
      assert.ok(html.includes('data-slot="button"'), 'Button must specify data-slot="button"');
    });

    it('renders button variants with high-contrast monochrome styles', () => {
      const defBtn = renderAndInspect(React.createElement(Button, { variant: 'default' }, 'Primary CTA'));
      assert.ok(defBtn.hasClass('bg-primary'), 'Default CTA has bg-primary');
      assert.ok(defBtn.hasClass('text-primary-foreground'), 'Default CTA has text-primary-foreground');
      assert.ok(defBtn.hasClass('hover:bg-zinc-200'), 'Default CTA has hover:bg-zinc-200');

      const outlineBtn = renderAndInspect(React.createElement(Button, { variant: 'outline' }, 'Outline'));
      assert.ok(outlineBtn.hasClass('border-border'), 'Outline has border-border');
      assert.ok(outlineBtn.hasClass('hover:bg-secondary'), 'Outline has hover:bg-secondary');

      const secBtn = renderAndInspect(React.createElement(Button, { variant: 'secondary' }, 'Secondary'));
      assert.ok(secBtn.hasClass('bg-secondary'), 'Secondary has bg-secondary');
      assert.ok(secBtn.hasClass('hover:bg-zinc-700'), 'Secondary has hover:bg-zinc-700');

      const ghostBtn = renderAndInspect(React.createElement(Button, { variant: 'ghost' }, 'Ghost'));
      assert.ok(ghostBtn.hasClass('hover:bg-secondary'), 'Ghost has hover:bg-secondary');
    });

    it('enforces focus ring visibility on button', () => {
      const { hasClass } = renderAndInspect(React.createElement(Button, null, 'Focus Test'));
      assert.ok(hasClass('focus-visible:ring-2'), 'Must have focus-visible:ring-2');
      assert.ok(hasClass('focus-visible:ring-ring'), 'Must have focus-visible:ring-ring');
      assert.ok(hasClass('focus-visible:border-ring'), 'Must have focus-visible:border-ring');
    });

    it('supports multiple sizes (default, sm, xs, lg, icon) with proportionate heights', () => {
      const defaultSize = renderAndInspect(React.createElement(Button, { size: 'default' }, 'Def'));
      assert.ok(defaultSize.hasClass('h-8'), 'Default button size is h-8');

      const smSize = renderAndInspect(React.createElement(Button, { size: 'sm' }, 'Sm'));
      assert.ok(smSize.hasClass('h-7'), 'Small button size is h-7');

      const xsSize = renderAndInspect(React.createElement(Button, { size: 'xs' }, 'Xs'));
      assert.ok(xsSize.hasClass('h-6'), 'Extra small button size is h-6');

      const lgSize = renderAndInspect(React.createElement(Button, { size: 'lg' }, 'Lg'));
      assert.ok(lgSize.hasClass('h-9'), 'Large button size is h-9');

      const iconSize = renderAndInspect(React.createElement(Button, { size: 'icon' }, 'X'));
      assert.ok(iconSize.hasClass('size-8'), 'Icon button size is size-8');
    });

    it('handles disabled state properly (disabling pointer events and applying opacity)', () => {
      const { hasClass, html } = renderAndInspect(
        React.createElement(Button, { disabled: true }, 'Disabled')
      );
      assert.ok(hasClass('disabled:pointer-events-none'), 'Must disable pointer events');
      assert.ok(hasClass('disabled:opacity-50'), 'Must dim opacity to 50%');
      assert.ok(html.includes('disabled'), 'Must contain HTML disabled attribute');
    });
  });

  describe('3. Card Component Architecture & Surface Tokens', () => {
    it('renders Card with 8px radius (rounded-lg), border-border, and bg-card (#18181b)', () => {
      const { html, hasClass } = renderAndInspect(
        React.createElement(
          Card,
          null,
          React.createElement(CardHeader, null, React.createElement(CardTitle, null, 'Case Title')),
          React.createElement(CardContent, null, 'Card body details'),
          React.createElement(CardFooter, null, 'Footer actions')
        )
      );
      assert.ok(hasClass('rounded-lg'), 'Card must have rounded-lg (8px)');
      assert.ok(!hasClass('rounded-xl'), 'Card must not have rounded-xl (oversized)');
      assert.ok(hasClass('border-border'), 'Card border must use border-border');
      assert.ok(hasClass('bg-card'), 'Card background must use bg-card');
      assert.ok(hasClass('text-card-foreground'), 'Card text must use text-card-foreground');
      assert.ok(html.includes('data-slot="card"'), 'Must have data-slot="card"');
      assert.ok(html.includes('data-slot="card-header"'), 'Must have data-slot="card-header"');
      assert.ok(html.includes('data-slot="card-content"'), 'Must have data-slot="card-content"');
      assert.ok(html.includes('data-slot="card-footer"'), 'Must have data-slot="card-footer"');
    });

    it('CardHeader and CardFooter respect container rounding and borders', () => {
      const header = renderAndInspect(React.createElement(CardHeader, null, 'Header'));
      assert.ok(header.hasClass('rounded-t-lg'), 'CardHeader must have rounded-t-lg');

      const footer = renderAndInspect(React.createElement(CardFooter, null, 'Footer'));
      assert.ok(footer.hasClass('rounded-b-lg'), 'CardFooter must have rounded-b-lg');
      assert.ok(footer.hasClass('border-t'), 'CardFooter must have border-t');
      assert.ok(footer.hasClass('border-border'), 'CardFooter border must be border-border');
    });

    it('CardTitle and CardDescription apply typography tokens', () => {
      const title = renderAndInspect(React.createElement(CardTitle, null, 'My Title'));
      assert.ok(title.hasClass('font-heading'), 'CardTitle must use font-heading');
      assert.ok(title.hasClass('font-medium'), 'CardTitle must use font-medium');

      const desc = renderAndInspect(React.createElement(CardDescription, null, 'Description text'));
      assert.ok(desc.hasClass('text-muted-foreground'), 'CardDescription must use text-muted-foreground');
    });
  });

  describe('4. Input Component & Focus States', () => {
    it('renders input with 6px radius (rounded-md), h-8, and monochrome bg-background (#09090b)', () => {
      const { html, hasClass } = renderAndInspect(
        React.createElement(Input, { placeholder: 'Search cases...', defaultValue: 'Initial' })
      );
      assert.ok(hasClass('rounded-md'), 'Input must have rounded-md');
      assert.ok(hasClass('h-8'), 'Input height must be h-8');
      assert.ok(hasClass('border-input'), 'Input border must use border-input');
      assert.ok(hasClass('bg-background'), 'Input background must use bg-background');
      assert.ok(hasClass('text-foreground'), 'Input text must use text-foreground');
      assert.ok(hasClass('placeholder:text-muted-foreground'), 'Input placeholder must use text-muted-foreground');
      assert.ok(html.includes('placeholder="Search cases..."'), 'Must pass through placeholder');
      assert.ok(html.includes('data-slot="input"'), 'Must have data-slot="input"');
    });

    it('applies focus-visible:border-ring and transition-colors', () => {
      const { hasClass } = renderAndInspect(React.createElement(Input, null));
      assert.ok(
        hasClass('focus-visible:border-ring') || hasClass('focus-visible:border-zinc-500'),
        'Must have focus-visible:border-ring'
      );
      assert.ok(hasClass('transition-colors'), 'Must have transition-colors');
      assert.ok(hasClass('outline-none'), 'Must suppress default outline in favor of focus ring');
    });

    it('supports disabled input state', () => {
      const { hasClass, html } = renderAndInspect(React.createElement(Input, { disabled: true }));
      assert.ok(hasClass('disabled:pointer-events-none'), 'Must disable pointer events');
      assert.ok(hasClass('disabled:cursor-not-allowed'), 'Must show not-allowed cursor');
      assert.ok(hasClass('disabled:opacity-50'), 'Must reduce opacity');
      assert.ok(html.includes('disabled'), 'HTML element must be disabled');
    });
  });

  describe('5. Separator Component', () => {
    it('renders horizontal separator with 1px border (#27272a)', () => {
      const { html, hasClass } = renderAndInspect(
        React.createElement(Separator, { orientation: 'horizontal' })
      );
      assert.ok(hasClass('bg-border'), 'Separator must have bg-border');
      assert.ok(hasClass('data-horizontal:h-px'), 'Horizontal must be 1px high');
      assert.ok(hasClass('data-horizontal:w-full'), 'Horizontal must be full width');
      assert.ok(html.includes('data-slot="separator"'), 'Must have data-slot="separator"');
    });

    it('renders vertical separator with 1px border (#27272a)', () => {
      const { hasClass } = renderAndInspect(
        React.createElement(Separator, { orientation: 'vertical' })
      );
      assert.ok(hasClass('bg-border'), 'Separator must have bg-border');
      assert.ok(hasClass('data-vertical:w-px'), 'Vertical must be 1px wide');
      assert.ok(hasClass('data-vertical:self-stretch'), 'Vertical must self-stretch');
    });
  });

  describe('6. Tabs Component Primitives & Micro-SaaS Radius', () => {
    it('TabsList container has rounded-lg (8px) and bg-muted', () => {
      const { html } = renderAndInspect(
        React.createElement(
          Tabs,
          { value: 'tab1' },
          React.createElement(TabsList, null, React.createElement(TabsTrigger, { value: 'tab1' }, 'Tab 1'))
        )
      );
      assert.ok(html.includes('rounded-lg'), 'TabsList container must have rounded-lg (8px)');
      assert.ok(html.includes('bg-muted'), 'TabsList default variant must have bg-muted');
      assert.ok(html.includes('text-muted-foreground'), 'TabsList has text-muted-foreground');
      assert.ok(html.includes('data-slot="tabs-list"'), 'Must have data-slot="tabs-list"');
    });

    it('TabsTrigger has rounded-md (6px), hover transition, and active monochrome states', () => {
      const { html } = renderAndInspect(
        React.createElement(
          Tabs,
          { value: 'tab1' },
          React.createElement(TabsList, null, React.createElement(TabsTrigger, { value: 'tab1' }, 'Tab 1'))
        )
      );
      assert.ok(html.includes('rounded-md'), 'TabsTrigger must have rounded-md (6px)');
      assert.ok(html.includes('transition-all'), 'TabsTrigger must have transition-all');
      assert.ok(html.includes('hover:text-foreground'), 'TabsTrigger has hover:text-foreground');
      assert.ok(html.includes('focus-visible:border-ring'), 'TabsTrigger has focus-visible:border-ring');
      assert.ok(html.includes('focus-visible:ring-2'), 'TabsTrigger has focus-visible:ring-2');
      assert.ok(html.includes('data-active:bg-background'), 'Active tab must have data-active:bg-background');
      assert.ok(html.includes('data-active:text-foreground'), 'Active tab must have data-active:text-foreground');
      assert.ok(html.includes('data-active:border-border'), 'Active tab must have data-active:border-border');
      assert.ok(html.includes('data-slot="tabs-trigger"'), 'Must have data-slot="tabs-trigger"');
    });
  });

  describe('7. CommonUI Shared Components Integration', () => {
    it('CommonUI Badge handles all variant mappings without regression', () => {
      const darkBadge = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Needs review', variant: 'dark' }));
      assert.ok(darkBadge.hasClass('badge'), 'Must have .badge class');
      assert.ok(darkBadge.hasClass('dark'), 'Must have .dark class');
      assert.ok(darkBadge.hasText('Needs review'), 'Text rendered correctly');

      const softBadge = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Demo', variant: 'soft' }));
      assert.ok(softBadge.hasClass('badge'));
      assert.ok(softBadge.hasClass('soft'));

      const dashBadge = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Not provided', variant: 'dash' }));
      assert.ok(dashBadge.hasClass('badge'));
      assert.ok(dashBadge.hasClass('dash'));

      // Shadcn variant aliases
      const defaultMapped = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Default Mapped', variant: 'default' }));
      assert.ok(defaultMapped.hasClass('dark'), 'variant="default" must map to dark');

      const secMapped = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Secondary Mapped', variant: 'secondary' }));
      assert.ok(secMapped.hasClass('soft'), 'variant="secondary" must map to soft');

      const outlineMapped = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Outline Mapped', variant: 'outline' }));
      assert.ok(outlineMapped.hasClass('dash'), 'variant="outline" must map to dash');

      // Empty variant fallback
      const bareBadge = renderAndInspect(React.createElement(CommonUI.Badge, { text: 'Bare' }));
      assert.ok(bareBadge.hasClass('badge'));
      assert.equal(bareBadge.html, '<span class="badge">Bare</span>');
    });

    it('CommonUI SourceChip renders clickable button with link icon and modal trigger', () => {
      const chip = renderAndInspect(React.createElement(CommonUI.SourceChip, { label: 'Pathology · p. 4' }));
      assert.ok(chip.hasTag('button'), 'SourceChip must be a button');
      assert.ok(chip.hasClass('source'), 'Must have .source class');
      assert.ok(chip.hasText('Pathology · p. 4'), 'Must render custom label');
      assert.ok(chip.html.includes('title="View source context"'), 'Must include title attribute');
    });

    it('CommonUI Heading renders eyebrow, title, desc, and optional action slots', () => {
      const action = React.createElement('button', { type: 'button' }, 'Action Btn');
      const heading = renderAndInspect(
        React.createElement(CommonUI.Heading, {
          eyebrow: 'CASE 024',
          title: 'Chest Radiograph Review',
          desc: 'Automated synthesis from 2 imaging studies.',
          actions: action,
        })
      );
      assert.ok(heading.hasClass('heading'), 'Must have .heading container');
      assert.ok(heading.hasText('CASE 024'), 'Must render eyebrow');
      assert.ok(heading.hasText('Chest Radiograph Review'), 'Must render title in h1');
      assert.ok(heading.hasText('Automated synthesis from 2 imaging studies.'), 'Must render description');
      assert.ok(heading.hasText('Action Btn'), 'Must render actions slot');
    });

    it('CommonUI ContextBar and Footnote render clinical metadata cleanly', () => {
      const contextBar = renderAndInspect(React.createElement(CommonUI.ContextBar, null));
      assert.ok(contextBar.hasClass('context'), 'Must have .context class');
      assert.ok(contextBar.hasText('Case 024'), 'Must display Case 024');
      assert.ok(contextBar.hasText('Chest follow-up'), 'Must display chest follow-up');

      const footnote = renderAndInspect(React.createElement(CommonUI.Footnote, null));
      assert.ok(footnote.hasClass('footnote'), 'Must have .footnote class');
      assert.ok(footnote.hasText('Design prototype · Fictional case data · Outputs require review'), 'Disclaimer text present');
    });
  });

  describe('8. Mathematical WCAG Contrast Ratios', () => {
    it('verifies Canvas #09090b vs Foreground #f4f4f5 meets WCAG AAA (> 7.0:1)', () => {
      const ratio = contrastRatio('#09090b', '#f4f4f5');
      // Relative luminance calculation yields ~18.2:1
      assert.ok(ratio >= 15.0, `Expected ratio >= 15.0, got ${ratio.toFixed(2)}`);
      assert.ok(ratio >= 7.0, 'Must satisfy WCAG AAA');
    });

    it('verifies Canvas #09090b vs Muted Foreground #a1a1aa meets WCAG AAA (> 7.0:1)', () => {
      const ratio = contrastRatio('#09090b', '#a1a1aa');
      // Relative luminance calculation yields ~9.4:1
      assert.ok(ratio >= 7.0, `Expected ratio >= 7.0, got ${ratio.toFixed(2)}`);
    });

    it('verifies Card Surface #18181b vs Foreground #f4f4f5 meets WCAG AAA (> 7.0:1)', () => {
      const ratio = contrastRatio('#18181b', '#f4f4f5');
      assert.ok(ratio >= 14.0, `Expected ratio >= 14.0, got ${ratio.toFixed(2)}`);
      assert.ok(ratio >= 7.0, 'Must satisfy WCAG AAA');
    });

    it('verifies Card Surface #18181b vs Muted Foreground #a1a1aa meets WCAG AA (> 4.5:1)', () => {
      const ratio = contrastRatio('#18181b', '#a1a1aa');
      assert.ok(ratio >= 4.5, `Expected ratio >= 4.5, got ${ratio.toFixed(2)}`);
    });

    it('verifies High-Contrast Primary CTA: #ffffff vs #09090b meets WCAG AAA (> 7.0:1)', () => {
      const ratio = contrastRatio('#ffffff', '#09090b');
      // Near theoretical maximum of 21:1 (~19.3:1)
      assert.ok(ratio >= 18.0, `Expected ratio >= 18.0, got ${ratio.toFixed(2)}`);
      assert.ok(ratio >= 7.0, 'Must satisfy WCAG AAA');
    });
  });

  describe('9. Compiled CSS Token & Asset Verification', () => {
    it('compiled CSS in .next/static/css contains active dark tokens and no unoverridden light canvas', () => {
      const cssDir = path.resolve(WEB_ROOT, '.next/static/css');
      const files = fs.readdirSync(cssDir).filter(f => f.endsWith('.css'));
      assert.ok(files.length > 0, 'Compiled CSS file must exist in .next/static/css');

      const compiledCss = fs.readFileSync(path.join(cssDir, files[0]), 'utf8');

      // Assert essential tokens exist in compiled CSS bundle
      assert.ok(compiledCss.includes('#09090b'), 'Compiled CSS must contain #09090b base canvas');
      assert.ok(compiledCss.includes('#18181b'), 'Compiled CSS must contain #18181b card surface');
      assert.ok(compiledCss.includes('#27272a'), 'Compiled CSS must contain #27272a border contrast');
      assert.ok(compiledCss.includes('#f4f4f5'), 'Compiled CSS must contain #f4f4f5 primary text');
      assert.ok(compiledCss.includes('#a1a1aa'), 'Compiled CSS must contain #a1a1aa muted text');
      assert.ok(compiledCss.includes('#71717a'), 'Compiled CSS must contain #71717a subtle text/ring');

      // Assert radius token
      assert.ok(compiledCss.includes('0.5rem') || compiledCss.includes('8px'), 'Compiled CSS must contain 0.5rem / 8px radius');
    });
  });

  describe('10. Adversarial Stress Scenarios & Edge Cases', () => {
    it('constrains icon sizing in buttons and badges to prevent layout explosion', () => {
      const buttonHtml = ReactDOMServer.renderToString(React.createElement(Button, null, 'Save'));
      assert.ok(
        buttonHtml.includes('size-4') && buttonHtml.includes('_svg'),
        'Button must constrain unstyled SVGs to size-4 (16px)'
      );

      const badgeHtml = ReactDOMServer.renderToString(React.createElement(Badge, null, 'Tag'));
      assert.ok(
        badgeHtml.includes('size-3') && badgeHtml.includes('svg'),
        'Badge must constrain child SVGs to size-3 (12px)'
      );
    });

    it('enforces aria-invalid destructive styles on Input, Badge, and Button', () => {
      const inputHtml = ReactDOMServer.renderToString(React.createElement(Input, { 'aria-invalid': true }));
      assert.ok(inputHtml.includes('aria-invalid:border-destructive'), 'Input must have aria-invalid:border-destructive');

      const badgeHtml = ReactDOMServer.renderToString(React.createElement(Badge, { 'aria-invalid': true }, 'Invalid'));
      assert.ok(badgeHtml.includes('aria-invalid:border-destructive'), 'Badge must have aria-invalid:border-destructive');

      const buttonHtml = ReactDOMServer.renderToString(React.createElement(Button, { 'aria-invalid': true }, 'Err'));
      assert.ok(buttonHtml.includes('aria-invalid:border-destructive'), 'Button must have aria-invalid:border-destructive');
    });

    it('supports compact Card size="sm" with scaled spacing token', () => {
      const { html } = renderAndInspect(
        React.createElement(Card, { size: 'sm' }, 'Compact')
      );
      assert.ok(html.includes('data-size="sm"'), 'Card must have data-size="sm"');
      assert.ok(html.includes('data-[size=sm]:[--card-spacing:--spacing(3)]'), 'Must adjust card spacing for sm');
    });

    it('supports TabsList line variant with rounded-none and transparent background', () => {
      const { html } = renderAndInspect(
        React.createElement(
          Tabs,
          { value: 'tab1' },
          React.createElement(TabsList, { variant: 'line' }, React.createElement(TabsTrigger, { value: 'tab1' }, 'Tab 1'))
        )
      );
      assert.ok(html.includes('data-[variant=line]:rounded-none'), 'TabsList line variant must have data-[variant=line]:rounded-none');
      assert.ok(html.includes('data-variant="line"'), 'Must have data-variant="line"');
    });

    it('ensures NO legacy light scheme or un-themed paper tokens in medgemma-design.css', () => {
      const designCssPath = path.resolve(WEB_ROOT, 'src/app/medgemma-design.css');
      const content = fs.readFileSync(designCssPath, 'utf8');

      // The root must declare dark color-scheme
      assert.ok(content.includes('color-scheme: dark;'), 'medgemma-design.css must declare color-scheme: dark');
      assert.ok(!content.includes('color-scheme: light;'), 'medgemma-design.css must NOT declare color-scheme: light');
      assert.ok(content.includes('--canvas: #09090b;') || content.includes('--paper: #09090b;'), '--canvas/--paper must be #09090b');
      assert.ok(content.includes('--surface: #18181b;') || content.includes('--white: #18181b;'), '--surface/--white must be #18181b');
      assert.ok(content.includes('--line: #27272a;'), '--line must be #27272a');
      assert.ok(content.includes('--radius: 8px;'), '--radius must be 8px');
    });
  });
});

