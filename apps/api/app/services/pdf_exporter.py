import io
from datetime import datetime, timezone
from typing import Any
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _tiptap_inline_to_reportlab_xml(content_nodes: list[dict[str, Any]]) -> str:
    """
    Converts Tiptap inline text + citationChip nodes into ReportLab Paragraph XML.
    """
    parts: list[str] = []
    for node in content_nodes:
        ntype = node.get("type")
        if ntype == "text":
            txt = escape(str(node.get("text", "")))
            marks = {m.get("type") for m in (node.get("marks") or []) if isinstance(m, dict)}
            if "bold" in marks:
                txt = f"<b>{txt}</b>"
            if "italic" in marks:
                txt = f"<i>{txt}</i>"
            parts.append(txt)
        elif ntype == "citationChip":
            attrs = node.get("attrs") or {}
            cit_id = escape(str(attrs.get("citationId", "cit")))
            page_num = escape(str(attrs.get("pageOrFrame", 1)))
            parts.append(
                f' <font name="Courier-Bold" size="8" color="#047857">[{cit_id} p.{page_num}]</font> '
            )
    return "".join(parts)


def render_clinical_report_pdf(
    case_title: str,
    patient_code: str,
    version_number: int,
    reviewed_by_str: str,
    tiptap_doc: dict[str, Any],
    citations_snapshot: list[dict[str, Any]],
    source_files_map: dict[str, dict[str, str]],
    run_metadata: dict[str, Any] | None,
) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Clinical Report - {patient_code} - v{version_number}",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#09090b"),
        spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        "MetaLine",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#52525b"),
    )
    h3_style = ParagraphStyle(
        "SectionH3",
        parent=styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        spaceBefore=10,
        spaceAfter=4,
        textColor=colors.HexColor("#18181b"),
    )
    body_style = ParagraphStyle(
        "ClinicalBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        spaceAfter=6,
        textColor=colors.HexColor("#18181b"),
    )
    cell_style = ParagraphStyle(
        "TableCell",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=10,
    )

    story: list[Any] = []

    # 1. Header Banner
    exported_ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    story.append(Paragraph(escape(f"Clinical Case Report: {case_title}"), title_style))
    story.append(
        Paragraph(
            escape(
                f"Patient Code: {patient_code}  |  Immutable Version: v{version_number}  |  "
                f"Reviewed By: {reviewed_by_str}  |  Exported: {exported_ts}"
            ),
            meta_style,
        )
    )
    story.append(Spacer(1, 3 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#d4d4d8")))
    story.append(Spacer(1, 4 * mm))

    # 2. Walk Tiptap Document AST
    for block in tiptap_doc.get("content", []) or []:
        btype = block.get("type")
        if btype == "heading":
            xml_text = _tiptap_inline_to_reportlab_xml(block.get("content", []))
            story.append(Paragraph(xml_text, h3_style))
        elif btype == "paragraph":
            xml_text = _tiptap_inline_to_reportlab_xml(block.get("content", []))
            if xml_text.strip():
                story.append(Paragraph(xml_text, body_style))
        elif btype == "bulletList":
            items: list[ListItem] = []
            for li in block.get("content", []) or []:
                for li_child in li.get("content", []) or []:
                    xml_text = _tiptap_inline_to_reportlab_xml(li_child.get("content", []))
                    if xml_text.strip():
                        items.append(ListItem(Paragraph(xml_text, body_style)))
            if items:
                story.append(ListFlowable(items, bulletType="bullet", leftIndent=12))

    # 3. Source Evidence & Cryptographic Provenance Appendix
    story.append(Spacer(1, 6 * mm))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#d4d4d8")))
    story.append(Paragraph("Source Evidence & Model Provenance Appendix", h3_style))

    if run_metadata:
        story.append(
            Paragraph(
                escape(
                    f"Model Checkpoint: {run_metadata.get('model_checkpoint', 'google/medgemma-1.5-4b-it')}  |  "
                    f"Processor: {run_metadata.get('processor_version', '1.5.0-896px')}  |  "
                    f"Prompt Template: {run_metadata.get('prompt_template_version', 'N/A')}"
                ),
                meta_style,
            )
        )
        story.append(Spacer(1, 3 * mm))

    if citations_snapshot:
        table_rows: list[list[Any]] = [
            [
                Paragraph("<b>Ref</b>", cell_style),
                Paragraph("<b>Source File (SHA-256 Prefix)</b>", cell_style),
                Paragraph("<b>Page / BBox</b>", cell_style),
                Paragraph("<b>Verified Excerpt</b>", cell_style),
            ]
        ]
        for cit in citations_snapshot:
            src_id = str(cit.get("source_file_id", ""))
            src_meta = source_files_map.get(src_id, {})
            fname = src_meta.get("filename", src_id[:8])
            sha_short = src_meta.get("sha256_hash", "N/A")[:12]
            bbox = cit.get("bbox_norm") or {}
            bbox_str = (
                f"({bbox.get('x0', 0):.2f}, {bbox.get('y0', 0):.2f}, "
                f"{bbox.get('x1', 1):.2f}, {bbox.get('y1', 1):.2f})"
                if bbox
                else "Full Frame"
            )
            table_rows.append(
                [
                    Paragraph(escape(f"[{cit.get('citation_id')}]"), cell_style),
                    Paragraph(escape(f"{fname}\nSHA256: {sha_short}..."), cell_style),
                    Paragraph(escape(f"p.{cit.get('page_or_frame', 1)}\n{bbox_str}"), cell_style),
                    Paragraph(escape(str(cit.get("verbatim_quote", ""))[:200]), cell_style),
                ]
            )

        ev_table = Table(table_rows, colWidths=[18 * mm, 48 * mm, 32 * mm, 76 * mm])
        ev_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f4f4f5")),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d4d4d8")),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("PADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(ev_table)

    story.append(Spacer(1, 4 * mm))
    story.append(
        Paragraph(
            "<b>Regulatory Notice:</b> Generated via MedGemma 1.5 research and reviewer workflow. "
            "Base model outputs require clinical validation and reviewer verification prior to clinical action.",
            meta_style,
        )
    )

    doc.build(story)
    return buf.getvalue()
