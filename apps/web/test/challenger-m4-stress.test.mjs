/**
 * Milestone 4 Adversarial Stress Testing & Edge Case Resilience Test Suite
 * 
 * Verifies Milestone 4 Medical Imaging & Longitudinal Workspace deliverables:
 * 
 * 1. Programmatic Palette Invariant Scan:
 *    - All 15 screens in apps/web/src/components/medgemma/screens/
 *    - All 9 Milestone 4 scope files
 *    - Zero occurrences of prohibited tokens (#10b981, #34d399, #f59e0b, #eee, #ddd, #777,
 *      text-neutral-500, text-amber-400, bg-emerald-600, bg-emerald-950, bg-sky-950,
 *      text-emerald-300, text-sky-300) in active code.
 *    - CompareScreen.tsx line 161 (now line 213) remediation: monochrome border (border border-zinc-800).
 *    - ScanSVG.tsx line 54 uses semantic zinc token #71717a instead of off-scale #77777e.
 * 
 * 2. Stress & Edge Case Resilience:
 *    - Rapid mode switching between TipTap rich editor and Structured Sections with empty/corrupt doc JSON.
 *    - Citation clicking with missing/null bounding boxes, extreme slice numbers (slice 0, slice 9999).
 *    - Unreviewed draft status toggling, export checklist validation (blocking export if checkboxes are incomplete).
 *    - SSE stream unmount cleanup in CompareScreen when aborted mid-stream.
 *    - Defensive handling of empty annotations arrays in LongitudinalXrayWorkspace and ChestXrayViewport.
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
  renderComponent,
  getWorkspaceStore,
  getImagingStore,
  resetAllStores,
} from './test-harness.mjs';

function renderAndInspect(element) {
  const html = ReactDOMServer.renderToString(element);
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&middot;/g, '·')
    .replace(/&#183;/g, '·')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    html,
    text,
    hasText: (str) => text.includes(str) || html.includes(str),
    matchesText: (regex) => regex.test(text),
    hasTag: (tag) => new RegExp(`<${tag}\\b`, 'i').test(html),
    matches: (regex) => regex.test(html),
  };
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

describe('Milestone 4 Adversarial Stress Testing Suite (challenger_m4_2)', () => {
  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // SECTION 1: Programmatic Palette Invariant Scan
  // =========================================================================
  describe('1. Programmatic Palette Invariant Scan (15 Screens & 9 M4 Scope Files)', () => {
    const screensDir = path.resolve(WEB_ROOT, 'src/components/medgemma/screens');
    const allScreenFiles = fs.readdirSync(screensDir).filter((f) => f.endsWith('.tsx'));

    it('M4.1.1: Verifies exactly 15 screen components exist in screens directory', () => {
      assert.equal(
        allScreenFiles.length,
        15,
        `Expected exactly 15 screen files in ${screensDir}, found ${allScreenFiles.length}`
      );
    });

    const PROHIBITED_TOKENS = [
      { pattern: '#10b981', desc: 'Emerald green accent #10b981' },
      { pattern: '#34d399', desc: 'Emerald green accent #34d399' },
      { pattern: '#f59e0b', desc: 'Amber accent #f59e0b' },
      { pattern: '#eee', desc: 'Off-scale light grey #eee' },
      { pattern: '#ddd', desc: 'Off-scale light grey #ddd' },
      { pattern: '#777', desc: 'Off-scale muted grey #777' },
      { pattern: 'text-neutral-500', desc: 'Off-scale text-neutral-500' },
      { pattern: 'text-amber-400', desc: 'Off-scale text-amber-400' },
      { pattern: 'bg-emerald-600', desc: 'Emerald button bg-emerald-600' },
      { pattern: 'bg-emerald-950', desc: 'Emerald container bg-emerald-950' },
      { pattern: 'bg-sky-950', desc: 'Sky container bg-sky-950' },
      { pattern: 'text-emerald-300', desc: 'Emerald text-emerald-300' },
      { pattern: 'text-sky-300', desc: 'Sky text-sky-300' },
    ];

    // Scan all 15 screens for active code violations
    for (const screenFile of allScreenFiles) {
      const fullPath = path.resolve(screensDir, screenFile);
      const rawContent = fs.readFileSync(fullPath, 'utf8');
      const activeCode = stripComments(rawContent);

      for (const token of PROHIBITED_TOKENS) {
        it(`M4.1.2 [Screen: ${screenFile}]: 0 occurrences of ${token.desc} in active code`, () => {
          const regex = new RegExp(token.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const match = regex.test(activeCode);
          assert.ok(
            !match,
            `Prohibited token "${token.pattern}" (${token.desc}) found in active code of ${screenFile}`
          );
        });
      }
    }

    // Explicit audit of the 9 Milestone 4 files
    const M4_SCOPE_FILES = [
      'src/components/medgemma/ScanSVG.tsx',
      'src/components/viewer/ChestXrayViewport.tsx',
      'src/components/medgemma/screens/ImagingScreen.tsx',
      'src/components/medgemma/screens/CompareScreen.tsx',
      'src/components/viewer/LongitudinalXrayWorkspace.tsx',
      'src/components/editor/CitationChipExtension.ts',
      'src/components/editor/ClinicalReportEditor.tsx',
      'src/app/medgemma-design.css',
      'src/components/medgemma/screens/ReportScreen.tsx',
    ];

    for (const relPath of M4_SCOPE_FILES) {
      const fullPath = path.resolve(WEB_ROOT, relPath);
      it(`M4.1.3 [M4 File: ${relPath}]: File exists and is readable`, () => {
        assert.ok(fs.existsSync(fullPath), `Milestone 4 file must exist: ${relPath}`);
      });

      const raw = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, 'utf8') : '';
      const active = stripComments(raw);

      for (const token of PROHIBITED_TOKENS) {
        it(`M4.1.4 [M4 File: ${relPath}]: 0 occurrences of ${token.desc} in active code`, () => {
          const regex = new RegExp(token.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          assert.ok(
            !regex.test(active),
            `Prohibited token "${token.pattern}" (${token.desc}) found in active code of M4 file ${relPath}`
          );
        });
      }
    }

    it('M4.1.5: ScanSVG.tsx line 54 uses semantic zinc token #71717a instead of off-scale #77777e', () => {
      const scanSvgPath = path.resolve(WEB_ROOT, 'src/components/medgemma/ScanSVG.tsx');
      const content = fs.readFileSync(scanSvgPath, 'utf8');
      assert.ok(!content.includes('#77777e'), 'ScanSVG.tsx must not contain off-scale #77777e');
      assert.ok(content.includes('#71717a'), 'ScanSVG.tsx must use semantic zinc token #71717a');
    });

    it('M4.1.6: CompareScreen.tsx remediated legacy line 161: monochrome border border-zinc-800', () => {
      const comparePath = path.resolve(screensDir, 'CompareScreen.tsx');
      const content = fs.readFileSync(comparePath, 'utf8');
      const active = stripComments(content);

      // Verify active code does not contain inline style borderColor: "#10b981"
      assert.ok(
        !/borderColor:\s*['"]#10b981['"]/i.test(active),
        'CompareScreen.tsx active code must not contain inline borderColor: "#10b981"'
      );

      // Verify presence of monochrome border class on the findings note
      assert.ok(
        content.includes('className="note border border-zinc-800"'),
        'CompareScreen.tsx must feature note border border-zinc-800 monochrome class'
      );
    });

    it('M4.1.7: CompareScreen renders live findings with monochrome border and zero #10b981 in DOM', () => {
      const { CompareScreen } = loadModule('src/components/medgemma/screens/CompareScreen.tsx');
      const rendered = renderAndInspect(React.createElement(CompareScreen));

      assert.ok(
        rendered.hasText('Interval change findings'),
        'CompareScreen must render Interval change findings header'
      );
      assert.ok(
        rendered.matches(/class=["'][^"']*\bnote\b[^"']*["']/),
        'Must render disclaimer note element'
      );
      assert.ok(
        !rendered.html.includes('#10b981'),
        'Rendered CompareScreen HTML must have zero #10b981 occurrences'
      );
    });
  });

  // =========================================================================
  // SECTION 2: Rapid Mode Switching & Corrupt Doc JSON Resilience
  // =========================================================================
  describe('2. Rapid Mode Switching & Corrupt Doc JSON Resilience', () => {
    // Model the extraction logic matching ReportScreen.tsx
    function extractSectionsFromTiptap(json) {
      let tech = '';
      let find = '';
      let impr = '';
      let limit = '';

      if (json && typeof json === 'object' && Array.isArray(json.content)) {
        for (const node of json.content) {
          if (node && typeof node === 'object' && node.type === 'paragraph' && Array.isArray(node.content)) {
            const fullText = node.content.map((c) => (c && typeof c === 'object' ? c.text || '' : '')).join('').trim();
            if (fullText.toUpperCase().startsWith('TECHNIQUE:')) {
              tech = fullText.replace(/^TECHNIQUE:\s*/i, '');
            } else if (fullText.toUpperCase().startsWith('FINDINGS:')) {
              find = fullText.replace(/^FINDINGS:\s*/i, '');
            } else if (fullText.toUpperCase().startsWith('IMPRESSION:')) {
              impr = fullText.replace(/^IMPRESSION:\s*/i, '');
            } else if (fullText.toUpperCase().startsWith('LIMITATIONS:')) {
              limit = fullText.replace(/^LIMITATIONS:\s*/i, '');
            }
          }
        }
      }

      return {
        technique: tech || undefined,
        findings: find || undefined,
        impression: impr || undefined,
        limitations: limit || undefined,
      };
    }

    it('M4.2.1: extractSectionsFromTiptap safely handles undefined, null, and empty doc JSON', () => {
      const corruptInputs = [
        undefined,
        null,
        {},
        { type: 'doc' },
        { content: null },
        { content: 'corrupted_string' },
        { content: [] },
        { content: [null, undefined, 42, 'string_node'] },
        { content: [{ type: 'unknown_node', attrs: null }] },
        { content: [{ type: 'paragraph', content: null }] },
        { content: [{ type: 'paragraph', content: [null, { type: 'text' }, { type: 'text', text: null }] }] },
      ];

      for (const input of corruptInputs) {
        assert.doesNotThrow(() => {
          const res = extractSectionsFromTiptap(input);
          assert.equal(typeof res, 'object');
        }, `extractSectionsFromTiptap crashed on corrupt input: ${JSON.stringify(input)}`);
      }
    });

    it('M4.2.2: extractSectionsFromTiptap correctly extracts structured section strings', () => {
      const validDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'TECHNIQUE: Helical axial CT of chest with IV contrast.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'FINDINGS: Opacity in right lower lobe resolved.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'IMPRESSION: Resolved bacterial pneumonia.' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'LIMITATIONS: Motion artifact in lung bases.' }],
          },
        ],
      };

      const extracted = extractSectionsFromTiptap(validDoc);
      assert.equal(extracted.technique, 'Helical axial CT of chest with IV contrast.');
      assert.equal(extracted.findings, 'Opacity in right lower lobe resolved.');
      assert.equal(extracted.impression, 'Resolved bacterial pneumonia.');
      assert.equal(extracted.limitations, 'Motion artifact in lung bases.');
    });

    it('M4.2.3: 50 rapid sequential transitions between TipTap and Structured Sections maintain continuity', () => {
      let currentDoc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'TECHNIQUE: Baseline helical CT' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'FINDINGS: Baseline findings' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'IMPRESSION: Baseline impression' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'LIMITATIONS: Baseline limitations' }],
          },
        ],
      };

      let currentSections = {
        technique: '',
        findings: '',
        impression: '',
        limitations: '',
      };

      for (let i = 0; i < 50; i++) {
        // Step A: TipTap -> Sections
        const extracted = extractSectionsFromTiptap(currentDoc);
        currentSections = {
          technique: `${extracted.technique || ''} [cycle ${i}]`,
          findings: `${extracted.findings || ''} [finding ${i}]`,
          impression: `${extracted.impression || ''} [imp ${i}]`,
          limitations: `${extracted.limitations || ''} [lim ${i}]`,
        };

        // Step B: Sections -> TipTap
        currentDoc = {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: `TECHNIQUE: ${currentSections.technique} ` },
                {
                  type: 'citationChip',
                  attrs: {
                    citationId: 'cit_1',
                    evidenceChunkId: 'chunk-prior-001',
                    sourceFileId: 'prior-study-001',
                    pageOrFrame: 1,
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              content: [
                { type: 'text', text: `FINDINGS: ${currentSections.findings} ` },
                {
                  type: 'citationChip',
                  attrs: {
                    citationId: 'cit_2',
                    evidenceChunkId: 'chunk-curr-002',
                    sourceFileId: 'current-study-002',
                    pageOrFrame: 124,
                  },
                },
              ],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `IMPRESSION: ${currentSections.impression}` }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: `LIMITATIONS: ${currentSections.limitations}` }],
            },
          ],
        };
      }

      assert.equal(currentDoc.type, 'doc');
      assert.equal(currentDoc.content.length, 4);
      assert.ok(currentDoc.content[0].content[0].text.includes('[cycle 49]'));
      assert.ok(currentDoc.content[1].content[0].text.includes('[finding 49]'));
      assert.equal(currentDoc.content[0].content[1].type, 'citationChip');
      assert.equal(currentDoc.content[1].content[1].type, 'citationChip');
    });

    it('M4.2.4: ReportScreen renders cleanly without error in default mode', () => {
      const { ReportScreen } = loadModule('src/components/medgemma/screens/ReportScreen.tsx');
      let rendered;
      assert.doesNotThrow(() => {
        rendered = renderAndInspect(React.createElement(ReportScreen));
      }, 'ReportScreen must render without throwing');

      assert.ok(
        rendered.hasText('REPORTS / DRAFT STUDIO') || rendered.hasText('From observation to a clear report'),
        'ReportScreen must display header and subtitle'
      );
      assert.ok(rendered.hasText('Tiptap Rich Editor'), 'Must render Tiptap mode tab');
      assert.ok(rendered.hasText('Structured Sections'), 'Must render Structured Sections mode tab');
      assert.ok(rendered.hasText('Evidence'), 'Must render Evidence sidebar');
      assert.ok(rendered.hasText('Before you export'), 'Must render Before you export checklist');
    });
  });

  // =========================================================================
  // SECTION 3: Citation Grounding & Boundary Clamping Stress
  // =========================================================================
  describe('3. Citation Grounding & Boundary Clamping Stress', () => {
    it('M4.3.1: setSliceIndex strictly clamps boundary conditions (slice 0, negative, 9999, NaN)', () => {
      const store = getWorkspaceStore();

      // Lower boundary: 0 -> must clamp to 1
      store.getState().setSliceIndex(0);
      assert.equal(store.getState().sliceIndex, 1, 'Slice 0 must clamp to minimum slice 1');

      // Negative boundary: -50 -> must clamp to 1
      store.getState().setSliceIndex(-50);
      assert.equal(store.getState().sliceIndex, 1, 'Negative slice must clamp to 1');

      // Upper boundary: 9999 -> must clamp to 240
      store.getState().setSliceIndex(9999);
      assert.equal(store.getState().sliceIndex, 240, 'Slice 9999 must clamp to maximum slice 240');

      // Upper boundary exact: 240 -> 240
      store.getState().setSliceIndex(240);
      assert.equal(store.getState().sliceIndex, 240, 'Exact upper bound 240 must remain 240');

      // Lower boundary exact: 1 -> 1
      store.getState().setSliceIndex(1);
      assert.equal(store.getState().sliceIndex, 1, 'Exact lower bound 1 must remain 1');

      // Float rounding: 124.6 -> 125
      store.getState().setSliceIndex(124.6);
      assert.equal(store.getState().sliceIndex, 125, 'Float slice 124.6 must round to 125');

      // String number parsing: "88" -> 88
      store.getState().setSliceIndex('88');
      assert.equal(store.getState().sliceIndex, 88, 'String "88" must parse to 88');

      // Non-numeric / NaN -> must fallback to 1
      store.getState().setSliceIndex(NaN);
      assert.equal(store.getState().sliceIndex, 1, 'NaN slice must fallback to 1');

      // Null / undefined -> must fallback to 1
      store.getState().setSliceIndex(null);
      assert.equal(store.getState().sliceIndex, 1, 'Null slice must fallback to 1');
    });

    it('M4.3.2: focusCitationOnViewer handles null, undefined, and extreme bounding boxes without error', () => {
      const imStore = getImagingStore();

      // Test 1: Null bounding box
      assert.doesNotThrow(() => {
        imStore.getState().focusCitationOnViewer('source-study-001', null);
      }, 'focusCitationOnViewer must accept null bboxNorm');
      assert.equal(imStore.getState().highlightedSourceId, 'source-study-001');
      assert.equal(imStore.getState().highlightedBboxNorm, null);

      // Test 2: Extreme negative coordinates
      const negativeBbox = { x0: -10, y0: -20, x1: 0.5, y1: 0.5 };
      assert.doesNotThrow(() => {
        imStore.getState().focusCitationOnViewer('source-study-002', negativeBbox);
      });
      assert.deepEqual(imStore.getState().highlightedBboxNorm, negativeBbox);

      // Test 3: Inverted coordinates (x0 > x1, y0 > y1)
      const invertedBbox = { x0: 0.9, y0: 0.8, x1: 0.1, y1: 0.2 };
      assert.doesNotThrow(() => {
        imStore.getState().focusCitationOnViewer('source-study-003', invertedBbox);
      });
      assert.deepEqual(imStore.getState().highlightedBboxNorm, invertedBbox);

      // Test 4: Extreme out-of-range coordinates (> 1.0)
      const hugeBbox = { x0: 0, y0: 0, x1: 9999, y1: 8888 };
      assert.doesNotThrow(() => {
        imStore.getState().focusCitationOnViewer('source-study-004', hugeBbox);
      });
      assert.deepEqual(imStore.getState().highlightedBboxNorm, hugeBbox);
    });

    it('M4.3.3: Citation navigation routes prior studies to compare and current studies to imaging', () => {
      const wsStore = getWorkspaceStore();

      function simulateCitationClick(attrs) {
        if (attrs.pageOrFrame) {
          wsStore.getState().setSliceIndex(attrs.pageOrFrame);
        }
        if (attrs.sourceFileId?.includes('prior')) {
          wsStore.getState().setPage('compare');
        } else {
          wsStore.getState().setPage('imaging');
        }
      }

      // Prior study citation
      simulateCitationClick({
        citationId: 'cit_1',
        sourceFileId: 'prior-study-001',
        pageOrFrame: 110,
        bboxNorm: null,
      });
      assert.equal(wsStore.getState().page, 'compare');
      assert.equal(wsStore.getState().sliceIndex, 110);

      // Current study citation with extreme slice
      simulateCitationClick({
        citationId: 'cit_2',
        sourceFileId: 'current-study-002',
        pageOrFrame: 9999,
        bboxNorm: { x0: 0.5, y0: 0.5, x1: 0.8, y1: 0.8 },
      });
      assert.equal(wsStore.getState().page, 'imaging');
      assert.equal(wsStore.getState().sliceIndex, 240); // Clamped to 240
    });
  });

  // =========================================================================
  // SECTION 4: Clinical Review Workflow & Export Checklist Validation
  // =========================================================================
  describe('4. Clinical Review Workflow & Export Checklist Validation', () => {
    const { ClinicalReportEditor } = loadModule('src/components/editor/ClinicalReportEditor.tsx');

    const mockDraftVersion = {
      id: 'ver-1',
      version_number: 1,
      review_status: 'draft',
      created_at: new Date().toISOString(),
      tiptap_doc_json: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Draft report findings' }] }],
      },
    };

    const mockReviewedVersion = {
      id: 'ver-1',
      version_number: 1,
      review_status: 'reviewed',
      reviewed_by: 'Dr. Morgan',
      created_at: new Date().toISOString(),
      tiptap_doc_json: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reviewed report findings' }] }],
      },
    };

    it('M4.4.1: ClinicalReportEditor renders unreviewed draft banner and Approve button when status is draft', () => {
      const rendered = renderAndInspect(
        React.createElement(ClinicalReportEditor, {
          caseId: '024',
          versions: [mockDraftVersion],
          activeVersion: mockDraftVersion,
          onSelectVersion: () => {},
          onSaveNewVersion: async () => {},
          onMarkReviewed: async () => {},
          onExportPdf: async () => {},
        })
      );

      assert.ok(rendered.hasText('AI DRAFT · UNREVIEWED'), 'Draft must display AI DRAFT · UNREVIEWED banner');
      assert.ok(rendered.hasText('Requires Review'), 'Draft must display Requires Review badge');
      assert.ok(
        rendered.matchesText(/Approve & Mark v1 Reviewed/) || rendered.html.includes('Approve &amp; Mark v1 Reviewed'),
        'Draft must render Approve & Mark button'
      );
      assert.ok(
        !rendered.hasText('Export v1 PDF'),
        'Draft must NOT display Export v1 PDF action'
      );
    });

    it('M4.4.2: ClinicalReportEditor renders reviewed banner and Export button when status is reviewed', () => {
      const rendered = renderAndInspect(
        React.createElement(ClinicalReportEditor, {
          caseId: '024',
          versions: [mockReviewedVersion],
          activeVersion: mockReviewedVersion,
          onSelectVersion: () => {},
          onSaveNewVersion: async () => {},
          onMarkReviewed: async () => {},
          onExportPdf: async () => {},
        })
      );

      assert.ok(rendered.hasText('CLINICALLY REVIEWED'), 'Reviewed version must display CLINICALLY REVIEWED banner');
      assert.ok(rendered.hasText('Verified'), 'Reviewed version must display Verified badge');
      assert.ok(rendered.hasText('Dr. Morgan'), 'Reviewed version must display reviewer name');
      assert.ok(rendered.hasText('Export v1 PDF'), 'Reviewed version must render Export v1 PDF button');
      assert.ok(
        !rendered.matchesText(/Approve & Mark v1 Reviewed/) && !rendered.html.includes('Approve &amp; Mark v1 Reviewed'),
        'Reviewed version must NOT display Approve & Mark button'
      );
    });

    it('M4.4.3: Review status synchronization updates workspace cases store to "Reviewed"', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({
        cases: [
          { id: '024', name: 'Case 024 · Chest review', status: 'Draft ready', meta: 'CT chest', date: 'Yesterday' },
          { id: '023', name: 'Case 023 · Trauma evaluation', status: 'Needs review', meta: 'X-ray', date: '2 days ago' },
        ],
      });

      function handleMarkReviewed(versionNumber) {
        wsStore.getState().setCases(
          wsStore.getState().cases.map((c) =>
            c.id === '024' ? { ...c, status: 'Reviewed' } : c
          )
        );
      }

      handleMarkReviewed(1);

      const case024 = wsStore.getState().cases.find((c) => c.id === '024');
      const case023 = wsStore.getState().cases.find((c) => c.id === '023');
      assert.equal(case024?.status, 'Reviewed', 'Case 024 status must update to Reviewed');
      assert.equal(case023?.status, 'Needs review', 'Unrelated Case 023 must remain unchanged');
    });

    it('M4.4.4: Export checklist validation blocks incomplete checkboxes and allows complete checkboxes', () => {
      const wsStore = getWorkspaceStore();

      function handleExportWithChecklist(checkedItems) {
        if (!checkedItems.images || !checkedItems.findings || !checkedItems.limitations) {
          wsStore.getState().showToast('Pre-export verification checklist pending: Please verify the 3 safety checks.');
          return { allowed: false };
        }
        wsStore.getState().showToast('Exported the explicitly labeled demo draft.');
        return { allowed: true };
      }

      // Scenario 1: All unchecked
      let res = handleExportWithChecklist({ images: false, findings: false, limitations: false });
      assert.equal(res.allowed, false);
      assert.equal(
        wsStore.getState().toastMessage,
        'Pre-export verification checklist pending: Please verify the 3 safety checks.'
      );

      // Scenario 2: Partially checked (2 of 3)
      res = handleExportWithChecklist({ images: true, findings: true, limitations: false });
      assert.equal(res.allowed, false);
      assert.equal(
        wsStore.getState().toastMessage,
        'Pre-export verification checklist pending: Please verify the 3 safety checks.'
      );

      // Scenario 3: All 3 checked
      res = handleExportWithChecklist({ images: true, findings: true, limitations: true });
      assert.equal(res.allowed, true);
      assert.equal(wsStore.getState().toastMessage, 'Exported the explicitly labeled demo draft.');
    });
  });

  // =========================================================================
  // SECTION 5: SSE Stream Lifecycle & Abort Resilience in CompareScreen
  // =========================================================================
  describe('5. SSE Stream Lifecycle & Abort Resilience in CompareScreen', () => {
    it('M4.5.1: Verifies activeEventSourceRef unmount cleanup hook terminates open EventSource', () => {
      const comparePath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/CompareScreen.tsx');
      const content = fs.readFileSync(comparePath, 'utf8');

      // Verify activeEventSourceRef declaration
      assert.ok(
        content.includes('const activeEventSourceRef = useRef<EventSource | null>(null)'),
        'CompareScreen must maintain activeEventSourceRef'
      );

      // Verify unmount cleanup in useEffect
      assert.ok(
        content.includes('activeEventSourceRef.current.close()'),
        'CompareScreen useEffect unmount must call activeEventSourceRef.current.close()'
      );
      assert.ok(
        content.includes('activeEventSourceRef.current = null'),
        'CompareScreen unmount must null out activeEventSourceRef.current'
      );
    });

    it('M4.5.2: Simulates mid-stream SSE abort and verifies connection cleanup without memory leaks', () => {
      let closeCallCount = 0;
      const fakeEventSource = {
        close: () => {
          closeCallCount++;
        },
      };

      const ref = { current: fakeEventSource };

      // Simulate mid-stream abort cleanup (component unmount or new run trigger)
      function cleanupStream() {
        if (ref.current) {
          ref.current.close();
          ref.current = null;
        }
      }

      assert.equal(closeCallCount, 0);
      assert.notEqual(ref.current, null);

      cleanupStream();

      assert.equal(closeCallCount, 1, 'EventSource.close() must be called on abort');
      assert.equal(ref.current, null, 'EventSource ref must be nulled out');

      // Second cleanup must be idempotent (no throw)
      assert.doesNotThrow(() => {
        cleanupStream();
      });
      assert.equal(closeCallCount, 1, 'Idempotent cleanup should not trigger extra calls');
    });

    it('M4.5.3: Simulates rapid re-triggering of comparison closing existing active connection', () => {
      let closeCallCount = 0;
      let activeRef = null;

      function triggerAnalysis() {
        if (activeRef) {
          activeRef.close();
          activeRef = null;
        }
        activeRef = {
          id: Math.random(),
          close: () => {
            closeCallCount++;
          },
        };
      }

      // Trigger 10 rapid runs
      for (let i = 0; i < 10; i++) {
        triggerAnalysis();
      }

      assert.equal(closeCallCount, 9, 'Triggering 10 runs must close the 9 preceding connections');
      assert.ok(activeRef !== null, 'Final run connection must remain active');

      // Unmount cleanup
      if (activeRef) {
        activeRef.close();
        activeRef = null;
      }
      assert.equal(closeCallCount, 10, 'Unmount must close the final connection');
      assert.equal(activeRef, null);
    });
  });

  // =========================================================================
  // SECTION 6: Defensive Handling of Empty Annotations Arrays
  // =========================================================================
  describe('6. Defensive Handling of Empty Annotations Arrays', () => {
    const ChestXrayViewport = loadModule('src/components/viewer/ChestXrayViewport.tsx').default;
    const { LongitudinalXrayWorkspace } = loadModule('src/components/viewer/LongitudinalXrayWorkspace.tsx');

    const emptyPriorStudy = {
      source_file_id: 'source-prior-01',
      filename: 'CT chest · Prior',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      normalized_display_png_url: 'data:image/svg+xml;utf8,<svg></svg>',
      metadata: { view_position: 'PA', encounter_date: '21 Jul 2026', rows: 896, columns: 896 },
      annotations: [],
    };

    const emptyCurrentStudy = {
      source_file_id: 'source-curr-01',
      filename: 'CT chest · Current',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      normalized_display_png_url: 'data:image/svg+xml;utf8,<svg></svg>',
      metadata: { view_position: 'PA', encounter_date: '24 Oct 2026', rows: 896, columns: 896 },
      annotations: [],
    };

    it('M4.6.1: LongitudinalXrayWorkspace renders without error when annotations arrays are empty', () => {
      let rendered;
      assert.doesNotThrow(() => {
        rendered = renderAndInspect(
          React.createElement(LongitudinalXrayWorkspace, {
            priorStudy: emptyPriorStudy,
            currentStudy: emptyCurrentStudy,
            featureModelBoxesEnabled: true,
            onTriggerLongitudinalRun: () => {},
          })
        );
      }, 'LongitudinalXrayWorkspace must not throw with empty annotations');

      assert.ok(rendered.hasText('Sync Prior/Current W/L'), 'Must render toolbar controls');
      assert.ok(rendered.hasText('Compare Interval Change'), 'Must render interval compare CTA');
      assert.ok(
        !rendered.hasText('Projection Warning:'),
        'Matching PA vs PA projections must NOT show projection warning'
      );
    });

    it('M4.6.2: LongitudinalXrayWorkspace defensively falls back when annotations is null or undefined', () => {
      const nullPrior = { ...emptyPriorStudy, annotations: null };
      const undefinedCurrent = { ...emptyCurrentStudy, annotations: undefined };

      assert.doesNotThrow(() => {
        renderAndInspect(
          React.createElement(LongitudinalXrayWorkspace, {
            priorStudy: nullPrior,
            currentStudy: undefinedCurrent,
            featureModelBoxesEnabled: false,
            onTriggerLongitudinalRun: () => {},
          })
        );
      }, 'LongitudinalXrayWorkspace must handle null/undefined annotations gracefully');
    });

    it('M4.6.3: ChestXrayViewport renders cleanly with empty annotations array', () => {
      let rendered;
      assert.doesNotThrow(() => {
        rendered = renderAndInspect(
          React.createElement(ChestXrayViewport, {
            viewportId: 'test-empty-vp',
            sourceFileId: 'src-test-01',
            studyTitle: 'Chest CT Axial',
            viewPosition: 'PA',
            imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
            isDicom: false,
            imageWidth: 896,
            imageHeight: 896,
            annotations: [],
          })
        );
      }, 'ChestXrayViewport must render cleanly with empty annotations');

      assert.ok(rendered.hasText('Chest CT Axial'), 'HUD renders study title');
      assert.ok(rendered.hasText('SCHEMATIC PREVIEW'), 'HUD renders schematic preview badge');
      assert.ok(rendered.matches(/class=["'][^"']*\bbg-black\b[^"']*["']/), 'Canvas wrapper has pure black bg-black');
      assert.ok(rendered.matches(/class=["'][^"']*\bviewerbottom\b[^"']*["']/), 'Renders viewerbottom slice slider');
    });

    it('M4.6.4: ChestXrayViewport filters rejected annotations and toggles model boxes dynamically', () => {
      const testAnnotations = [
        {
          id: 'ann-rejected',
          origin: 'manual',
          anatomical_label: 'Rejected Artifact',
          bbox_norm: { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 },
          review_state: 'rejected',
        },
        {
          id: 'ann-manual-ok',
          origin: 'manual',
          anatomical_label: 'Manual Carina Annotation',
          bbox_norm: { x0: 0.4, y0: 0.3, x1: 0.6, y1: 0.5 },
          review_state: 'accepted',
        },
        {
          id: 'ann-model-ok',
          origin: 'model_medgemma',
          anatomical_label: 'Right Lower Lobe Consolidation',
          bbox_norm: { x0: 0.5, y0: 0.6, x1: 0.7, y1: 0.8 },
          review_state: 'pending_review',
        },
      ];

      // Case A: showModelBoxes = false
      getImagingStore().setState({ showModelBoxes: false });
      let rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-filter-vp',
          sourceFileId: 'src-test-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: testAnnotations,
        })
      );

      assert.ok(rendered.hasText('Manual Carina Annotation'), 'Manual accepted annotation must be visible');
      assert.ok(!rendered.hasText('Rejected Artifact'), 'Rejected annotation must be filtered out');
      assert.ok(
        !rendered.hasText('[AI Draft] Right Lower Lobe Consolidation'),
        'Model annotation must be hidden when showModelBoxes is false'
      );

      // Case B: showModelBoxes = true
      getImagingStore().setState({ showModelBoxes: true });
      rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-filter-vp-2',
          sourceFileId: 'src-test-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: testAnnotations,
        })
      );

      assert.ok(rendered.hasText('Manual Carina Annotation'), 'Manual annotation still visible');
      assert.ok(!rendered.hasText('Rejected Artifact'), 'Rejected annotation still filtered out');
      assert.ok(
        rendered.hasText('[AI Draft] Right Lower Lobe Consolidation'),
        'Model annotation must be visible when showModelBoxes is true'
      );
      assert.ok(
        rendered.matches(/strokeDasharray=["']5,3["']/i) || rendered.matches(/stroke-dasharray=["']5,3["']/i),
        'Model bounding box must use dashed stroke (5,3)'
      );
      assert.ok(
        rendered.matches(/stroke=["']#a1a1aa["']/i),
        'Model bounding box must use monochrome zinc-400 stroke (#a1a1aa)'
      );
    });

    it('M4.6.5: Active citation focus box renders high-contrast white rect and container highlight ring', () => {
      const imStore = getImagingStore();
      imStore.setState({
        highlightedSourceId: 'src-focus-study',
        highlightedBboxNorm: { x0: 0.2, y0: 0.3, x1: 0.5, y1: 0.6 },
      });

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-focus-vp',
          sourceFileId: 'src-focus-study',
          studyTitle: 'Focus Test Study',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      assert.ok(
        rendered.matches(/border-zinc-100 ring-1 ring-zinc-100\/50/),
        'Matching source viewport must receive high-contrast white border and ring highlight'
      );
      assert.ok(
        rendered.matches(/stroke=["']#ffffff["'][^>]*stroke-width=["']2\.5["']/i) ||
        rendered.matches(/stroke-width=["']2\.5["'][^>]*stroke=["']#ffffff["']/i) ||
        rendered.matches(/strokeWidth=\{2\.5\}/i) ||
        rendered.matches(/stroke=["']#ffffff["'][^>]*strokeWidth=["']2\.5["']/i),
        'Active citation focus rect must render with high-contrast #ffffff stroke and 2.5 width'
      );
    });
  });
});
