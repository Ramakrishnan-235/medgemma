/**
 * Milestone 1: Design System & Token Infrastructure Verification Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

describe('Milestone 1: Design System & Token Infrastructure', () => {
  const layoutContent = fs.readFileSync(path.join(webRoot, 'src/app/layout.tsx'), 'utf8');
  const pageContent = fs.readFileSync(path.join(webRoot, 'src/app/page.tsx'), 'utf8');
  const globalsContent = fs.readFileSync(path.join(webRoot, 'src/app/globals.css'), 'utf8');
  const designContent = fs.readFileSync(path.join(webRoot, 'src/app/medgemma-design.css'), 'utf8');
  const packageContent = JSON.parse(fs.readFileSync(path.join(webRoot, 'package.json'), 'utf8'));

  describe('1. Root HTML & Shell Defaults', () => {
    it('layout.tsx has className="dark" on <html>', () => {
      assert.ok(
        layoutContent.includes('<html lang="en" className="dark">'),
        'Expected <html lang="en" className="dark"> in layout.tsx'
      );
    });

    it('layout.tsx body has bg-background and text-foreground', () => {
      assert.ok(
        layoutContent.includes('bg-background text-foreground'),
        'Expected body className to contain bg-background text-foreground'
      );
    });

    it('page.tsx wrapper has bg-background and text-foreground', () => {
      assert.ok(
        pageContent.includes('bg-background text-foreground'),
        'Expected page.tsx wrapper to use bg-background text-foreground'
      );
      assert.ok(
        !pageContent.includes('bg-[#fafaf9] text-[#18181b]'),
        'page.tsx should not retain hardcoded light hex classes'
      );
    });
  });

  describe('2. Tailwind v4 & Design Tokens in globals.css', () => {
    it('globals.css defines base canvas #09090b', () => {
      assert.ok(globalsContent.includes('--background: #09090b'), 'Expected --background: #09090b');
      assert.ok(globalsContent.includes('--sidebar: #09090b'), 'Expected --sidebar: #09090b');
    });

    it('globals.css defines card/surface #18181b', () => {
      assert.ok(globalsContent.includes('--card: #18181b'), 'Expected --card: #18181b');
      assert.ok(globalsContent.includes('--popover: #18181b'), 'Expected --popover: #18181b');
    });

    it('globals.css defines 1px border contrast #27272a', () => {
      assert.ok(globalsContent.includes('--border: #27272a'), 'Expected --border: #27272a');
      assert.ok(globalsContent.includes('--input: #27272a'), 'Expected --input: #27272a');
    });

    it('globals.css defines high-contrast primary CTA #ffffff background with #09090b text', () => {
      assert.ok(globalsContent.includes('--primary: #ffffff'), 'Expected --primary: #ffffff');
      assert.ok(globalsContent.includes('--primary-foreground: #09090b'), 'Expected --primary-foreground: #09090b');
    });

    it('globals.css defines secondary tokens with #27272a background and #f4f4f5 text', () => {
      assert.ok(globalsContent.includes('--secondary: #27272a'), 'Expected --secondary: #27272a');
      assert.ok(globalsContent.includes('--secondary-foreground: #f4f4f5'), 'Expected --secondary-foreground: #f4f4f5');
    });

    it('globals.css defines text tokens #f4f4f5 foreground and #a1a1aa muted', () => {
      assert.ok(globalsContent.includes('--foreground: #f4f4f5'), 'Expected --foreground: #f4f4f5');
      assert.ok(globalsContent.includes('--muted-foreground: #a1a1aa'), 'Expected --muted-foreground: #a1a1aa');
      assert.ok(globalsContent.includes('--ring: #71717a'), 'Expected --ring: #71717a');
    });

    it('globals.css defines radius as 0.5rem (8px)', () => {
      assert.ok(globalsContent.includes('--radius: 0.5rem'), 'Expected --radius: 0.5rem');
    });
  });

  describe('3. medgemma-design.css Overhaul', () => {
    it('defines dark :root variables and color-scheme: dark', () => {
      assert.ok(designContent.includes('--canvas: #09090b'), 'Expected --canvas: #09090b');
      assert.ok(designContent.includes('--surface: #18181b'), 'Expected --surface: #18181b');
      assert.ok(designContent.includes('--card: #18181b'), 'Expected --card: #18181b');
      assert.ok(
        designContent.includes('--paper: var(--canvas)') || designContent.includes('--paper: #09090b'),
        'Expected --paper token'
      );
      assert.ok(
        designContent.includes('--white: var(--surface)') || designContent.includes('--white: #18181b'),
        'Expected --white alias'
      );
      assert.ok(designContent.includes('--ink: #f4f4f5'), 'Expected --ink: #f4f4f5');
      assert.ok(designContent.includes('--sub: #a1a1aa'), 'Expected --sub: #a1a1aa');
      assert.ok(designContent.includes('--line: #27272a'), 'Expected --line: #27272a');
      assert.ok(designContent.includes('--soft: #27272a'), 'Expected --soft: #27272a');
      assert.ok(designContent.includes('--radius: 8px'), 'Expected --radius: 8px');
      assert.ok(designContent.includes('color-scheme: dark'), 'Expected color-scheme: dark');
    });

    it('buttons styled with monochrome tokens', () => {
      assert.ok(designContent.includes('.btn.black'), 'Expected .btn.black rule');
      assert.ok(designContent.includes('background: #ffffff'), 'Expected .btn.black background #ffffff');
      assert.ok(designContent.includes('color: #09090b'), 'Expected .btn.black color #09090b');
      assert.ok(designContent.includes('.btn'), 'Expected .btn rule');
      assert.ok(designContent.includes('background: #18181b'), 'Expected .btn background #18181b');
      assert.ok(designContent.includes('border: 1px solid #27272a'), 'Expected .btn border #27272a');
    });

    it('table headers and rows styled with monochrome tokens', () => {
      assert.ok(designContent.includes('th'), 'Expected th rule');
      assert.ok(designContent.includes('background: #18181b'), 'Expected th background #18181b');
      assert.ok(designContent.includes('border-bottom: 1px solid #27272a'), 'Expected th border #27272a');
      assert.ok(designContent.includes('color: #a1a1aa'), 'Expected th color #a1a1aa');
      assert.ok(designContent.includes('td'), 'Expected td rule');
      assert.ok(designContent.includes('color: #f4f4f5'), 'Expected td color #f4f4f5');
    });

    it('form inputs and selects styled with #09090b background and #27272a border', () => {
      assert.ok(designContent.includes('.field input'), 'Expected .field input rule');
      assert.ok(designContent.includes('background: #09090b'), 'Expected field input background #09090b');
      assert.ok(designContent.includes('border: 1px solid #27272a'), 'Expected field input border #27272a');
    });
  });

  describe('4. Scripts & Validation', () => {
    it('package.json has lint script configured for static validation', () => {
      assert.ok(
        packageContent.scripts.lint && packageContent.scripts.lint.includes('tsc'),
        'Expected lint script to execute static type checking/linting via tsc'
      );
    });

    it('package.json has type-check script configured', () => {
      assert.equal(packageContent.scripts['type-check'], 'tsc --noEmit');
    });

    it('package.json has build script configured', () => {
      assert.equal(packageContent.scripts.build, 'next build --webpack');
    });
  });
});
