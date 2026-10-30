/**
 * Milestone 2: Global Shell & Common Components Verification Test
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

describe('Milestone 2: Global Shell & Common Components', () => {
  const sidebarContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/Sidebar.tsx'), 'utf8');
  const reviewbarContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/ReviewBar.tsx'), 'utf8');
  const topbarContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/Topbar.tsx'), 'utf8');
  const modalContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/ModalRoot.tsx'), 'utf8');
  const toastContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/Toast.tsx'), 'utf8');
  const mobileNavContent = fs.readFileSync(path.join(webRoot, 'src/components/medgemma/MobileNavBar.tsx'), 'utf8');
  const pageContent = fs.readFileSync(path.join(webRoot, 'src/app/page.tsx'), 'utf8');
  const designContent = fs.readFileSync(path.join(webRoot, 'src/app/medgemma-design.css'), 'utf8');

  describe('1. Sidebar Component Specification', () => {
    it('renders brandmark with 32x32px, 9px radius, and high-contrast white + glyph', () => {
      assert.ok(sidebarContent.includes('rounded-[9px] bg-white text-[#09090b]'), 'Sidebar brandmark missing 9px radius / white bg');
      assert.ok(sidebarContent.includes('MedGemma'), 'Sidebar missing MedGemma title');
      assert.ok(sidebarContent.includes('CLINICAL WORKSPACE'), 'Sidebar missing uppercase CLINICAL WORKSPACE subtitle');
      assert.ok(designContent.includes('border-radius: 9px;'), 'medgemma-design.css .brandmark should have border-radius: 9px');
    });

    it('renders interactive workspace selector button with M badge and toast dispatch', () => {
      assert.ok(sidebarContent.includes('aria-label="Workspace switcher: My workspace (Personal · Demo)"'), 'Workspace button missing aria-label');
      assert.ok(sidebarContent.includes('showToast("Workspace switcher: Personal · Demo workspace active")'), 'Workspace button missing toast interaction');
      assert.ok(sidebarContent.includes('My workspace'), 'Missing My workspace text');
    });

    it('renders WORKSPACE uppercase nav group label and active item styling', () => {
      assert.ok(sidebarContent.includes('WORKSPACE'), 'Missing WORKSPACE uppercase section header');
      assert.ok(sidebarContent.includes('bg-[#27272a] text-[#f4f4f5]'), 'Missing active navigation highlight token');
      assert.ok(sidebarContent.includes('count ml-auto text-[10px]'), 'Missing count badge styling');
    });

    it('implements hierarchical expandable subnavigation for Assistant, Imaging, Clinical text', () => {
      assert.ok(sidebarContent.includes('toggleGroup("assistant")'), 'Missing assistant subnav toggle');
      assert.ok(sidebarContent.includes('toggleGroup("imaging")'), 'Missing imaging subnav toggle');
      assert.ok(sidebarContent.includes('toggleGroup("clinical")'), 'Missing clinical subnav toggle');
      assert.ok(sidebarContent.includes('General chat'), 'Missing General chat subitem');
      assert.ok(sidebarContent.includes('Medical Q&amp;A') || sidebarContent.includes('Medical Q&A'), 'Missing Medical Q&A subitem');
      assert.ok(sidebarContent.includes('Image workspace'), 'Missing Image workspace subitem');
      assert.ok(sidebarContent.includes('Longitudinal tracking'), 'Missing Longitudinal tracking subitem');
    });

    it('links Model connection and Dr. Morgan profile chip to corresponding settings tabs', () => {
      assert.ok(sidebarContent.includes('setSettingTab("Model connection")'), 'Model connection card must deep-link to Model connection tab');
      assert.ok(sidebarContent.includes('setSettingTab("Profile")'), 'Profile chip must deep-link to Profile tab');
      assert.ok(sidebarContent.includes('Dr. Morgan'), 'Missing Dr. Morgan clinician profile');
    });
  });

  describe('2. ReviewBar & Topbar Component Specification', () => {
    it('ReviewBar is 40px fixed header with sticky top-0, + badge, and screen picker', () => {
      assert.ok(reviewbarContent.includes('sticky top-0 z-30'), 'ReviewBar must have sticky top-0 z-30');
      assert.ok(reviewbarContent.includes('id="screen-picker"'), 'ReviewBar missing screen-picker id');
      assert.ok(reviewbarContent.includes('15 screens'), 'ReviewBar missing 15 screens text');
    });

    it('Topbar is fixed 72px height with breadcrumb and active case selector', () => {
      assert.ok(topbarContent.includes('h-[72px]'), 'Topbar must have fixed 72px height');
      assert.ok(topbarContent.includes('bg-[#18181b] border-b border-[#27272a]'), 'Topbar missing dark monochrome tokens');
      assert.ok(topbarContent.includes('crumb'), 'Topbar missing crumb class');
      assert.ok(topbarContent.includes('case-picker'), 'Topbar missing case-picker select');
      assert.ok(topbarContent.includes('cases.map'), 'Topbar must dynamically map cases from store');
      assert.ok(topbarContent.includes('Case 024 · Chest review'), 'Topbar must support Case 024 default');
      assert.ok(topbarContent.includes('w-[34px] h-[34px]'), 'Search button must be 34x34px');
      assert.ok(topbarContent.includes('w-[29px] h-[29px]'), 'Avatar must be 29x29px');
    });
  });

  describe('3. Modals, Toasts & Responsive Shell', () => {
    it('ModalRoot provides permanent #modal-root with Escape listener and focus trapping', () => {
      assert.ok(modalContent.includes('id="modal-root"'), 'ModalRoot missing permanent #modal-root container');
      assert.ok(modalContent.includes('e.key === "Escape"'), 'ModalRoot missing Escape key listener');
      assert.ok(modalContent.includes('e.key === "Tab"'), 'ModalRoot missing Tab focus trap');
      assert.ok(modalContent.includes('sourcePayload'), 'ModalRoot missing source payload inspector');
    });

    it('Toast provides permanent polite live region #toast-region with click dismiss', () => {
      assert.ok(toastContent.includes('id="toast-region"'), 'Toast missing permanent #toast-region container');
      assert.ok(toastContent.includes('aria-live="polite"'), 'Toast missing aria-live="polite"');
      assert.ok(toastContent.includes('onClick={() => showToast("")}'), 'Toast missing click-to-dismiss handler');
    });

    it('MobileNavBar provides responsive bottom navigation bar and drawer for <850px', () => {
      assert.ok(mobileNavContent.includes('min-[851px]:hidden'), 'MobileNavBar must be hidden on screens > 850px');
      assert.ok(mobileNavContent.includes('Overview'), 'MobileNavBar missing Overview action');
      assert.ok(mobileNavContent.includes('Cases'), 'MobileNavBar missing Cases action');
      assert.ok(mobileNavContent.includes('Imaging'), 'MobileNavBar missing Imaging action');
      assert.ok(mobileNavContent.includes('Assistant'), 'MobileNavBar missing Assistant action');
      assert.ok(mobileNavContent.includes('More'), 'MobileNavBar missing More drawer trigger');
    });

    it('page.tsx mounts MobileNavBar and provides bottom clearance for mobile nav', () => {
      assert.ok(pageContent.includes('MobileNavBar'), 'page.tsx must import and mount MobileNavBar');
      assert.ok(pageContent.includes('max-[850px]:pb-20'), 'page.tsx content missing mobile nav bottom clearance');
    });
  });
});

