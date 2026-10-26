import { Node, mergeAttributes } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  type NodeViewProps,
} from "@tiptap/react";
import React from "react";

export interface CitationChipAttrs {
  citationId: string;
  evidenceChunkId: string;
  sourceFileId: string;
  pageOrFrame: number;
  bboxNorm: { x0: number; y0: number; x1: number; y1: number } | null;
  verbatimQuote: string;
}

const CitationChipComponent: React.FC<NodeViewProps> = ({ node, extension }) => {
  const attrs = node.attrs as CitationChipAttrs;
  const onInspect = extension.options.onInspectCitation as
    | ((attrs: CitationChipAttrs) => void)
    | undefined;

  return React.createElement(
    NodeViewWrapper,
    {
      as: "span",
      className: "inline-block align-baseline mx-0.5 select-none",
    },
    React.createElement(
      "button",
      {
        type: "button",
        title: `${attrs.verbatimQuote || "Source citation"} (Page/Frame ${attrs.pageOrFrame})`,
        onClick: (e: React.MouseEvent) => {
          e.preventDefault();
          e.stopPropagation();
          onInspect?.(attrs);
        },
        className:
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium " +
          "bg-emerald-950/90 text-emerald-300 border border-emerald-700/70 " +
          "hover:bg-emerald-900 hover:border-emerald-400 transition cursor-pointer",
      },
      `[${attrs.citationId}]`,
      React.createElement(
        "span",
        { className: "text-[10px] text-emerald-400/80" },
        `p.${attrs.pageOrFrame}`
      )
    )
  );
};

export const CitationChipExtension = Node.create<{
  onInspectCitation?: (attrs: CitationChipAttrs) => void;
}>({
  name: "citationChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return {
      onInspectCitation: undefined,
    };
  },

  addAttributes() {
    return {
      citationId: { default: "cit_1" },
      evidenceChunkId: { default: "" },
      sourceFileId: { default: "" },
      pageOrFrame: { default: 1 },
      bboxNorm: { default: null },
      verbatimQuote: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-type="citation-chip"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "citation-chip" }),
      `[${HTMLAttributes.citationId}]`,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CitationChipComponent);
  },
});
