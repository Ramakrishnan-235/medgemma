import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.services.visual_grounding import get_slice_grounding_annotations


def test_get_slice_grounding_lesion_slice():
    annotations = get_slice_grounding_annotations("CASE-2026-0894", slice_index=64)
    assert len(annotations) >= 1
    lesion = annotations[0]
    assert "lesion" in lesion.label.lower()
    assert lesion.box_1000.ymin < lesion.box_1000.ymax
    assert lesion.box_1000.xmin < lesion.box_1000.xmax

    # Coordinates must normalize to float [0..1]
    norm_y0, norm_x0, norm_y1, norm_x1 = lesion.box_1000.to_normalized_float()
    assert 0.0 <= norm_y0 < norm_y1 <= 1.0
    assert 0.0 <= norm_x0 < norm_x1 <= 1.0
    assert lesion.confidence > 0.90


def test_get_slice_grounding_spine_reference():
    # Slice 64 should also have anatomical references like vertebra/spine
    annotations = get_slice_grounding_annotations("CASE-2026-0894", slice_index=64)
    labels = [a.label.lower() for a in annotations]
    assert any("spine" in l or "vertebra" in l for l in labels)


def test_get_slice_grounding_distant_slice():
    # Slice 150 far from lesion should not have the hepatic dome lesion
    annotations = get_slice_grounding_annotations("CASE-2026-0894", slice_index=150)
    lesion_boxes = [a for a in annotations if "lesion" in a.label.lower()]
    assert len(lesion_boxes) == 0
