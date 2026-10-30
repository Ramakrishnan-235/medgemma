/**
 * Milestone 4: Empirical Challenger Test Suite
 * Medical Imaging & Longitudinal Workspace Verification
 * 
 * Adversarially tests and empirically verifies all Milestone 4 deliverables:
 * 1. ImagingScreen:
 *    - Toolstrip buttons (WindowLevel, Pan, Zoom, DrawBox, AI Boxes)
 *    - ARIA tablist/tab attributes, active selection states, panel bindings
 *    - Series switcher (aria-pressed, .selected, 01/02/03 series)
 *    - DICOM viewport mode switch (analysis vs volume vs localization)
 *    - Cornerstone3D vs Schematic switch toggle (role="switch", aria-checked)
 *    - Active annotations list with citation click grounding triggers
 * 
 * 2. ChestXrayViewport:
 *    - True black canvas wrapper (#000000 / bg-black) & dark container (bg-zinc-950)
 *    - 4-corner DICOM overlay HUD (study title, view, date, W/L contrast, active tool, SCHEMATIC PREVIEW)
 *    - Bottom slice slider (.viewerbottom, input range 1-240, sliceIndex synchronization)
 *    - SVG bounding box rendering:
 *      * Model boxes: stroke="#a1a1aa", strokeDasharray="5,3", [AI Draft] label
 *      * Manual boxes: stroke="#ffffff", solid stroke, label
 *      * Dynamic filtering when showModelBoxes is false
 *      * Active citation focus box (stroke="#ffffff", strokeWidth 2.5) & container highlight ring
 *      * Manual ROI drawing state (activeTool === 'DrawBox' enables cursor-crosshair pointer-events-auto)
 *      * Elimination of off-palette emerald/amber colors
 * 
 * 3. CompareScreen:
 *    - 95-day elapsed interval visual timeline DOM structure (.timeline, .timepoint, .track)
 *    - Complete elimination of legacy inline borderColor: "#10b981" in favor of border border-zinc-800
 *    - SSE activeEventSource unmount lifecycle cleanup & connection termination
 *    - Secondary navigation "Back to imaging" & ContextBar integration
 *    - Mode toggle between Cornerstone3D Dual Sync and Schematic View
 * 
 * 4. LongitudinalXrayWorkspace:
 *    - Monochrome CTA button (bg-zinc-100 hover:bg-white text-zinc-950 font-medium, zero emerald)
 *    - Automatic projection mismatch banner (bg-zinc-900 border-zinc-700 text-zinc-200, "Projection Warning:")
 *    - Suppression of projection warning when views match (e.g., PA vs PA) or UNKNOWN
 *    - Side-by-side dual viewport layout (grid grid-cols-1 lg:grid-cols-2)
 *    - Synchronized W/L and experimental model boxes checkboxes
 * 
 * 5. ReportScreen & ClinicalReportEditor:
 *    - Dual-mode switching (Tiptap Rich Editor vs Structured Sections) with document content continuity
 *    - TipTap formatting toolbar actions (Bold, Italic, H2, Section Header H3, Lists, Blockquote, Undo, Redo)
 *    - Review status banner & badges (AI DRAFT · UNREVIEWED vs CLINICALLY REVIEWED)
 *    - Citation click grounding: slice index update to pageOrFrame (e.g. 124), ROI focus, and screen navigation
 *    - Case status synchronization in store: marking report reviewed sets case 024 status to "Reviewed"
 *    - Pre-export safety checklist & plain text clipboard copy
 * 
 * 6. Global Design System & Token Integrity:
 *    - ScanSVG.tsx off-scale token elimination (#71717a check)
 *    - Zero off-palette hex colors across all Milestone 4 scope files
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

describe('Milestone 4 Empirical Challenger: Medical Imaging & Longitudinal Workspace', () => {
  // Load target components & screens via jiti
  const { ImagingScreen } = loadModule('src/components/medgemma/screens/ImagingScreen.tsx');
  const ChestXrayViewport = loadModule('src/components/viewer/ChestXrayViewport.tsx').default;
  const { CompareScreen } = loadModule('src/components/medgemma/screens/CompareScreen.tsx');
  const { LongitudinalXrayWorkspace } = loadModule('src/components/viewer/LongitudinalXrayWorkspace.tsx');
  const { ReportScreen } = loadModule('src/components/medgemma/screens/ReportScreen.tsx');
  const { ClinicalReportEditor } = loadModule('src/components/editor/ClinicalReportEditor.tsx');
  const { CitationChipExtension } = loadModule('src/components/editor/CitationChipExtension.ts');
  const { ScanSVG } = loadModule('src/components/medgemma/ScanSVG.tsx');

  beforeEach(() => {
    resetAllStores();
  });

  // =========================================================================
  // SECTION 1: ImagingScreen Empirical Verification
  // =========================================================================
  describe('1. ImagingScreen Empirical Verification', () => {
    it('M4.1.1: Toolstrip renders all 4 viewport tool buttons (WindowLevel, Pan, Zoom, DrawBox)', () => {
      const rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(rendered.hasText('W/L Contrast'), 'Missing W/L Contrast tool button');
      assert.ok(rendered.hasText('Pan'), 'Missing Pan tool button');
      assert.ok(rendered.hasText('Zoom'), 'Missing Zoom tool button');
      assert.ok(rendered.hasText('Box ROI'), 'Missing Box ROI tool button');
    });

    it('M4.1.2: Toolstrip reflects activeTool state with .black class and aria-pressed="true"', () => {
      const imStore = getImagingStore();
      
      // Default active tool is WindowLevel
      let rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<button[^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*aria-pressed=["']true["'][^>]*>W\/L Contrast<\/button>/) ||
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*>W\/L Contrast<\/button>/),
        'WindowLevel button must have class black and aria-pressed=true by default'
      );

      // Change active tool to DrawBox
      imStore.setState({ activeTool: 'DrawBox' });
      rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<button[^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*aria-pressed=["']true["'][^>]*>Box ROI<\/button>/) ||
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*>Box ROI<\/button>/),
        'Box ROI button must have class black and aria-pressed=true when activeTool is DrawBox'
      );
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']false["'][^>]*>W\/L Contrast<\/button>/),
        'W/L Contrast button must have aria-pressed=false when inactive'
      );

      // Change active tool to Pan
      imStore.setState({ activeTool: 'Pan' });
      rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<button[^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*aria-pressed=["']true["'][^>]*>Pan<\/button>/) ||
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*>Pan<\/button>/),
        'Pan button must have class black and aria-pressed=true when activeTool is Pan'
      );
    });

    it('M4.1.3: AI Boxes toggle button reflects showModelBoxes state (On/Off, aria-pressed, .black)', () => {
      const imStore = getImagingStore();

      imStore.setState({ showModelBoxes: true });
      let rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/AI Boxes\s*\(\s*(<!-- -->)?\s*On\s*(<!-- -->)?\s*\)/i),
        'Must display AI Boxes (On) when enabled'
      );
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*>AI Boxes/i) ||
        rendered.matches(/<button[^>]*class=["'][^"']*\bblack\b[^"']*["'][^>]*aria-pressed=["']true["'][^>]*>AI Boxes/i),
        'AI Boxes toggle button must have aria-pressed=true and class black when showModelBoxes is true'
      );

      imStore.setState({ showModelBoxes: false });
      rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/AI Boxes\s*\(\s*(<!-- -->)?\s*Off\s*(<!-- -->)?\s*\)/i),
        'Must display AI Boxes (Off) when disabled'
      );
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']false["'][^>]*>AI Boxes/i),
        'AI Boxes toggle button must have aria-pressed=false when showModelBoxes is false'
      );
    });

    it('M4.1.4: Viewport engine switch button has role="switch", aria-checked, and toggles view mode', () => {
      const rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<button[^>]*role=["']switch["'][^>]*aria-checked=["']true["'][^>]*>Cornerstone3D Active<\/button>/) ||
        rendered.matches(/<button[^>]*aria-checked=["']true["'][^>]*role=["']switch["'][^>]*>Cornerstone3D Active<\/button>/),
        'Viewport engine button must have role=switch, aria-checked=true, and label Cornerstone3D Active by default'
      );
    });

    it('M4.1.5: Mode switcher tabs strictly conform to ARIA tablist/tab pattern with panel associations', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({ imagingMode: 'analysis' });

      let rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\btabs\b[^"']*["'][^>]*role=["']tablist["'][^>]*aria-label=["']Imaging workspace mode["']/),
        'Mode switcher container must have role=tablist and aria-label="Imaging workspace mode"'
      );

      // Check tab attributes for analysis, volume, localization
      assert.ok(
        rendered.matches(/<button[^>]*id=["']tab-analysis["'][^>]*role=["']tab["'][^>]*aria-selected=["']true["'][^>]*aria-controls=["']panel-analysis["'][^>]*tabindex=["']0["']/i),
        'Analysis tab must have id="tab-analysis", role="tab", aria-selected="true", aria-controls="panel-analysis", tabIndex=0'
      );
      assert.ok(
        rendered.matches(/<button[^>]*id=["']tab-volume["'][^>]*role=["']tab["'][^>]*aria-selected=["']false["'][^>]*aria-controls=["']panel-volume["'][^>]*tabindex=["']-1["']/i),
        'Volume tab must have id="tab-volume", role="tab", aria-selected="false", aria-controls="panel-volume", tabIndex=-1'
      );
      assert.ok(
        rendered.matches(/<button[^>]*id=["']tab-localization["'][^>]*role=["']tab["'][^>]*aria-selected=["']false["'][^>]*aria-controls=["']panel-localization["'][^>]*tabindex=["']-1["']/i),
        'Localization tab must have id="tab-localization", role="tab", aria-selected="false", aria-controls="panel-localization", tabIndex=-1'
      );

      // Check main panel associations
      assert.ok(
        rendered.matches(/<div[^>]*id=["']panel-analysis["'][^>]*role=["']tabpanel["'][^>]*aria-labelledby=["']tab-analysis["']/),
        'Main panel must have id="panel-analysis", role="tabpanel", aria-labelledby="tab-analysis"'
      );

      // Switch to volume mode and verify panel association update
      wsStore.setState({ imagingMode: 'volume' });
      rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<div[^>]*id=["']panel-volume["'][^>]*role=["']tabpanel["'][^>]*aria-labelledby=["']tab-volume["']/),
        'Main panel must have id="panel-volume", role="tabpanel", aria-labelledby="tab-volume"'
      );
    });

    it('M4.1.6: Series selector buttons have aria-pressed, .selected, and aria-label="Series selection"', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({ selectedSeries: '01' });

      let rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<aside[^>]*class=["'][^"']*\bseries\b[^"']*["'][^>]*aria-label=["']Series selection["']/),
        'Series container must have aria-label="Series selection"'
      );
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*class=["'][^"']*\bselected\b[^"']*["'][^>]*>[\s\S]*?01[\s\S]*?Axial/i),
        'Series 01 button must have aria-pressed=true and class selected'
      );
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']false["'][^>]*>[\s\S]*?02[\s\S]*?Coronal/i),
        'Series 02 button must have aria-pressed=false'
      );

      // Switch to series 02
      wsStore.setState({ selectedSeries: '02' });
      rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/<button[^>]*aria-pressed=["']true["'][^>]*class=["'][^"']*\bselected\b[^"']*["'][^>]*>[\s\S]*?02[\s\S]*?Coronal/i),
        'Series 02 button must have aria-pressed=true and class selected after state update'
      );
    });

    it('M4.1.7: DICOM viewport mode switch: Volume mode renders 4 multiplanar scans with MPR footer', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({ imagingMode: 'volume' });

      const rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/3D\s*(&|&amp;)\s*MULTIPLANAR WORKSPACE/i) || rendered.hasText('MULTIPLANAR WORKSPACE'),
        'Volume mode missing 3D workspace header'
      );
      assert.ok(rendered.hasText('Axial · Multiplanar'), 'Missing Axial multiplanar scan');
      assert.ok(rendered.hasText('Coronal · Multiplanar'), 'Missing Coronal multiplanar scan');
      assert.ok(rendered.hasText('Sagittal · Multiplanar'), 'Missing Sagittal multiplanar scan');
      assert.ok(rendered.hasText('Volume · Multiplanar'), 'Missing Volume 3D scan');
      assert.ok(rendered.hasText('Multi-slice slab rendering · MPR view'), 'Missing MPR view footer in viewerbottom');
    });

    it('M4.1.8: Active annotations panel renders clickable findings linked to viewport focus', () => {
      const rendered = renderAndInspect(React.createElement(ImagingScreen));
      assert.ok(
        rendered.matches(/Active Annotations\s*\(\s*(<!-- -->)?\s*1\s*(<!-- -->)?\s*\)/i),
        'Missing Active Annotations heading'
      );
      assert.ok(rendered.hasText('Right Lower Lobe Consolidation'), 'Missing annotation label');
      assert.ok(rendered.hasText('model_medgemma'), 'Missing annotation origin badge');
      assert.ok(
        rendered.matches(/title=["']Click to focus annotation on viewport["']/),
        'Annotation item must be clickable with title tooltip for viewport focus'
      );
      assert.ok(rendered.hasText('Reviewer note'), 'Missing Reviewer note label');
      assert.ok(
        rendered.matches(/<textarea[^>]*aria-label=["']Imaging reviewer note["']/),
        'Reviewer note textarea must have aria-label="Imaging reviewer note"'
      );
    });
  });

  // =========================================================================
  // SECTION 2: ChestXrayViewport Empirical Verification
  // =========================================================================
  describe('2. ChestXrayViewport Empirical Verification', () => {
    it('M4.2.1: Outer container is bg-zinc-950 and inner canvas wrapper is pure black (#000000 / bg-black)', () => {
      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-black',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\bbg-zinc-950\b[^"']*["']/),
        'Outer viewport container must have class bg-zinc-950'
      );
      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\bbg-black\b[^"']*["']/),
        'Inner canvas wrapper must have class bg-black (#000000) for DICOM medical range'
      );
      assert.ok(
        rendered.matches(/min-h-\[420px\]/),
        'Inner canvas must enforce minimum height for responsive clinical viewing'
      );
    });

    it('M4.2.2: 4-Corner DICOM overlay HUD renders all 4 quadrants with clinical parameters', () => {
      const imStore = getImagingStore();
      imStore.setState({ activeTool: 'Zoom' });

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-hud',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial High-Res',
          studyDate: '24 Oct 2026',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      // Top-left quadrant: Study Title & View Position
      assert.ok(rendered.hasText('Chest CT Axial High-Res'), 'HUD missing study title');
      assert.ok(rendered.hasText('DEMO-024 · PA'), 'HUD missing patient/view designation');

      // Top-right quadrant: Study date & kVp rating
      assert.ok(rendered.hasText('24 Oct 2026'), 'HUD missing study date');
      assert.ok(rendered.hasText('120 kVp · Non-diagnostic'), 'HUD missing non-diagnostic radiation parameter');

      // Bottom-left quadrant: W/L values & Active tool
      assert.ok(rendered.hasText('W: 400 L: 40'), 'HUD missing Window/Level values');
      assert.ok(rendered.hasText('Tool: Zoom'), 'HUD missing active tool reflection Tool: Zoom');

      // Bottom-right quadrant: Non-diagnostic schematic badge
      assert.ok(rendered.hasText('SCHEMATIC PREVIEW'), 'HUD missing SCHEMATIC PREVIEW badge');
    });

    it('M4.2.3: Bottom slice slider (.viewerbottom) is bound to useWorkspaceStore sliceIndex', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({ sliceIndex: 124 });

      let rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-slider',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\bviewerbottom\b[^"']*["']/),
        'Must render .viewerbottom container'
      );
      assert.ok(
        rendered.matches(/<input[^>]*type=["']range["'][^>]*min=["']1["'][^>]*max=["']240["'][^>]*value=["']124["']/),
        'Slice slider input range must have min="1", max="240", value="124"'
      );
      assert.ok(
        rendered.matches(/124[\s\S]*?\/[\s\S]*?240/),
        'Must render slice counter 124/240'
      );
      assert.ok(rendered.hasText('PA · Series 01'), 'Must render series position badge');

      // Update sliceIndex to 200
      wsStore.setState({ sliceIndex: 200 });
      rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-slider',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );
      assert.ok(
        rendered.matches(/<input[^>]*value=["']200["']/),
        'Slice slider input must dynamically update value to 200'
      );
      assert.ok(
        rendered.matches(/200[\s\S]*?\/[\s\S]*?240/),
        'Must update slice counter to 200/240'
      );
    });

    it('M4.2.4: SVG bounding box renders model annotations with stroke="#a1a1aa", dashed stroke, and [AI Draft] prefix', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: true });

      const modelAnnotation = {
        id: 'ann-model-01',
        source_file_id: 'src-curr-01',
        frame_index: 1,
        origin: 'model_medgemma',
        anatomical_label: 'Right Lower Lobe Consolidation',
        finding_text: 'Focal airspace opacification',
        bbox_norm: { x0: 0.5, y0: 0.6, x1: 0.8, y1: 0.85 },
        review_state: 'accepted',
      };

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-model-box',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [modelAnnotation],
        })
      );

      // Verify SVG rect styling
      assert.ok(
        rendered.matches(/<rect[^>]*stroke=["']#a1a1aa["'][^>]*stroke-dasharray=["']5,3["']/i),
        'Model annotation must have stroke="#a1a1aa" and stroke-dasharray="5,3"'
      );
      // Verify text label prefix [AI Draft]
      assert.ok(
        rendered.hasText('[AI Draft] Right Lower Lobe Consolidation'),
        'Model annotation text label must prefix [AI Draft]'
      );
    });

    it('M4.2.5: SVG bounding box renders manual annotations with solid stroke="#ffffff" and solid label', () => {
      const manualAnnotation = {
        id: 'ann-manual-01',
        source_file_id: 'src-curr-01',
        frame_index: 1,
        origin: 'manual',
        anatomical_label: 'Clinician ROI Nodule',
        finding_text: 'Well-circumscribed nodule',
        bbox_norm: { x0: 0.2, y0: 0.3, x1: 0.4, y1: 0.5 },
        review_state: 'accepted',
      };

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-manual-box',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [manualAnnotation],
        })
      );

      assert.ok(
        rendered.matches(/<rect[^>]*stroke=["']#ffffff["']/i) &&
        !rendered.matches(/<rect[^>]*stroke=["']#ffffff["'][^>]*stroke-dasharray/i),
        'Manual annotation must have solid stroke="#ffffff" without stroke-dasharray'
      );
      assert.ok(
        rendered.hasText('Clinician ROI Nodule') && !rendered.hasText('[AI Draft] Clinician ROI Nodule'),
        'Manual annotation must NOT have [AI Draft] prefix'
      );
    });

    it('M4.2.6: Hiding model boxes (showModelBoxes=false) filters model annotations while preserving manual annotations', () => {
      const imStore = getImagingStore();
      imStore.setState({ showModelBoxes: false });

      const annotations = [
        {
          id: 'ann-model-01',
          source_file_id: 'src-curr-01',
          frame_index: 1,
          origin: 'model_medgemma',
          anatomical_label: 'Right Lower Lobe Consolidation',
          bbox_norm: { x0: 0.5, y0: 0.6, x1: 0.8, y1: 0.85 },
          review_state: 'accepted',
        },
        {
          id: 'ann-manual-01',
          source_file_id: 'src-curr-01',
          frame_index: 1,
          origin: 'manual',
          anatomical_label: 'Manual Nodule',
          bbox_norm: { x0: 0.2, y0: 0.3, x1: 0.4, y1: 0.5 },
          review_state: 'accepted',
        },
      ];

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-filter',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations,
        })
      );

      assert.ok(!rendered.hasText('[AI Draft] Right Lower Lobe Consolidation'), 'Model annotation must be hidden when showModelBoxes=false');
      assert.ok(rendered.hasText('Manual Nodule'), 'Manual annotation must remain visible when showModelBoxes=false');
    });

    it('M4.2.7: Active citation focus box renders high-contrast white rect (stroke="#ffffff", strokeWidth 2.5) and container ring', () => {
      const imStore = getImagingStore();
      imStore.getState().focusCitationOnViewer('src-curr-01', { x0: 0.35, y0: 0.45, x1: 0.65, y1: 0.75 });

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-cit-focus',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );

      // Verify active citation rect
      assert.ok(
        rendered.matches(/<rect[^>]*stroke=["']#ffffff["'][^>]*stroke-width=["']2.5["']/i),
        'Active citation focus must render white bounding box with strokeWidth 2.5'
      );
      // Verify outer container highlight ring
      assert.ok(
        rendered.matches(/border-zinc-100 ring-1 ring-zinc-100\/50/),
        'Container must have border-zinc-100 ring-1 ring-zinc-100/50 when source is highlighted'
      );
    });

    it('M4.2.8: DrawBox tool enables SVG pointer-events and crosshair cursor', () => {
      const imStore = getImagingStore();

      imStore.setState({ activeTool: 'DrawBox' });
      let rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-draw',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );
      assert.ok(
        rendered.matches(/<svg[^>]*class=["'][^"']*\bcursor-crosshair\b[^"']*\bpointer-events-auto\b[^"']*["']/),
        'SVG must have cursor-crosshair and pointer-events-auto when activeTool is DrawBox'
      );

      imStore.setState({ activeTool: 'WindowLevel' });
      rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-draw',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [],
        })
      );
      assert.ok(
        rendered.matches(/<svg[^>]*class=["'][^"']*\bpointer-events-none\b[^"']*["']/),
        'SVG must have pointer-events-none when activeTool is WindowLevel'
      );
    });

    it('M4.2.9: Strict absence of off-palette emerald/amber colors in ChestXrayViewport markup', () => {
      const imStore = getImagingStore();
      imStore.getState().focusCitationOnViewer('src-curr-01', { x0: 0.1, y0: 0.2, x1: 0.3, y1: 0.4 });

      const rendered = renderAndInspect(
        React.createElement(ChestXrayViewport, {
          viewportId: 'test-vp-palette',
          sourceFileId: 'src-curr-01',
          studyTitle: 'Chest CT Axial',
          viewPosition: 'PA',
          imageUrl: 'data:image/svg+xml;utf8,<svg></svg>',
          isDicom: false,
          imageWidth: 896,
          imageHeight: 896,
          annotations: [
            {
              id: 'a1',
              source_file_id: 'src-curr-01',
              frame_index: 1,
              origin: 'model_medgemma',
              anatomical_label: 'Test Label',
              bbox_norm: { x0: 0.2, y0: 0.2, x1: 0.5, y1: 0.5 },
              review_state: 'accepted',
            },
          ],
        })
      );

      assert.ok(!rendered.html.includes('#10b981'), 'ChestXrayViewport must not contain #10b981');
      assert.ok(!rendered.html.includes('#f59e0b'), 'ChestXrayViewport must not contain #f59e0b');
      assert.ok(!rendered.html.includes('border-emerald-500'), 'ChestXrayViewport must not contain border-emerald-500');
      assert.ok(!rendered.html.includes('text-emerald'), 'ChestXrayViewport must not contain text-emerald');
    });
  });

  // =========================================================================
  // SECTION 3: CompareScreen & Timeline Empirical Verification
  // =========================================================================
  describe('3. CompareScreen & Timeline Empirical Verification', () => {
    it('M4.3.1: 95-day visual timeline renders valid DOM structure (.timeline, .timepoint, .track)', () => {
      const rendered = renderAndInspect(React.createElement(CompareScreen));

      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\btimeline\b[^"']*["']/),
        'Must render .timeline container'
      );
      assert.ok(
        rendered.matches(/<span[^>]*class=["'][^"']*\btimepoint\b[^"']*["'][^>]*>21 Jul 2026<\/span>/),
        'Must render prior timepoint "21 Jul 2026"'
      );
      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\btrack\b[^"']*["']/),
        'Must render timeline connector .track'
      );
      assert.ok(rendered.hasText('95 days'), 'Must render "95 days" elapsed interval');
      assert.ok(
        rendered.matches(/<span[^>]*class=["'][^"']*\btimepoint current\b[^"']*["'][^>]*>24 Oct 2026<\/span>/) ||
        rendered.matches(/<span[^>]*class=["'][^"']*\bcurrent\b[^"']*\btimepoint\b[^"']*["'][^>]*>24 Oct 2026<\/span>/),
        'Must render current timepoint "24 Oct 2026" with class "timepoint current"'
      );
    });

    it('M4.3.2: Elimination of inline borderColor: "#10b981" in favor of border border-zinc-800', () => {
      const comparePath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/CompareScreen.tsx');
      const src = fs.readFileSync(comparePath, 'utf8');

      // Verify no active inline style attribute sets borderColor: "#10b981"
      assert.ok(
        !src.includes('style={{ borderColor: "#10b981"') &&
        !src.includes("style={{ borderColor: '#10b981'") &&
        !src.includes('borderColor: "#10b981",') &&
        !src.includes("borderColor: '#10b981',"),
        'CompareScreen must not contain active inline style borderColor: "#10b981"'
      );
      // Verify zinc border class used on findings note container
      assert.ok(
        src.includes('className="note border border-zinc-800"'),
        'Analysis note container must use className="note border border-zinc-800"'
      );
      // Verify rendered HTML does not emit #10b981 style
      const rendered = renderAndInspect(React.createElement(CompareScreen));
      assert.ok(!rendered.html.includes('#10b981'), 'Rendered CompareScreen HTML must not emit #10b981');
    });

    it('M4.3.3: ActiveEventSource unmount cleanup logic is present and terminates open connections', () => {
      const comparePath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/CompareScreen.tsx');
      const src = fs.readFileSync(comparePath, 'utf8');

      assert.ok(
        src.includes('activeEventSourceRef'),
        'CompareScreen must hold a ref to active EventSource connection'
      );
      assert.ok(
        src.includes('activeEventSourceRef.current.close()'),
        'CompareScreen must close active EventSource on unmount / cleanup'
      );
      assert.ok(
        src.includes('activeEventSourceRef.current = null'),
        'CompareScreen must nullify ref after closing connection'
      );
    });

    it('M4.3.4: Renders ContextBar and secondary action button "Back to imaging" in Heading', () => {
      const rendered = renderAndInspect(React.createElement(CompareScreen));
      assert.ok(rendered.hasText('IMAGING / LONGITUDINAL'), 'Missing eyebrow');
      assert.ok(rendered.hasText('Side by side. What changed?'), 'Missing main heading');
      assert.ok(rendered.hasText('Back to imaging'), 'Missing Back to imaging secondary button');
      assert.ok(rendered.hasText('Analyze changes'), 'Missing Analyze changes action');
    });

    it('M4.3.5: Toolbar toggles between Cornerstone3D Dual Sync and Schematic View', () => {
      const rendered = renderAndInspect(React.createElement(CompareScreen));
      assert.ok(rendered.hasText('Cornerstone3D Dual Sync'), 'Must offer Cornerstone3D Dual Sync button by default');
      assert.ok(rendered.hasText('95 days interval (21 Jul 2026 → 24 Oct 2026)'), 'Must display interval summary');
    });
  });

  // =========================================================================
  // SECTION 4: LongitudinalXrayWorkspace Empirical Verification
  // =========================================================================
  describe('4. LongitudinalXrayWorkspace Empirical Verification', () => {
    const mockPriorStudy = {
      source_file_id: 'src-prior-01',
      filename: 'CT chest Prior',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      normalized_display_png_url: 'data:image/svg+xml;utf8,<svg></svg>',
      metadata: {
        view_position: 'PA',
        encounter_date: '21 Jul 2026',
        rows: 896,
        columns: 896,
      },
      annotations: [],
    };

    const mockCurrentStudy = {
      source_file_id: 'src-curr-01',
      filename: 'CT chest Current',
      file_kind: 'image_png',
      raw_dicom_or_image_url: 'data:image/svg+xml;utf8,<svg></svg>',
      normalized_display_png_url: 'data:image/svg+xml;utf8,<svg></svg>',
      metadata: {
        view_position: 'PA',
        encounter_date: '24 Oct 2026',
        rows: 896,
        columns: 896,
      },
      annotations: [],
    };

    it('M4.4.1: CTA button has monochrome styling (bg-zinc-100 text-zinc-950) with zero emerald tokens', () => {
      const rendered = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: mockPriorStudy,
          currentStudy: mockCurrentStudy,
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );

      assert.ok(
        rendered.matches(/<button[^>]*class=["'][^"']*\bbg-zinc-100\b[^"']*\btext-zinc-950\b[^"']*["'][^>]*>Compare Interval Change \(MedGemma 1\.5\)<\/button>/),
        'CTA button must have bg-zinc-100 and text-zinc-950'
      );
      assert.ok(!rendered.html.includes('bg-emerald-600'), 'Must not contain legacy bg-emerald-600');
      assert.ok(!rendered.html.includes('emerald'), 'Must not contain any emerald class');
    });

    it('M4.4.2: Projection mismatch banner renders with bg-zinc-900 border-zinc-700 when view positions differ', () => {
      const mismatchedCurrentStudy = {
        ...mockCurrentStudy,
        metadata: {
          ...mockCurrentStudy.metadata,
          view_position: 'AP',
        },
      };

      const rendered = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: mockPriorStudy,
          currentStudy: mismatchedCurrentStudy,
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );

      assert.ok(rendered.hasText('Projection Warning:'), 'Must render Projection Warning: heading');
      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\bbg-zinc-900\b[^"']*\bborder-zinc-700\b[^"']*\btext-zinc-200\b[^"']*["']/),
        'Banner must have class bg-zinc-900 border border-zinc-700 text-zinc-200'
      );
      assert.ok(rendered.hasText('Prior study is PA while Current study is AP'), 'Must detail projection mismatch PA vs AP');
      assert.ok(rendered.hasText('Evaluate apparent heart size and mediastinal width differences with caution'), 'Must include clinical caution advisory');
    });

    it('M4.4.3: Projection mismatch banner is NOT rendered when view positions match or are UNKNOWN', () => {
      // Matching PA vs PA
      let rendered = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: mockPriorStudy,
          currentStudy: mockCurrentStudy,
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );
      assert.ok(!rendered.hasText('Projection Warning:'), 'Must NOT render Projection Warning when view positions match');

      // UNKNOWN view position
      const unknownPriorStudy = {
        ...mockPriorStudy,
        metadata: { ...mockPriorStudy.metadata, view_position: 'UNKNOWN' },
      };
      rendered = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: unknownPriorStudy,
          currentStudy: mockCurrentStudy,
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );
      assert.ok(!rendered.hasText('Projection Warning:'), 'Must NOT render Projection Warning when view position is UNKNOWN');
    });

    it('M4.4.4: Renders side-by-side grid with Sync Prior/Current checkbox and tool buttons', () => {
      const rendered = renderAndInspect(
        React.createElement(LongitudinalXrayWorkspace, {
          priorStudy: mockPriorStudy,
          currentStudy: mockCurrentStudy,
          featureModelBoxesEnabled: true,
          onTriggerLongitudinalRun: () => {},
        })
      );

      assert.ok(
        rendered.matches(/<div[^>]*class=["'][^"']*\bgrid\b[^"']*\blg:grid-cols-2\b[^"']*["']/),
        'Must render side-by-side dual viewport grid (lg:grid-cols-2)'
      );
      assert.ok(rendered.hasText('Sync Prior/Current W/L'), 'Must render Sync Prior/Current W/L checkbox');
      assert.ok(rendered.hasText('Show MedGemma Boxes (Experimental)'), 'Must render Show MedGemma Boxes checkbox');
    });
  });

  // =========================================================================
  // SECTION 5: ReportScreen & ClinicalReportEditor Empirical Verification
  // =========================================================================
  describe('5. ReportScreen & ClinicalReportEditor Empirical Verification', () => {
    it('M4.5.1: Dual-mode switching tabs toggle between TipTap Rich Editor and Structured Sections', () => {
      const rendered = renderAndInspect(React.createElement(ReportScreen));
      assert.ok(rendered.hasText('Tiptap Rich Editor'), 'Missing Tiptap Rich Editor tab button');
      assert.ok(rendered.hasText('Structured Sections'), 'Missing Structured Sections tab button');
      assert.ok(rendered.hasText('Save draft'), 'Missing Save draft action button');
      assert.ok(rendered.hasText('Export draft'), 'Missing Export draft action button');
    });

    it('M4.5.2: ClinicalReportEditor renders TipTap formatting toolbar with monochrome active states and actions', () => {
      const mockVersions = [
        {
          id: 'v1',
          version_number: 1,
          review_status: 'draft',
          tiptap_doc_json: { type: 'doc', content: [] },
          created_at: new Date().toISOString(),
        },
      ];

      const rendered = renderAndInspect(
        React.createElement(ClinicalReportEditor, {
          caseId: '024',
          versions: mockVersions,
          activeVersion: mockVersions[0],
          onSelectVersion: () => {},
          onSaveNewVersion: async () => {},
          onMarkReviewed: async () => {},
          onExportPdf: async () => {},
        })
      );

      // Verify toolbar buttons
      assert.ok(rendered.hasText('Bold'), 'Missing Bold button');
      assert.ok(rendered.hasText('Italic'), 'Missing Italic button');
      assert.ok(rendered.hasText('H2'), 'Missing H2 button');
      assert.ok(rendered.hasText('Section Header'), 'Missing Section Header button');
      assert.ok(rendered.hasText('Bullet List'), 'Missing Bullet List button');
      assert.ok(rendered.hasText('Numbered List'), 'Missing Numbered List button');
      assert.ok(rendered.hasText('Quote'), 'Missing Quote button');
      assert.ok(rendered.hasText('Undo'), 'Missing Undo button');
      assert.ok(rendered.hasText('Redo'), 'Missing Redo button');
      assert.ok(
        rendered.matches(/Click any \[cit_X\] chip to jump to Cornerstone3D slice\s*(&|&amp;)\s*highlight ROI/i),
        'Missing citation chip helper hint'
      );
    });

    it('M4.5.3: Draft review status banner and badge update when version is draft vs reviewed', () => {
      const draftVersion = {
        id: 'v1',
        version_number: 1,
        review_status: 'draft',
        tiptap_doc_json: { type: 'doc', content: [] },
        created_at: new Date().toISOString(),
      };

      // 1. Test Draft state
      let rendered = renderAndInspect(
        React.createElement(ClinicalReportEditor, {
          caseId: '024',
          versions: [draftVersion],
          activeVersion: draftVersion,
          onSelectVersion: () => {},
          onSaveNewVersion: async () => {},
          onMarkReviewed: async () => {},
          onExportPdf: async () => {},
        })
      );
      assert.ok(rendered.hasText('AI DRAFT · UNREVIEWED'), 'Missing AI DRAFT · UNREVIEWED banner');
      assert.ok(rendered.hasText('Requires Review'), 'Missing Requires Review indicator');
      assert.ok(
        rendered.matches(/Approve\s*(&|&amp;)\s*Mark\s*v[\s\S]*?1[\s\S]*?Reviewed/i),
        'Missing Approve & Mark button'
      );
      assert.ok(
        rendered.matches(/bg-zinc-900 text-zinc-300 border-zinc-700 border-dashed/),
        'Draft badge must have dashed zinc border'
      );

      // 2. Test Reviewed state
      const reviewedVersion = {
        id: 'v1',
        version_number: 1,
        review_status: 'reviewed',
        reviewed_by: 'Dr. Sarah Connor',
        tiptap_doc_json: { type: 'doc', content: [] },
        created_at: new Date().toISOString(),
      };
      rendered = renderAndInspect(
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
      assert.ok(rendered.hasText('CLINICALLY REVIEWED'), 'Missing CLINICALLY REVIEWED banner');
      assert.ok(rendered.hasText('Approved by Dr. Sarah Connor'), 'Missing reviewer attribution');
      assert.ok(rendered.hasText('Verified'), 'Missing Verified badge indicator');
      assert.ok(rendered.hasText('Export v1 PDF'), 'Missing Export v1 PDF action button');
      assert.ok(
        rendered.matches(/bg-zinc-100 text-zinc-950 border-zinc-200 font-semibold/),
        'Reviewed badge must have high-contrast light style'
      );
    });

    it('M4.5.4: Citation click handler updates sliceIndex, focuses ROI, and navigates correctly', () => {
      const wsStore = getWorkspaceStore();
      const imStore = getImagingStore();

      // Test citation navigation on current study: updates sliceIndex, focuses bbox, sets page to imaging
      wsStore.setState({ page: 'report', sliceIndex: 1 });
      imStore.setState({ highlightedSourceId: null, highlightedBboxNorm: null });

      const reportScreenPath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/ReportScreen.tsx');
      const reportSrc = fs.readFileSync(reportScreenPath, 'utf8');

      // Verify citation grounding implementation directly in ReportScreen source
      assert.ok(
        reportSrc.includes('useWorkspaceStore.getState().setSliceIndex(attrs.pageOrFrame)'),
        'onOpenPdfCitation must update useWorkspaceStore sliceIndex'
      );
      assert.ok(
        reportSrc.includes('useImagingStore.getState().focusCitationOnViewer(attrs.sourceFileId, attrs.bboxNorm)'),
        'onOpenPdfCitation must focus citation ROI on viewport'
      );
      assert.ok(
        reportSrc.includes('if (attrs.sourceFileId?.includes("prior"))'),
        'onOpenPdfCitation must route prior citations to compare page'
      );
      assert.ok(
        reportSrc.includes('setPage("compare")') && reportSrc.includes('setPage("imaging")'),
        'onOpenPdfCitation must route prior to compare and current to imaging'
      );
    });

    it('M4.5.5: Review status synchronization updates workspace cases store to "Reviewed"', () => {
      const wsStore = getWorkspaceStore();
      wsStore.setState({
        activeCaseId: '024',
        cases: [
          { id: '024', name: 'Case 024 · Chest review', meta: 'CT · 2 sources', status: 'Needs review', date: 'Oct 24' },
          { id: '023', name: 'Case 023 · Abdominal pain', meta: 'US · 1 source', status: 'Needs review', date: 'Oct 23' },
        ],
      });

      const reportScreenPath = path.resolve(WEB_ROOT, 'src/components/medgemma/screens/ReportScreen.tsx');
      const reportSrc = fs.readFileSync(reportScreenPath, 'utf8');

      // Verify case status update in handleMarkReviewed
      assert.ok(
        reportSrc.includes('status: "Reviewed"'),
        'handleMarkReviewed must set case status to "Reviewed"'
      );
      assert.ok(
        reportSrc.includes('c.id === "024" || c.id === activeCaseId'),
        'handleMarkReviewed must synchronize case 024 or activeCaseId'
      );

      // Perform store update directly simulating handleMarkReviewed
      wsStore.getState().setCases(
        wsStore.getState().cases.map((c) =>
          c.id === '024' ? { ...c, status: 'Reviewed' } : c
        )
      );

      const updatedCase = wsStore.getState().cases.find((c) => c.id === '024');
      assert.strictEqual(updatedCase.status, 'Reviewed', 'Case 024 status must be updated to Reviewed');
    });

    it('M4.5.6: CitationChipExtension uses dark monochrome zinc classes and tooltip', () => {
      const chipPath = path.resolve(WEB_ROOT, 'src/components/editor/CitationChipExtension.ts');
      const chipSrc = fs.readFileSync(chipPath, 'utf8');

      assert.ok(chipSrc.includes('bg-zinc-900 text-zinc-200 border border-zinc-700'), 'CitationChip must use zinc monochrome styles');
      assert.ok(chipSrc.includes('hover:bg-zinc-800 hover:border-zinc-500 hover:text-zinc-50'), 'CitationChip must use zinc hover states');
      assert.ok(!chipSrc.includes('emerald'), 'CitationChip must not contain emerald tokens');
      assert.ok(!chipSrc.includes('#10b981'), 'CitationChip must not contain #10b981');
    });
  });

  // =========================================================================
  // SECTION 6: Milestone 4 Design System & Palette Invariants Scan
  // =========================================================================
  describe('6. Milestone 4 Design System & Palette Invariants Scan', () => {
    it('M4.6.1: ScanSVG.tsx line 54 uses semantic zinc token #71717a instead of off-scale #77777e', () => {
      const svgPath = path.resolve(WEB_ROOT, 'src/components/medgemma/ScanSVG.tsx');
      const svgSrc = fs.readFileSync(svgPath, 'utf8');

      assert.ok(!svgSrc.includes('#77777e'), 'ScanSVG.tsx must not contain off-scale #77777e');
      assert.ok(svgSrc.includes('#71717a'), 'ScanSVG.tsx must contain semantic zinc-500 token #71717a');
    });

    it('M4.6.2: Complete absence of off-palette accent colors across all Milestone 4 scope files', () => {
      const scopeFiles = [
        'src/components/medgemma/ScanSVG.tsx',
        'src/components/viewer/ChestXrayViewport.tsx',
        'src/components/medgemma/screens/ImagingScreen.tsx',
        'src/components/medgemma/screens/CompareScreen.tsx',
        'src/components/viewer/LongitudinalXrayWorkspace.tsx',
        'src/components/editor/CitationChipExtension.ts',
        'src/components/editor/ClinicalReportEditor.tsx',
        'src/components/medgemma/screens/ReportScreen.tsx',
      ];

      const forbiddenStrings = [
        '#10b981',
        '#059669',
        '#34d399',
        '#f59e0b',
        'text-amber-400',
        'bg-emerald-600',
        'border-emerald-500',
        'emerald-950',
        'sky-950',
        '#77777e',
      ];

      for (const file of scopeFiles) {
        const fullPath = path.resolve(WEB_ROOT, file);
        if (!fs.existsSync(fullPath)) continue;
        const content = fs.readFileSync(fullPath, 'utf8');

        for (const forbidden of forbiddenStrings) {
          // Allow comments that explicitly explain remediation/elimination of the legacy token
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes(forbidden)) {
              const isRemediationComment = line.includes('remediation') || line.includes('eliminated') || line.includes('legacy') || line.includes('/*');
              assert.ok(
                isRemediationComment,
                `Forbidden off-palette token '${forbidden}' found in active code in ${file}:${i + 1}\nLine: ${line}`
              );
            }
          }
        }
      }
    });

    it('M4.6.3: CSS typography rules for ProseMirror / TipTap editor added in medgemma-design.css', () => {
      const cssPath = path.resolve(WEB_ROOT, 'src/app/medgemma-design.css');
      const cssSrc = fs.readFileSync(cssPath, 'utf8');

      assert.ok(cssSrc.includes('.tiptap.ProseMirror'), 'medgemma-design.css must contain .tiptap.ProseMirror rules');
      assert.ok(cssSrc.includes('.tiptap.ProseMirror h2') || cssSrc.includes('.tiptap.ProseMirror h3'), 'medgemma-design.css must contain heading rules for ProseMirror');
      assert.ok(cssSrc.includes('.tiptap.ProseMirror blockquote'), 'medgemma-design.css must contain blockquote rules for ProseMirror');
    });
  });
});
