import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from functools import lru_cache
from typing import Any

import numpy as np
from PIL import Image

try:
    import pdfplumber
except ImportError:
    pdfplumber = None  # type: ignore

try:
    import pypdfium2 as pdfium
except ImportError:
    pdfium = None  # type: ignore

try:
    from rapidocr_onnxruntime import RapidOCR
except ImportError:
    RapidOCR = None  # type: ignore

try:
    from dateutil import parser as date_parser
except ImportError:
    date_parser = None  # type: ignore

PARSER_VERSION = "2.0.0-hybrid-ocr"

# Clinical section header patterns for chunk tagging
SECTION_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("allergies", re.compile(r"\b(allerg(?:y|ies)|adverse\s+reactions?)\b", re.IGNORECASE)),
    ("medications", re.compile(r"\b(medications?|prescriptions?|discharge\s+meds|current\s+meds)\b", re.IGNORECASE)),
    ("problems", re.compile(r"\b(problem\s+list|diagnos(?:is|es)|assessment|active\s+problems|pmh|past\s+medical)\b", re.IGNORECASE)),
    ("labs", re.compile(r"\b(lab(?:oratory)?\s+results?|hematology|chemistry|metabolic\s+panel)\b", re.IGNORECASE)),
    ("imaging", re.compile(r"\b(impression|findings|radiology|chest\s+x-?ray|cxr)\b", re.IGNORECASE)),
]

DATE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\b(?:date(?:\s+of\s+service|\s+of\s+visit)?|dos|admission\s+date|encounter\s+date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})", re.IGNORECASE),
    re.compile(r"\b(\d{4}-\d{2}-\d{2})\b"),
]


@lru_cache(maxsize=1)
def get_cpu_ocr_engine() -> Any:
    """
    Singleton ONNX Runtime RapidOCR instance pinned to CPU.
    """
    if RapidOCR is not None:
        return RapidOCR(det_use_cuda=False, cls_use_cuda=False, rec_use_cuda=False)
    return None


@dataclass
class ExtractedChunkSpec:
    page_or_frame: int
    bbox_norm: dict[str, float]  # Top-left origin normalized [0.0 .. 1.0]
    section_type: str
    content_text: str
    extraction_method: str  # 'native_text' | 'pdfplumber_table' | 'rapidocr'


@dataclass
class ParsedDocumentResult:
    chunks: list[ExtractedChunkSpec] = field(default_factory=list)
    page_previews_png: dict[int, bytes] = field(default_factory=dict)
    encounter_date_iso: str | None = None
    page_count: int = 0
    ocr_page_numbers: list[int] = field(default_factory=list)
    parser_version: str = PARSER_VERSION


def clamp01(val: float) -> float:
    return round(max(0.0, min(1.0, float(val))), 4)


def detect_section_type(text: str, default: str = "body") -> str:
    head = text[:200]
    for section_name, pattern in SECTION_PATTERNS:
        if pattern.search(head):
            return section_name
    return default


def _parse_date_string(raw: str) -> date | None:
    raw = raw.strip()
    if date_parser is not None:
        try:
            return date_parser.parse(raw, fuzzy=False).date()
        except (ValueError, OverflowError):
            pass
    for fmt in (
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d/%m/%Y",
        "%m-%d-%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
        "%d %b %Y",
        "%d %B %Y",
        "%m/%d/%y",
        "%d/%m/%y",
    ):
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def extract_encounter_date_iso(text_sample: str) -> str | None:
    """
    Scans the first pages of a clinical record for an explicit encounter/service date.
    """
    for pattern in DATE_PATTERNS:
        match = pattern.search(text_sample)
        if match:
            raw_date = match.group(1)
            parsed = _parse_date_string(raw_date)
            if parsed and (1970 <= parsed.year <= date.today().year + 1):
                return parsed.isoformat()
    return None


def boxes_overlap(box_a: tuple[float, float, float, float], box_b: tuple[float, float, float, float]) -> bool:
    ax0, ay0, ax1, ay1 = box_a
    bx0, by0, bx1, by1 = box_b
    return not (ax1 <= bx0 or ax0 >= bx1 or ay1 <= by0 or ay0 >= by1)


def format_table_as_markdown(rows: list[list[str | None]]) -> str:
    cleaned_rows: list[list[str]] = []
    for row in rows:
        if not row or all(cell is None or not str(cell).strip() for cell in row):
            continue
        cleaned_rows.append([re.sub(r"\s+", " ", str(cell or "").strip()) for cell in row])
    if not cleaned_rows:
        return ""
    header = "| " + " | ".join(cleaned_rows[0]) + " |"
    divider = "| " + " | ".join(["---"] * len(cleaned_rows[0])) + " |"
    body = ["| " + " | ".join(r) + " |" for r in cleaned_rows[1:]]
    return "\n".join([header, divider, *body])


class HybridPdfOcrExtractor:
    """
    Extracts coordinate-grounded text blocks, structured Markdown tables, and
    scanned-page OCR spans from clinical PDFs and images.
    """

    def __init__(self, min_native_chars_per_page: int = 50, max_chunk_chars: int = 1200) -> None:
        self.min_native_chars = min_native_chars_per_page
        self.max_chunk_chars = max_chunk_chars

    def parse_pdf_bytes(self, raw_bytes: bytes) -> ParsedDocumentResult:
        result = ParsedDocumentResult()
        if pdfium is None:
            # Fallback if PDFium is not installed
            text = raw_bytes.decode("utf-8", errors="replace")[: self.max_chunk_chars]
            result.page_count = 1
            result.chunks.append(
                ExtractedChunkSpec(
                    page_or_frame=1,
                    bbox_norm={"x0": 0.05, "y0": 0.05, "x1": 0.95, "y1": 0.95},
                    section_type=detect_section_type(text),
                    content_text=text,
                    extraction_method="native_text",
                )
            )
            result.encounter_date_iso = extract_encounter_date_iso(text)
            return result

        pdfium_doc = pdfium.PdfDocument(io.BytesIO(raw_bytes))
        result.page_count = len(pdfium_doc)
        first_pages_text_accumulator: list[str] = []

        plumber_doc = pdfplumber.open(io.BytesIO(raw_bytes)) if pdfplumber is not None else None

        try:
            for page_idx in range(result.page_count):
                page_num = page_idx + 1
                pdfium_page = pdfium_doc[page_idx]

                # 1. Render 150 DPI page image for UI citation viewer & OCR fallback
                bitmap = pdfium_page.render(scale=150 / 72)
                try:
                    pil_img: Image.Image = bitmap.to_pil().convert("RGB")
                finally:
                    if hasattr(bitmap, "close"):
                        bitmap.close()
                png_buf = io.BytesIO()
                pil_img.save(png_buf, format="PNG", optimize=True)
                result.page_previews_png[page_num] = png_buf.getvalue()

                if plumber_doc is not None and page_idx < len(plumber_doc.pages):
                    plumber_page = plumber_doc.pages[page_idx]
                    page_w = float(plumber_page.width or 1.0)
                    page_h = float(plumber_page.height or 1.0)

                    # 2. Extract structured tables via pdfplumber first
                    table_bboxes: list[tuple[float, float, float, float]] = []
                    for tbl in plumber_page.find_tables():
                        tx0, top, tx1, bottom = tbl.bbox
                        table_bboxes.append((tx0, top, tx1, bottom))
                        md_table = format_table_as_markdown(tbl.extract())
                        if len(md_table) >= 15:
                            result.chunks.append(
                                ExtractedChunkSpec(
                                    page_or_frame=page_num,
                                    bbox_norm={
                                        "x0": clamp01(tx0 / page_w),
                                        "y0": clamp01(top / page_h),
                                        "x1": clamp01(tx1 / page_w),
                                        "y1": clamp01(bottom / page_h),
                                    },
                                    section_type=detect_section_type(md_table, default="table"),
                                    content_text=md_table[: self.max_chunk_chars],
                                    extraction_method="pdfplumber_table",
                                )
                            )

                    # 3. Extract native text words outside table bounding boxes
                    words = plumber_page.extract_words(
                        x_tolerance=3, y_tolerance=3, keep_blank_chars=False
                    )
                    non_table_words = [
                        w
                        for w in words
                        if not any(
                            boxes_overlap(
                                (float(w["x0"]), float(w["top"]), float(w["x1"]), float(w["bottom"])),
                                tb,
                            )
                            for tb in table_bboxes
                        )
                    ]
                    native_char_count = sum(len(w["text"]) for w in non_table_words)

                    if native_char_count >= self.min_native_chars:
                        page_chunks = self._group_words_into_chunks(
                            non_table_words, page_num, page_w, page_h
                        )
                        result.chunks.extend(page_chunks)
                        if page_num <= 2:
                            first_pages_text_accumulator.extend(c.content_text for c in page_chunks)
                    else:
                        # 4. Scanned Page Fallback -> RapidOCR on CPU
                        ocr_chunks = self._run_rapidocr_on_image(pil_img, page_num)
                        if ocr_chunks:
                            result.ocr_page_numbers.append(page_num)
                            result.chunks.extend(ocr_chunks)
                            if page_num <= 2:
                                first_pages_text_accumulator.extend(c.content_text for c in ocr_chunks)
                else:
                    # Fallback textpage via pdfium
                    textpage = pdfium_page.get_textpage()
                    text = textpage.get_text_range().strip()
                    if text:
                        result.chunks.append(
                            ExtractedChunkSpec(
                                page_or_frame=page_num,
                                bbox_norm={"x0": 0.05, "y0": 0.05, "x1": 0.95, "y1": 0.95},
                                section_type=detect_section_type(text),
                                content_text=text[: self.max_chunk_chars],
                                extraction_method="native_text",
                            )
                        )
                        if page_num <= 2:
                            first_pages_text_accumulator.append(text)
        finally:
            if plumber_doc is not None:
                plumber_doc.close()
            if hasattr(pdfium_doc, "close"):
                pdfium_doc.close()

        result.encounter_date_iso = extract_encounter_date_iso(
            "\n".join(first_pages_text_accumulator)
        )
        return result

    def _group_words_into_chunks(
        self,
        words: list[dict[str, Any]],
        page_num: int,
        page_w: float,
        page_h: float,
    ) -> list[ExtractedChunkSpec]:
        """
        Groups adjacent words into reading-order paragraphs while computing the exact
        union bounding box normalized to top-left [0.0 .. 1.0].
        """
        if not words:
            return []

        chunks: list[ExtractedChunkSpec] = []
        current_words: list[str] = []
        x0_min, y0_min, x1_max, y1_max = 1e9, 1e9, 0.0, 0.0
        prev_bottom: float | None = None
        current_char_len = 0
        active_section = "body"

        def flush_paragraph() -> None:
            nonlocal current_words, x0_min, y0_min, x1_max, y1_max, current_char_len, active_section
            text = " ".join(current_words).strip()
            if len(text) >= 15:
                active_section = detect_section_type(text, default=active_section)
                chunks.append(
                    ExtractedChunkSpec(
                        page_or_frame=page_num,
                        bbox_norm={
                            "x0": clamp01(x0_min / page_w),
                            "y0": clamp01(y0_min / page_h),
                            "x1": clamp01(x1_max / page_w),
                            "y1": clamp01(y1_max / page_h),
                        },
                        section_type=active_section,
                        content_text=text[: self.max_chunk_chars],
                        extraction_method="native_text",
                    )
                )
            current_words = []
            x0_min, y0_min, x1_max, y1_max = 1e9, 1e9, 0.0, 0.0
            current_char_len = 0

        for w in words:
            w_top = float(w["top"])
            w_bottom = float(w["bottom"])
            w_x0 = float(w["x0"])
            w_x1 = float(w["x1"])
            w_text = str(w["text"])

            # Start a new paragraph chunk on vertical gaps > 14pt or size cap
            is_para_break = prev_bottom is not None and (w_top - prev_bottom) > 14.0
            if current_words and (is_para_break or current_char_len + len(w_text) > 750):
                flush_paragraph()

            current_words.append(w_text)
            current_char_len += len(w_text) + 1
            x0_min = min(x0_min, w_x0)
            y0_min = min(y0_min, w_top)
            x1_max = max(x1_max, w_x1)
            y1_max = max(y1_max, w_bottom)
            prev_bottom = w_bottom

        if current_words:
            flush_paragraph()

        return chunks

    def _run_rapidocr_on_image(
        self, pil_img: Image.Image, page_num: int
    ) -> list[ExtractedChunkSpec]:
        """
        Runs RapidOCR on a rendered page or scanned document image and merges
        nearby OCR text lines into grounded chunks with normalized bounding boxes.
        """
        ocr_engine = get_cpu_ocr_engine()
        if ocr_engine is None:
            return []

        img_np = np.array(pil_img)
        img_h, img_w = img_np.shape[:2]

        ocr_result, _ = ocr_engine(img_np)
        if not ocr_result:
            return []

        chunks: list[ExtractedChunkSpec] = []
        buf_lines: list[str] = []
        x0_min, y0_min, x1_max, y1_max = 1e9, 1e9, 0.0, 0.0
        prev_y1: float | None = None
        active_section = "ocr_block"

        def flush_ocr_block() -> None:
            nonlocal buf_lines, x0_min, y0_min, x1_max, y1_max, active_section
            text = " ".join(buf_lines).strip()
            if len(text) >= 10:
                active_section = detect_section_type(text, default=active_section)
                chunks.append(
                    ExtractedChunkSpec(
                        page_or_frame=page_num,
                        bbox_norm={
                            "x0": clamp01(x0_min / img_w),
                            "y0": clamp01(y0_min / img_h),
                            "x1": clamp01(x1_max / img_w),
                            "y1": clamp01(y1_max / img_h),
                        },
                        section_type=active_section,
                        content_text=text[: self.max_chunk_chars],
                        extraction_method="rapidocr",
                    )
                )
            buf_lines = []
            x0_min, y0_min, x1_max, y1_max = 1e9, 1e9, 0.0, 0.0

        for detection in ocr_result:
            quad, text, confidence = detection
            if float(confidence) < 0.45 or not str(text).strip():
                continue
            xs = [float(pt[0]) for pt in quad]
            ys = [float(pt[1]) for pt in quad]
            lx0, ly0, lx1, ly1 = min(xs), min(ys), max(xs), max(ys)

            vertical_gap = (ly0 - prev_y1) if prev_y1 is not None else 0.0
            if buf_lines and (vertical_gap > (img_h * 0.025) or sum(len(s) for s in buf_lines) > 650):
                flush_ocr_block()

            buf_lines.append(str(text).strip())
            x0_min = min(x0_min, lx0)
            y0_min = min(y0_min, ly0)
            x1_max = max(x1_max, lx1)
            y1_max = max(y1_max, ly1)
            prev_y1 = ly1

        if buf_lines:
            flush_ocr_block()

        return chunks
