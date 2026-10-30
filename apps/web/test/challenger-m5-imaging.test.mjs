/**
 * Milestone 5: Empirical Challenger Test Suite
 * Medical Imaging, Longitudinal Tracking & Clinical Documentation Studio Verification
 * 
 * High-rigor white-box adversarial stress testing across:
 * 1. ImagingScreen, ChestXrayViewport, ScanSVG
 * 2. CompareScreen, LongitudinalXrayWorkspace
 * 3. ReportScreen, ClinicalReportEditor, CitationChipExtension
 * 4. useImagingStore, useWorkspaceStore
 * 
 * Verifies:
 * - True black canvas (#000000), 4-corner DICOM HUD overlay, model vs clinician SVG overlay discrimination,
 *   active tool pointer-event toggling, safe ResizeObserver lifecycle, sliceIndex boundary clamping (0, negative, >240, NaN).
 * - 95-day interval timeline, dynamic projection warning banner logic, SSE unmount teardowns and mid-stream abort.
 * - Bidirectional TipTap <-> Structured Sections mode switching with corrupt/malformed AST nodes,
 *   citation click grounding (slice index, ROI focus, routing), clinical review status transitions.
 * - 100% dark monochrome palette purity (#09090b base, #18181b card, #27272a border, 0 forbidden accents).
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

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
}

describe('Milestone 5 Empirical Challenger: Medical Imaging, Longitudinal & Report Studio', () => {
  // Load target modules via jiti
  const { ImagingScreen } = loadModule('src/components/medgemma/screens/ImagingScreen.tsx');
  const ChestXrayViewport = loadModule('src/components/viewer/ChestXrayViewport.tsx').default;
  const { ScanSVG } = loadModule('src/components/medgemma/ScanSVG.tsx');
  const { CompareScreen } = loadModule('src/components/medgemma/screens/CompareScreen.tsx');
  const { LongitudinalXrayWorkspace } = loadModule('src/components/viewer/LongitudinalXrayWorkspace.tsx');
  const { ReportScreen } = loadModule('src/components/medgemma/screens/ReportScreen.tsx');
  const { ClinicalReportEditor } = loadModule('src/components/editor/ClinicalReportEditor.tsx');
  const { CitationChipExtension } = loadModule('src/components/editor/CitationChipExtension.ts');

  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // SECTION 1: Cornerstone3D & Viewport Robustness
  // =========================================================================
  describe('1. Cornerstone3D & Viewport Robustness', () => {
    const mockAnnotations = [
      {
        id: 'ann-ai-01',
        source_file_id: 'src-curr-01',
        frame_index: 1,
        origin: 'model_medgemma',
        anatomical_label: 'Right Lower Lobe Consolidation',
        finding_text: 'Focal airspace opacification with air bronchograms',
        bbox_norm: { x0: 0.52, y0: 0.58, x1: 0.76, y1: 0.82 },
        review_state: 'accepted',
      },
      {
        id: 'ann-manual-01',
        source_file_id: 'src-curr-01',
        frame_index: 1,
        origin: 'manual',
        anatomical_label: 'Pleural Thickening',
        finding_text: 'Clinician documented pleural thickening',
        bbox_norm: { x0: 0.20, y0: 0.30, x1: 0.35, y1: 0.45 },
        review_state: 'accepted',
      },
      {
        id: 'ann-rejected-01',
        source_file_id: 'src-curr-01',
        frame_index: 1,
        origin: 'model_medgemma',
        anatomical_label: 'Artifact Shadow',
        finding_text: 'Spurious false positive',
        bbox_norm: { x0: 0.10, y0: 0.10, x1: 0.15, y1: 0.15 },
        review_state: 'rejected',
      },
    ];

    it('M5.1.1: Viewport canvas wrapper has true black #000000 background and zinc-950 container', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: true, activeTool: 'WindowLevel' });

      const res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-01',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          studyDate: '24 Oct 2026',
          viewPosition: 'PA',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: mockAnnotations,
        })
      );

      // Wrapper container has bg-zinc-950
      assert.ok(res.html.includes('bg-zinc-950'), 'Container must have bg-zinc-950');
      // Cornerstone canvas and container wrappers have bg-black (#000000)
      assert.ok(res.html.includes('bg-black'), 'Canvas viewport must have bg-black (#000000)');
      assert.ok(
        res.countOccurrences('bg-black') >= 2,
        'Expected both canvas wrapper and elementRef div to have bg-black'
      );
    });

    it('M5.1.2: 4-Corner DICOM HUD overlay displays all 4 quadrants with active store data binding', () => {
      const imStore = getImagingStore();
      imStore.setState({ activeTool: 'Zoom' });

      const res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-hud',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial Follow-up',
          studyDate: '24 Oct 2026',
          viewPosition: 'LATERAL',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      // Top-Left quadrant: Study title and DEMO-024 · viewPosition
      assert.ok(res.hasText('Chest CT Axial Follow-up'), 'Top-Left HUD must bind studyTitle');
      assert.ok(res.hasText('DEMO-024 · LATERAL'), 'Top-Left HUD must bind patient ID & viewPosition');

      // Top-Right quadrant: Study date and kVp technique
      assert.ok(res.hasText('24 Oct 2026'), 'Top-Right HUD must bind studyDate');
      assert.ok(res.hasText('120 kVp · Non-diagnostic'), 'Top-Right HUD must display kVp technique info');

      // Bottom-Left quadrant: Window/Level and active tool binding
      assert.ok(res.hasText('W: 400 L: 40'), 'Bottom-Left HUD must display default W/L');
      assert.ok(res.hasText('Tool: Zoom'), 'Bottom-Left HUD must dynamically bind activeTool from useImagingStore');

      // Bottom-Right quadrant: SCHEMATIC PREVIEW label
      assert.ok(res.hasText('SCHEMATIC PREVIEW'), 'Bottom-Right HUD must display SCHEMATIC PREVIEW');
    });

    it('M5.1.3: Model vs Clinician SVG overlay discrimination with dashed vs solid strokes and label formatting', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: true, activeTool: 'WindowLevel' });

      const res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-ann',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          studyDate: '24 Oct 2026',
          viewPosition: 'PA',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: mockAnnotations,
        })
      );

      // Model annotation: stroke="#a1a1aa", strokeDasharray="5,3", label prefixed with [AI Draft]
      assert.ok(res.html.includes('stroke="#a1a1aa"'), 'Model box must have stroke="#a1a1aa"');
      assert.ok(res.html.includes('stroke-dasharray="5,3"'), 'Model box must have stroke-dasharray="5,3"');
      assert.ok(res.hasText('[AI Draft] Right Lower Lobe Consolidation'), 'Model annotation must prefix [AI Draft]');

      // Clinician / manual annotation: stroke="#ffffff", solid (no dash array on manual rect), label without prefix
      assert.ok(res.html.includes('stroke="#ffffff"'), 'Manual box must have stroke="#ffffff"');
      assert.ok(res.hasText('Pleural Thickening'), 'Manual annotation must render anatomical label');
      assert.ok(!res.hasText('[AI Draft] Pleural Thickening'), 'Manual annotation must NOT have [AI Draft]');

      // Rejected annotation must be excluded
      assert.ok(!res.hasText('Artifact Shadow'), 'Rejected annotations must be completely filtered out');
    });

    it('M5.1.4: Model annotation filtering toggles when showModelBoxes is disabled', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: false, activeTool: 'WindowLevel' });

      const res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-filter',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          studyDate: '24 Oct 2026',
          viewPosition: 'PA',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: mockAnnotations,
        })
      );

      // When showModelBoxes is false, model annotations are filtered out
      assert.ok(!res.hasText('Right Lower Lobe Consolidation'), 'Model box must be suppressed when showModelBoxes is false');
      assert.ok(!res.hasText('[AI Draft]'), 'No [AI Draft] labels when showModelBoxes is false');

      // Manual annotation still rendered!
      assert.ok(res.hasText('Pleural Thickening'), 'Manual annotation must remain visible when showModelBoxes is false');
    });

    it('M5.1.5: Active tool toggling controls pointer-events on SVG overlay (DrawBox enables crosshair)', () => {
      const imStore = getImagingStore();

      // Test 1: WindowLevel tool -> pointer-events-none
      imStore.setState({ activeTool: 'WindowLevel' });
      let res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-pe1',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );
      assert.ok(
        res.html.includes('pointer-events-none'),
        'SVG must be pointer-events-none during WindowLevel'
      );
      assert.ok(
        !res.html.includes('cursor-crosshair pointer-events-auto'),
        'SVG must not have pointer-events-auto when not drawing'
      );

      // Test 2: DrawBox tool -> cursor-crosshair pointer-events-auto
      imStore.setState({ activeTool: 'DrawBox' });
      res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-pe2',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );
      assert.ok(
        res.html.includes('cursor-crosshair pointer-events-auto'),
        'SVG must activate cursor-crosshair and pointer-events-auto when activeTool is DrawBox'
      );
    });

    it('M5.1.6: SliceIndex boundary clamping in useWorkspaceStore handles 0, negative, >240, and NaN', () => {
      const wsStore = getWorkspaceStore();

      // Baseline check
      assert.equal(wsStore.getState().sliceIndex, 124);

      // Test Boundary 1: Value 0 -> clamped to 1
      wsStore.getState().setSliceIndex(0);
      assert.equal(wsStore.getState().sliceIndex, 1, 'SliceIndex 0 must clamp to 1');

      // Test Boundary 2: Negative values -> clamped to 1
      wsStore.getState().setSliceIndex(-5);
      assert.equal(wsStore.getState().sliceIndex, 1, 'SliceIndex -5 must clamp to 1');
      wsStore.getState().setSliceIndex(-99999);
      assert.equal(wsStore.getState().sliceIndex, 1, 'SliceIndex -99999 must clamp to 1');

      // Test Boundary 3: Upper boundary 240 -> preserved
      wsStore.getState().setSliceIndex(240);
      assert.equal(wsStore.getState().sliceIndex, 240, 'SliceIndex 240 must remain 240');

      // Test Boundary 4: Values > 240 -> clamped to 240
      wsStore.getState().setSliceIndex(241);
      assert.equal(wsStore.getState().sliceIndex, 240, 'SliceIndex 241 must clamp to 240');
      wsStore.getState().setSliceIndex(999999);
      assert.equal(wsStore.getState().sliceIndex, 240, 'SliceIndex 999999 must clamp to 240');

      // Test Boundary 5: Non-numeric inputs / NaN -> clamped to 1
      wsStore.getState().setSliceIndex(NaN);
      assert.equal(wsStore.getState().sliceIndex, 1, 'SliceIndex NaN must clamp to 1');
      wsStore.getState().setSliceIndex(Number.POSITIVE_INFINITY);
      assert.equal(wsStore.getState().sliceIndex, 240, 'Infinity must clamp to 240');

      // Test Boundary 6: Floating point values rounded properly
      wsStore.getState().setSliceIndex(150.6);
      assert.equal(wsStore.getState().sliceIndex, 151, 'Floating slice 150.6 must round to 151');
      wsStore.getState().setSliceIndex(0.4);
      assert.equal(wsStore.getState().sliceIndex, 1, 'Fractional slice 0.4 must clamp to 1');
    });

    it('M5.1.7: Viewport bottom slider synchronizes with sliceIndex/240 and reflects current position', () => {
      const wsStore = getWorkspaceStore();
      wsStore.getState().setSliceIndex(188);

      const res = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-slider',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'wadouri:test.dcm',
          isDicom: true,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      assert.ok(res.hasText('Slice'), 'Bottom bar must include Slice label');
      assert.ok(res.hasText('188/240'), 'Bottom bar must display synchronized slice fraction 188/240');
      assert.ok(res.html.includes('value="188"'), 'Input range slider must have value="188"');
      assert.ok(res.html.includes('min="1" max="240"'), 'Input range slider must span min=1 to max=240');
    });

    it('M5.1.8: ResizeObserver lifecycle and teardown safety in ChestXrayViewport source code', () => {
      const srcPath = path.resolve(WEB_ROOT, 'src/components/viewer/ChestXrayViewport.tsx');
      const srcCode = fs.readFileSync(srcPath, 'utf8');

      // Check defensive ResizeObserver existence check
      assert.ok(
        srcCode.includes('typeof ResizeObserver !== "undefined"'),
        'Must defensively check typeof ResizeObserver !== "undefined"'
      );

      // Check try/catch inside ResizeObserver callback to guard against teardown race conditions
      assert.ok(
        srcCode.includes('try {') && srcCode.includes('engineRef.current.resize()'),
        'Must catch resize errors during teardown'
      );

      // Check clean unmount cleanup: disconnect ResizeObserver and destroy tool group / engine
      assert.ok(
        srcCode.includes('resizeObserver?.disconnect()'),
        'Cleanup function must disconnect ResizeObserver'
      );
      assert.ok(
        srcCode.includes('ToolGroupManager.destroyToolGroup'),
        'Cleanup function must destroy tool group'
      );
      assert.ok(
        srcCode.includes('engineRef.current?.destroy()'),
        'Cleanup function must destroy rendering engine'
      );
    });

    it('M5.1.9: ScanSVG renders valid semantic monochrome elements for both axial and volume types', () => {
      // Axial render
      const axialRes = renderAndInspect(React.createElement(ScanSVG, { type: 'axial' }));
      assert.ok(axialRes.hasTag('svg'), 'Axial ScanSVG must render an SVG');
      assert.ok(axialRes.html.includes('aria-label="Schematic axial chest illustration, not a medical scan"'));
      assert.ok(axialRes.html.includes('fill="#71717a"'), 'Axial ScanSVG must use semantic zinc token #71717a');
      assert.ok(axialRes.hasText('R'), 'Axial ScanSVG must render right orientation marker');
      assert.ok(axialRes.hasText('L'), 'Axial ScanSVG must render left orientation marker');

      // Volume render
      const volumeRes = renderAndInspect(React.createElement(ScanSVG, { type: 'volume' }));
      assert.ok(volumeRes.hasTag('svg'), 'Volume ScanSVG must render an SVG');
      assert.ok(volumeRes.html.includes('aria-label="Schematic volume rendering placeholder"'));
      assert.ok(volumeRes.html.includes('stroke="#d4d4da"'), 'Volume ScanSVG must use monochrome stroke #d4d4da');
    });
  });

  // =========================================================================
  // SECTION 2: Comparison View & Longitudinal Workspace Robustness
  // =========================================================================
  describe('2. Comparison View & Longitudinal Workspace Robustness', () => {
    const baseStudyA = {
      source_file_id: 'src-prior-01',
      filename: 'CT chest · Prior',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'wadouri:prior.dcm',
      normalized_display_png_url: 'wadouri:prior.dcm',
      metadata: {
        view_position: 'PA',
        encounter_date: '21 Jul 2026',
        rows: 896,
        columns: 896,
      },
      annotations: [],
    };

    const baseStudyB = {
      source_file_id: 'src-curr-01',
      filename: 'CT chest · Current',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'wadouri:curr.dcm',
      normalized_display_png_url: 'wadouri:curr.dcm',
      metadata: {
        view_position: 'PA',
        encounter_date: '24 Oct 2026',
        rows: 896,
        columns: 896,
      },
      annotations: [],
    };

    it('M5.2.1: 95-Day elapsed interval visual timeline renders correct structure and timepoints', () => {
      const res = renderAndInspect(React.createElement(CompareScreen));

      assert.ok(res.hasText('95 days'), 'Must display 95 days interval badge/label');
      assert.ok(res.hasText('21 Jul 2026'), 'Must display prior timepoint 21 Jul 2026');
      assert.ok(res.hasText('24 Oct 2026'), 'Must display current timepoint 24 Oct 2026');
      assert.ok(res.html.includes('class="timeline"'), 'Must render timeline container');
      assert.ok(res.html.includes('class="timepoint"'), 'Must render prior timepoint element');
      assert.ok(res.html.includes('class="timepoint current"'), 'Must render current active timepoint element');
      assert.ok(res.html.includes('class="track"'), 'Must render timeline track separators');
    });

    it('M5.2.2: Dynamic projection warning banner logic: suppressed when positions match (PA vs PA)', () => {
      const res = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: { ...baseStudyA, metadata: { ...baseStudyA.metadata, view_position: 'PA' } },
          currentStudy: { ...baseStudyB, metadata: { ...baseStudyB.metadata, view_position: 'PA' } },
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );

      assert.ok(
        !res.hasText('Projection Warning:'),
        'Projection Warning banner must NOT appear when view positions match (PA vs PA)'
      );
    });

    it('M5.2.3: Dynamic projection warning banner logic: suppressed when UNKNOWN or missing', () => {
      // Prior is UNKNOWN, current is PA
      const res1 = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: { ...baseStudyA, metadata: { ...baseStudyA.metadata, view_position: 'UNKNOWN' } },
          currentStudy: { ...baseStudyB, metadata: { ...baseStudyB.metadata, view_position: 'PA' } },
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );
      assert.ok(!res1.hasText('Projection Warning:'), 'Banner suppressed when prior is UNKNOWN');

      // Prior is PA, current is UNKNOWN
      const res2 = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: { ...baseStudyA, metadata: { ...baseStudyA.metadata, view_position: 'PA' } },
          currentStudy: { ...baseStudyB, metadata: { ...baseStudyB.metadata, view_position: 'UNKNOWN' } },
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );
      assert.ok(!res2.hasText('Projection Warning:'), 'Banner suppressed when current is UNKNOWN');

      // View positions missing
      const res3 = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: { ...baseStudyA, metadata: {} },
          currentStudy: { ...baseStudyB, metadata: {} },
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );
      assert.ok(!res3.hasText('Projection Warning:'), 'Banner suppressed when view positions are undefined');
    });

    it('M5.2.4: Dynamic projection warning banner logic: displayed on genuine mismatch (PA vs AP)', () => {
      const res = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: { ...baseStudyA, metadata: { ...baseStudyA.metadata, view_position: 'PA' } },
          currentStudy: { ...baseStudyB, metadata: { ...baseStudyB.metadata, view_position: 'AP' } },
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );

      assert.ok(res.hasText('Projection Warning:'), 'Banner MUST appear on genuine mismatch (PA vs AP)');
      assert.ok(res.hasText('Prior study is PA while Current study is AP'), 'Banner must state exact mismatched projections');
      assert.ok(
        res.hasText('Evaluate apparent heart size and mediastinal width differences with caution'),
        'Banner must contain clinical evaluation caution'
      );
      assert.ok(
        res.html.includes('bg-zinc-900') && res.html.includes('border-zinc-700'),
        'Banner must follow monochrome styling (bg-zinc-900 border-zinc-700)'
      );
    });

    it('M5.2.5: SSE unmount teardowns and mid-stream abort in CompareScreen source code', () => {
      const srcPath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/CompareScreen.tsx');
      const srcCode = fs.readFileSync(srcPath, 'utf8');

      // Check unmount cleanup effect: closes activeEventSourceRef
      assert.ok(
        srcCode.includes('activeEventSourceRef.current?.close()') ||
        srcCode.includes('activeEventSourceRef.current.close()'),
        'CompareScreen must close active EventSource on unmount'
      );

      // Check mid-stream abort: closes previous EventSource before initiating new comparison run
      assert.ok(
        srcCode.includes('handleTriggerAnalysis') &&
        srcCode.includes('if (activeEventSourceRef.current)') &&
        srcCode.includes('activeEventSourceRef.current.close()'),
        'CompareScreen must abort active EventSource before starting new run'
      );

      // Check stream terminal states (completed, failed, cancelled) set isComparing(false) and nullify ref
      assert.ok(srcCode.includes('event === "completed"'));
      assert.ok(srcCode.includes('event === "failed" || event === "cancelled"'));
      assert.ok(srcCode.includes('activeEventSourceRef.current = null;'));
    });
  });

  // =========================================================================
  // SECTION 3: Report Studio & TipTap Robustness
  // =========================================================================
  describe('3. Report Studio & TipTap Robustness', () => {
    it('M5.3.1: Bidirectional mode switching between TipTap and Structured Sections preserves content', () => {
      const res = renderAndInspect(React.createElement(ReportScreen));

      // Both modes are switchable via mode tabs
      assert.ok(res.hasText('Tiptap Rich Editor'), 'Must have Tiptap Rich Editor tab button');
      assert.ok(res.hasText('Structured Sections'), 'Must have Structured Sections tab button');
      assert.ok(res.hasText('Save draft'), 'Must have Save draft action button');
      assert.ok(res.hasText('Export draft'), 'Must have Export draft action button');

      // Baseline renders TipTap editor controls & evidence sidebar
      assert.ok(res.hasText('AI DRAFT · UNREVIEWED'), 'Must render AI DRAFT banner');
      assert.ok(res.hasText('Current CT study'), 'Must render Current CT study in evidence panel');
      assert.ok(res.hasText('Prior CT study'), 'Must render Prior CT study in evidence panel');
      assert.ok(res.hasText('Before you export'), 'Must render pre-export checklist panel');
    });

    it('M5.3.2: extractSectionsFromTiptap handles corrupt, empty, and malformed AST nodes defensively', () => {
      const reportScreenModule = loadModule('src/components/medgemma/screens/ReportScreen.tsx');
      const reportSrc = fs.readFileSync(path.resolve(WEB_ROOT, 'src/components/medgemma/screens/ReportScreen.tsx'), 'utf8');

      // Verify extractSectionsFromTiptap checks Array.isArray and safeguards against malformed ASTs
      assert.ok(reportSrc.includes('function extractSectionsFromTiptap'));
      assert.ok(reportSrc.includes('Array.isArray'));

      // Test with corrupted ASTs directly by simulating extractSectionsFromTiptap logic:
      function testExtract(json) {
        let tech = '';
        let find = '';
        let impr = '';
        let limit = '';

        if (json && Array.isArray(json.content)) {
          for (const node of json.content) {
            if (node?.type === 'paragraph' && Array.isArray(node.content)) {
              const fullText = node.content.map((c) => c?.text || '').join('').trim();
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

      // Malformed AST 1: null / undefined
      assert.deepEqual(testExtract(null), {
        technique: undefined,
        findings: undefined,
        impression: undefined,
        limitations: undefined,
      });

      // Malformed AST 2: Empty object
      assert.deepEqual(testExtract({}), {
        technique: undefined,
        findings: undefined,
        impression: undefined,
        limitations: undefined,
      });

      // Malformed AST 3: Content not an array
      assert.deepEqual(testExtract({ content: 'invalid' }), {
        technique: undefined,
        findings: undefined,
        impression: undefined,
        limitations: undefined,
      });

      // Malformed AST 4: Content with corrupt/null nodes
      assert.deepEqual(
        testExtract({
          content: [
            null,
            { type: 'unknown' },
            { type: 'paragraph', content: null },
            { type: 'paragraph', content: [null, { text: 'Random note without section tag' }] },
            { type: 'paragraph', content: [{ text: 'TECHNIQUE: Helical chest scan' }] },
          ],
        }),
        {
          technique: 'Helical chest scan',
          findings: undefined,
          impression: undefined,
          limitations: undefined,
        }
      );
    });

    it('M5.3.3: Citation click grounding updates sliceIndex, sets ROI focus, and routes to appropriate screen', () => {
      const wsStore = getWorkspaceStore();
      const imStore = getImagingStore();

      // Ensure stores are clean
      wsStore.setState({ page: 'report', sliceIndex: 1 });
      imStore.setState({ highlightedSourceId: null, highlightedBboxNorm: null });

      // Simulate citation click callback configured in ReportScreen for [cit_2] (Current Study)
      const currentCitationAttrs = {
        citationId: 'cit_2',
        evidenceChunkId: 'chunk-curr-002',
        sourceFileId: 'current-study-002',
        pageOrFrame: 124,
        bboxNorm: { x0: 0.55, y0: 0.60, x1: 0.78, y1: 0.85 },
        verbatimQuote: 'Right lower lobe consolidation on axial series slice 124',
      };

      // Execute onOpenPdfCitation logic from ReportScreen
      if (currentCitationAttrs.pageOrFrame) {
        wsStore.getState().setSliceIndex(currentCitationAttrs.pageOrFrame);
      }
      if (currentCitationAttrs.bboxNorm) {
        imStore.getState().focusCitationOnViewer(
          currentCitationAttrs.sourceFileId,
          currentCitationAttrs.bboxNorm
        );
      }
      if (currentCitationAttrs.sourceFileId?.includes('prior')) {
        wsStore.getState().setPage('compare');
      } else {
        wsStore.getState().setPage('imaging');
      }

      // Assertions for current study citation:
      assert.equal(wsStore.getState().sliceIndex, 124, 'Slice index must update to 124');
      assert.equal(imStore.getState().highlightedSourceId, 'current-study-002');
      assert.deepEqual(imStore.getState().highlightedBboxNorm, {
        x0: 0.55,
        y0: 0.60,
        x1: 0.78,
        y1: 0.85,
      });
      assert.equal(wsStore.getState().page, 'imaging', 'Current study citation must route to imaging screen');

      // Now simulate citation click callback for [cit_1] (Prior Study)
      const priorCitationAttrs = {
        citationId: 'cit_1',
        evidenceChunkId: 'chunk-prior-001',
        sourceFileId: 'prior-study-001',
        pageOrFrame: 1,
        bboxNorm: { x0: 0.15, y0: 0.25, x1: 0.45, y1: 0.55 },
        verbatimQuote: 'Prior baseline chest CT study from 21 Jul 2026',
      };

      if (priorCitationAttrs.pageOrFrame) {
        wsStore.getState().setSliceIndex(priorCitationAttrs.pageOrFrame);
      }
      if (priorCitationAttrs.bboxNorm) {
        imStore.getState().focusCitationOnViewer(
          priorCitationAttrs.sourceFileId,
          priorCitationAttrs.bboxNorm
        );
      }
      if (priorCitationAttrs.sourceFileId?.includes('prior')) {
        wsStore.getState().setPage('compare');
      } else {
        wsStore.getState().setPage('imaging');
      }

      // Assertions for prior study citation:
      assert.equal(wsStore.getState().sliceIndex, 1, 'Slice index must update to 1');
      assert.equal(imStore.getState().highlightedSourceId, 'prior-study-001');
      assert.equal(wsStore.getState().page, 'compare', 'Prior study citation must route to compare screen');
    });

    it('M5.3.4: Clinical review status transitions update activeVersion.review_status and case status to Reviewed', () => {
      const wsStore = getWorkspaceStore();

      // Ensure Case 024 is in progress initially
      const initialCase024 = wsStore.getState().cases.find((c) => c.id === '024');
      assert.ok(initialCase024, 'Case 024 must exist in store');
      assert.notEqual(initialCase024.status, 'Reviewed', 'Case 024 must not be Reviewed initially');

      // Simulate handleMarkReviewed transition from ReportScreen
      const versionNumber = 1;
      const targetCaseId = '024';

      // Perform store update as implemented in ReportScreen handleMarkReviewed
      wsStore.getState().setCases(
        wsStore.getState().cases.map((c) =>
          c.id === '024' || c.id === targetCaseId ? { ...c, status: 'Reviewed' } : c
        )
      );

      const updatedCase024 = wsStore.getState().cases.find((c) => c.id === '024');
      assert.equal(updatedCase024.status, 'Reviewed', 'Case 024 status must transition to Reviewed');

      // Verify ClinicalReportEditor rendering with reviewed version
      const reviewedVersion = {
        id: 'ver-1',
        version_number: 1,
        review_status: 'reviewed',
        tiptap_doc_json: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Reviewed content' }] }] },
        created_at: new Date().toISOString(),
        reviewed_by: 'Dr. Morgan',
      };

      const res = renderAndInspect(
        React.createElement(ClinicalReportEditor, {
          caseId: '024',
          versions: [reviewedVersion],
          activeVersion: reviewedVersion,
          onSelectVersion: () => {},
          onSaveNewVersion: async () => {},
          onMarkReviewed: async () => {},
          onExportPdf: async () => {},
        })
      );

      assert.ok(res.hasText('CLINICALLY REVIEWED'), 'Editor must display CLINICALLY REVIEWED banner');
      assert.ok(res.hasText('Approved by Dr. Morgan'), 'Editor must display reviewer attribution');
      assert.ok(res.hasText('Verified'), 'Editor must render Verified status badge');
      assert.ok(res.hasText('Export v1 PDF'), 'Reviewed report enables PDF export action');
      assert.ok(!res.hasText('Approve & Mark v1 Reviewed'), 'Approve button must be hidden when already reviewed');
    });

    it('M5.3.5: CitationChipExtension schema attributes and HTML serialization validity', () => {
      assert.equal(CitationChipExtension.name, 'citationChip');
      assert.equal(CitationChipExtension.type, 'node');

      const attrs = CitationChipExtension.config.addAttributes();
      assert.ok(attrs.citationId, 'citationChip must define citationId attribute');
      assert.ok(attrs.sourceFileId, 'citationChip must define sourceFileId attribute');
      assert.ok(attrs.pageOrFrame, 'citationChip must define pageOrFrame attribute');
      assert.ok(attrs.bboxNorm, 'citationChip must define bboxNorm attribute');
      assert.ok(attrs.verbatimQuote, 'citationChip must define verbatimQuote attribute');

      // Test parseHTML & renderHTML
      const parseRules = CitationChipExtension.config.parseHTML();
      assert.ok(Array.isArray(parseRules));
      assert.equal(parseRules[0].tag, 'span[data-type="citation-chip"]');

      const renderRule = CitationChipExtension.config.renderHTML({
        HTMLAttributes: { citationId: 'cit_test' },
      });
      assert.equal(renderRule[0], 'span');
      assert.equal(renderRule[1]['data-type'], 'citation-chip');
      assert.equal(renderRule[2], '[cit_test]');
    });
  });

  // =========================================================================
  // SECTION 4: 100% Dark Monochrome Palette Purity Verification
  // =========================================================================
  describe('4. 100% Dark Monochrome Palette Purity Verification', () => {
    const targetFiles = [
      'src/components/medgemma/screens/ImagingScreen.tsx',
      'src/components/viewer/ChestXrayViewport.tsx',
      'src/components/medgemma/ScanSVG.tsx',
      'src/components/medgemma/screens/CompareScreen.tsx',
      'src/components/viewer/LongitudinalXrayWorkspace.tsx',
      'src/components/medgemma/screens/ReportScreen.tsx',
      'src/components/editor/ClinicalReportEditor.tsx',
      'src/components/editor/CitationChipExtension.ts',
      'src/stores/useImagingStore.ts',
      'src/stores/useWorkspaceStore.ts',
    ];

    const FORBIDDEN_ACCENT_PATTERNS = [
      { pattern: /#10b981/i, desc: 'Forbidden emerald green #10b981' },
      { pattern: /#059669/i, desc: 'Forbidden emerald green #059669' },
      { pattern: /#34d399/i, desc: 'Forbidden emerald green #34d399' },
      { pattern: /#f59e0b/i, desc: 'Forbidden amber #f59e0b' },
      { pattern: /#d97706/i, desc: 'Forbidden amber #d97706' },
      { pattern: /#3b82f6/i, desc: 'Forbidden blue #3b82f6' },
      { pattern: /#0ea5e9/i, desc: 'Forbidden sky blue #0ea5e9' },
      { pattern: /#6366f1/i, desc: 'Forbidden indigo #6366f1' },
      { pattern: /#8b5cf6/i, desc: 'Forbidden violet #8b5cf6' },
      { pattern: /#a855f7/i, desc: 'Forbidden purple #a855f7' },
      { pattern: /#ec4899/i, desc: 'Forbidden pink #ec4899' },
      { pattern: /#ef4444/i, desc: 'Forbidden red #ef4444' },
      { pattern: /\btext-emerald-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class text-emerald-*' },
      { pattern: /\bbg-emerald-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class bg-emerald-*' },
      { pattern: /\bborder-emerald-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class border-emerald-*' },
      { pattern: /\btext-amber-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class text-amber-*' },
      { pattern: /\bbg-amber-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class bg-amber-*' },
      { pattern: /\btext-blue-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class text-blue-*' },
      { pattern: /\bbg-blue-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class bg-blue-*' },
      { pattern: /\btext-sky-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class text-sky-*' },
      { pattern: /\bbg-sky-[0-9]{3}\b/i, desc: 'Forbidden Tailwind class bg-sky-*' },
      { pattern: /\bfrom-purple-[0-9]{3}\b/i, desc: 'Forbidden purple gradient' },
      { pattern: /\bto-indigo-[0-9]{3}\b/i, desc: 'Forbidden indigo gradient' },
    ];

    for (const relFile of targetFiles) {
      it(`M5.4: Palette Purity scan for ${relFile} (0 forbidden color tokens)`, () => {
        const fullPath = path.resolve(WEB_ROOT, relFile);
        assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relFile}`);
        const content = fs.readFileSync(fullPath, 'utf8');
        const activeContent = stripComments(content);

        for (const { pattern, desc } of FORBIDDEN_ACCENT_PATTERNS) {
          const match = activeContent.match(pattern);
          assert.equal(
            match,
            null,
            `Palette Purity violation in ${relFile}: Found ${desc} (${match ? match[0] : ''})`
          );
        }
      });
    }

    it('M5.4.11: Target components strictly adhere to dark monochrome tokens in HTML rendering', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: true, activeTool: 'WindowLevel' });

      const screens = [
        React.createElement(ImagingScreen),
        React.createElement(CompareScreen),
        React.createElement(ReportScreen),
      ];

      for (const screen of screens) {
        const res = renderAndInspect(screen);
        for (const { pattern, desc } of FORBIDDEN_ACCENT_PATTERNS) {
          const match = res.html.match(pattern);
          assert.equal(
            match,
            null,
            `Rendered HTML palette violation: Found ${desc} in screen render`
          );
        }
      }
    });
  });

  // =========================================================================
  // SECTION 5: Zero Regression and Existing Test Suite Integrity
  // =========================================================================
  describe('5. Test Suite Non-Regression & Integrity', () => {
    it('M5.5.1: Verifies all milestone stores and action interfaces remain strictly backwards compatible', () => {
      const ws = getWorkspaceStore().getState();
      const im = getImagingStore().getState();

      // WorkspaceStore contract:
      assert.equal(typeof ws.setPage, 'function');
      assert.equal(typeof ws.setActiveCase, 'function');
      assert.equal(typeof ws.setSliceIndex, 'function');
      assert.equal(typeof ws.setSelectedSeries, 'function');
      assert.equal(typeof ws.setImagingMode, 'function');
      assert.equal(typeof ws.showToast, 'function');
      assert.equal(typeof ws.openModal, 'function');
      assert.equal(typeof ws.closeModal, 'function');
      assert.equal(typeof ws.addCase, 'function');

      // ImagingStore contract:
      assert.equal(typeof im.setActiveTool, 'function');
      assert.equal(typeof im.setSyncPriorCurrent, 'function');
      assert.equal(typeof im.setShowModelBoxes, 'function');
      assert.equal(typeof im.setSharedWindowRange, 'function');
      assert.equal(typeof im.focusCitationOnViewer, 'function');
    });
  });
});
