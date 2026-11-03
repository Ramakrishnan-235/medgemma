import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.schemas.ct_clinical import TargetedSliceVQARequest
from app.services.targeted_slice_vqa import answer_targeted_slice_question


def test_answer_targeted_slice_lesion_question():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=64,
        tissue_window="soft_tissue",
        question="Describe the focal lesion in the liver dome on this slice.",
    )
    ans = answer_targeted_slice_question(req)
    assert ans.slice_index == 64
    assert ans.confidence_score > 0.8
    assert "segment vii" in ans.answer_markdown.lower() or "hypodense" in ans.answer_markdown.lower()
    assert ans.grounded_box is not None
    assert ans.grounded_box.ymin > 0


def test_answer_targeted_slice_fracture_question():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=34,
        tissue_window="bone",
        question="Is there a fracture on slice 34?",
    )
    ans = answer_targeted_slice_question(req)
    assert ans.slice_index == 34
    assert "no acute fracture" in ans.answer_markdown.lower() or "intact" in ans.answer_markdown.lower()
    assert "Thoracic cage / Vertebral column" in ans.relevant_anatomical_regions


def test_answer_targeted_slice_lung_window_question():
    req = TargetedSliceVQARequest(
        case_id="CASE-2026-0894",
        slice_index=45,
        tissue_window="lung",
        question="Describe the soft tissue density in the right upper lobe",
    )
    ans = answer_targeted_slice_question(req)
    assert ans.slice_index == 45
    assert ans.confidence_score >= 0.85
    assert "lung parenchyma" in ans.answer_markdown.lower()

