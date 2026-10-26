"use client";

import React, { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  CitationChipExtension,
  type CitationChipAttrs,
} from "./CitationChipExtension";
import { useImagingStore } from "@/stores/useImagingStore";

export interface ReportVersionRecord {
  id: string;
  version_number: number;
  review_status: "draft" | "reviewed" | "exported";
  tiptap_doc_json: Record<string, unknown>;
  created_at: string;
  reviewed_by?: string | null;
  export_download_url?: string | null;
}

interface ClinicalReportEditorProps {
  caseId: string;
  versions: ReportVersionRecord[];
  activeVersion: ReportVersionRecord;
  onSelectVersion: (versionNumber: number) => void;
  onSaveNewVersion: (tiptapJson: Record<string, unknown>) => Promise<void>;
  onMarkReviewed: (versionNumber: number) => Promise<void>;
  onExportPdf: (versionNumber: number) => Promise<void>;
  onOpenPdfCitation?: (attrs: CitationChipAttrs) => void;
}

export function ClinicalReportEditor({
  versions,
  activeVersion,
  onSelectVersion,
  onSaveNewVersion,
  onMarkReviewed,
  onExportPdf,
  onOpenPdfCitation,
}: ClinicalReportEditorProps) {
  const { focusCitationOnViewer } = useImagingStore();
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      CitationChipExtension.configure({
        onInspectCitation: (attrs) => {
          focusCitationOnViewer(attrs.sourceFileId, attrs.bboxNorm);
          onOpenPdfCitation?.(attrs);
        },
      }),
    ],
    content: activeVersion.tiptap_doc_json,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert max-w-none min-h-[380px] p-4 focus:outline-none text-sm leading-relaxed text-zinc-100",
      },
    },
  });

  // Load snapshot when switching between immutable report versions
  useEffect(() => {
    if (editor && activeVersion.tiptap_doc_json) {
      editor.commands.setContent(activeVersion.tiptap_doc_json);
    }
  }, [editor, activeVersion.id, activeVersion.tiptap_doc_json]);

  const handleSaveNewVersion = async () => {
    if (!editor) return;
    setIsSaving(true);
    try {
      await onSaveNewVersion(editor.getJSON() as Record<string, unknown>);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExportPdf(activeVersion.version_number);
    } finally {
      setIsExporting(false);
    }
  };

  const statusBadgeColor = {
    draft: "bg-zinc-800 text-zinc-300 border-zinc-700",
    reviewed: "bg-emerald-950 text-emerald-300 border-emerald-700",
    exported: "bg-sky-950 text-sky-300 border-sky-700",
  }[activeVersion.review_status];

  return (
    <div className="flex flex-col w-full bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Top Version & Workflow Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <label className="text-xs text-zinc-400 font-medium">Version:</label>
          <select
            value={activeVersion.version_number}
            onChange={(e) => onSelectVersion(Number(e.target.value))}
            className="bg-zinc-950 border border-zinc-800 rounded px-2.5 py-1 text-xs text-zinc-100"
          >
            {versions.map((v) => (
              <option key={v.id} value={v.version_number}>
                v{v.version_number} ({v.review_status.toUpperCase()})
              </option>
            ))}
          </select>

          <span
            className={`px-2 py-0.5 text-[11px] font-mono rounded border ${statusBadgeColor}`}
          >
            {activeVersion.review_status.toUpperCase()}
          </span>
        </div>

        {/* Immutable Workflow Actions: Edit -> Save New Version -> Review -> Export */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSaveNewVersion}
            disabled={isSaving}
            className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-medium transition disabled:opacity-50"
          >
            {isSaving
              ? "Saving..."
              : `Save as v${Math.max(...versions.map((v) => v.version_number), 0) + 1}`}
          </button>

          {activeVersion.review_status === "draft" && (
            <button
              type="button"
              onClick={() => onMarkReviewed(activeVersion.version_number)}
              className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
            >
              Approve & Mark v{activeVersion.version_number} Reviewed
            </button>
          )}

          {activeVersion.review_status !== "draft" && (
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition disabled:opacity-50"
            >
              {isExporting ? "Generating PDF..." : `Export v${activeVersion.version_number} PDF`}
            </button>
          )}

          {activeVersion.export_download_url && (
            <a
              href={activeVersion.export_download_url}
              target="_blank"
              rel="noreferrer"
              className="px-2.5 py-1.5 rounded-md bg-zinc-900 border border-sky-700 text-sky-300 text-xs font-mono hover:bg-zinc-800"
            >
              Download PDF
            </a>
          )}
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 px-4 py-1.5 bg-zinc-950 border-b border-zinc-900 text-xs text-zinc-400">
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className="px-2 py-1 rounded hover:bg-zinc-900 hover:text-zinc-100 font-semibold"
        >
          Bold
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
          className="px-2 py-1 rounded hover:bg-zinc-900 hover:text-zinc-100"
        >
          Section Header
        </button>
        <button
          type="button"
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className="px-2 py-1 rounded hover:bg-zinc-900 hover:text-zinc-100"
        >
          Bullet List
        </button>
        <span className="ml-auto text-[11px] text-zinc-500">
          Click any green [cit_X] chip to reopen its exact source region
        </span>
      </div>

      {/* Editor Body */}
      <EditorContent editor={editor} />
    </div>
  );
}
