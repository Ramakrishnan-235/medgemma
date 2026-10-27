import io
import os
import sys
import unittest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "gpu-service")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "gpu-service", "benchmarks")))

from PIL import Image

from app.services.hybrid_retrieval import (
    RetrievalEvalMetrics,
    evaluate_retrieval_predictions,
    retrieve_case_evidence_hybrid_rrf,
)
from app.services.volumetric_extension import (
    SampledVolumetricSlab,
    VolumetricSeriesAdapter,
    VolumetricSeriesDescriptor,
)
from benchmark_parity_and_perf import (
    EngineBenchmarkReport,
    ParityVerificationReport,
    benchmark_concurrency_tier,
    compute_box_iou_1000,
    create_synthetic_test_xray_bytes,
    token_jaccard,
    verify_transformers_vs_vllm_parity,
    normalize_medical_image_896,
)


class TestHybridRetrieval(unittest.IsolatedAsyncioTestCase):
    def test_evaluate_retrieval_predictions_empty(self) -> None:
        metrics = evaluate_retrieval_predictions("hybrid_rrf", [])
        self.assertEqual(metrics.mode, "hybrid_rrf")
        self.assertEqual(metrics.recall_at_5, 0.0)
        self.assertEqual(metrics.mrr_at_10, 0.0)
        self.assertEqual(metrics.abbreviation_hit_rate, 0.0)

    def test_evaluate_retrieval_predictions_metrics(self) -> None:
        c1 = uuid.uuid4()
        c2 = uuid.uuid4()
        c3 = uuid.uuid4()
        c4 = uuid.uuid4()
        c_other = [uuid.uuid4() for _ in range(15)]

        # Case 1: rank 1, abbrev query -> hit@5 and abbrev hit
        case_1 = {
            "expected_chunk_id": c1,
            "retrieved_chunk_ids": [c1] + c_other[:9],
            "is_abbreviation_query": True,
        }
        # Case 2: rank 3, not abbrev query -> hit@5
        case_2 = {
            "expected_chunk_id": c2,
            "retrieved_chunk_ids": [c_other[0], c_other[1], c2] + c_other[2:8],
            "is_abbreviation_query": False,
        }
        # Case 3: rank 8, abbrev query -> not hit@5, but hit in top 10
        case_3 = {
            "expected_chunk_id": c3,
            "retrieved_chunk_ids": c_other[:7] + [c3] + c_other[7:9],
            "is_abbreviation_query": True,
        }
        # Case 4: not in top 10
        case_4 = {
            "expected_chunk_id": c4,
            "retrieved_chunk_ids": c_other[:10],
            "is_abbreviation_query": False,
        }

        cases = [case_1, case_2, case_3, case_4]
        metrics = evaluate_retrieval_predictions("hybrid_rrf", cases)

        # Hits at 5: case 1 and case 2 = 2/4 = 0.5
        self.assertEqual(metrics.recall_at_5, 0.5)
        # Reciprocal ranks: 1/1 + 1/3 + 1/8 + 0 = 1.458333... / 4 = 0.3646
        self.assertAlmostEqual(metrics.mrr_at_10, 0.3646, places=4)
        # Abbreviation queries: case 1 (hit) and case 3 (miss at 5) -> 1/2 = 0.5
        self.assertEqual(metrics.abbreviation_hit_rate, 0.5)

    async def test_retrieve_case_evidence_hybrid_rrf(self) -> None:
        mock_db = AsyncMock()
        chunk_id_1 = uuid.uuid4()
        chunk_id_2 = uuid.uuid4()
        source_id = uuid.uuid4()

        mock_rows = [
            {
                "id": chunk_id_1,
                "source_file_id": source_id,
                "page_or_frame": 1,
                "bbox_norm": {"x0": 0.1, "y0": 0.1, "x1": 0.9, "y1": 0.2},
                "section_type": "labs",
                "content_text": "Serum hs-cTnI elevated at 45 ng/L.",
                "rrf_score": 0.0245,
            },
            {
                "id": chunk_id_2,
                "source_file_id": source_id,
                "page_or_frame": 2,
                "bbox_norm": {"x0": 0.1, "y0": 0.3, "x1": 0.9, "y1": 0.4},
                "section_type": "medications",
                "content_text": "Started on piperacillin-tazobactam 4.5g IV Q8H.",
                "rrf_score": 0.0198,
            },
        ]
        mock_result = MagicMock()
        mock_result.mappings.return_value.all.return_value = mock_rows
        mock_db.execute.return_value = mock_result

        workspace_id = uuid.uuid4()
        case_id = uuid.uuid4()
        results = await retrieve_case_evidence_hybrid_rrf(
            db=mock_db,
            workspace_id=workspace_id,
            case_id=case_id,
            query_text="hs-cTnI elevated",
            selected_source_ids=[source_id],
            top_k=5,
        )

        self.assertIn("cit_1", results)
        self.assertIn("cit_2", results)
        self.assertEqual(results["cit_1"]["id"], chunk_id_1)
        self.assertEqual(results["cit_1"]["section_type"], "labs")
        self.assertIn("hs-cTnI", results["cit_1"]["content_text"])
        self.assertEqual(results["cit_2"]["id"], chunk_id_2)


class TestVolumetricExtension(unittest.TestCase):
    def test_volumetric_descriptors(self) -> None:
        source_id = uuid.uuid4()
        descriptor = VolumetricSeriesDescriptor(
            source_file_id=source_id,
            modality="CT",
            slice_count=120,
            voxel_spacing_mm=(1.25, 0.75, 0.75),
            orientation_matrix=[1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0],
            window_presets={"lung": (-600.0, 1500.0), "mediastinum": (50.0, 350.0)},
        )
        self.assertEqual(descriptor.modality, "CT")
        self.assertEqual(descriptor.slice_count, 120)
        self.assertEqual(descriptor.voxel_spacing_mm, (1.25, 0.75, 0.75))
        self.assertIn("lung", descriptor.window_presets)

    def test_sampled_volumetric_slab(self) -> None:
        slab = SampledVolumetricSlab(
            slice_indices=[10, 20, 30, 40],
            normalized_slices_b64=["slice10b64", "slice20b64", "slice30b64", "slice40b64"],
            anatomical_plane="axial",
        )
        self.assertEqual(len(slab.slice_indices), 4)
        self.assertEqual(slab.anatomical_plane, "axial")

    def test_volumetric_adapter_abstract_enforcement(self) -> None:
        with self.assertRaises(TypeError):
            VolumetricSeriesAdapter()  # Cannot instantiate abstract class

        class ConcreteVolumetricAdapter(VolumetricSeriesAdapter):
            def inspect_series(self, raw_bytes: bytes) -> VolumetricSeriesDescriptor:
                return VolumetricSeriesDescriptor(
                    source_file_id=uuid.uuid4(),
                    modality="MR",
                    slice_count=64,
                    voxel_spacing_mm=(3.0, 0.5, 0.5),
                    orientation_matrix=[1.0] * 9,
                    window_presets={"brain": (40.0, 80.0)},
                )

            def extract_representative_slab_for_medgemma(
                self,
                raw_bytes: bytes,
                start_slice: int,
                end_slice: int,
                max_slices: int = 8,
                window_center: float = 40.0,
                window_width: float = 400.0,
            ) -> SampledVolumetricSlab:
                return SampledVolumetricSlab(
                    slice_indices=list(range(start_slice, min(end_slice, start_slice + max_slices))),
                    normalized_slices_b64=["mock_b64"] * min(max_slices, end_slice - start_slice),
                    anatomical_plane="axial",
                )

        adapter = ConcreteVolumetricAdapter()
        desc = adapter.inspect_series(b"dummy_nifti_data")
        self.assertEqual(desc.modality, "MR")
        slab = adapter.extract_representative_slab_for_medgemma(b"dummy_nifti_data", 10, 18, max_slices=8)
        self.assertEqual(len(slab.slice_indices), 8)


class TestBenchmarkHarness(unittest.IsolatedAsyncioTestCase):
    def test_compute_box_iou_1000(self) -> None:
        # Identical boxes
        box_a = [100.0, 100.0, 300.0, 300.0]
        self.assertEqual(compute_box_iou_1000(box_a, box_a), 1.0)

        # Disjoint boxes
        box_b = [400.0, 400.0, 600.0, 600.0]
        self.assertEqual(compute_box_iou_1000(box_a, box_b), 0.0)

        # Partial overlap (half width overlap)
        # box_a: area = 200 * 200 = 40,000
        # box_c: [100, 200, 300, 400], area = 200 * 200 = 40,000
        # intersection: x in [200, 300] (100), y in [100, 300] (200) -> 20,000
        # union: 40000 + 40000 - 20000 = 60,000
        # IoU: 20000 / 60000 = 0.3333
        box_c = [100.0, 200.0, 300.0, 400.0]
        self.assertAlmostEqual(compute_box_iou_1000(box_a, box_c), 0.3333, places=3)

        # Malformed boxes
        self.assertEqual(compute_box_iou_1000([100], [200]), 0.0)

    def test_token_jaccard(self) -> None:
        text1 = "Patient presents with severe acute right lower lobe pneumonia."
        text2 = "Acute right lower lobe pneumonia, severe presentation."
        j = token_jaccard(text1, text2)
        self.assertGreaterEqual(j, 0.60)

        # Identical
        self.assertEqual(token_jaccard("clear lungs", "clear lungs"), 1.0)
        # Empty
        self.assertEqual(token_jaccard("", ""), 1.0)
        # Disjoint
        self.assertEqual(token_jaccard("hypertension", "diabetes"), 0.0)

    def test_create_synthetic_test_xray_and_normalization(self) -> None:
        xray_bytes = create_synthetic_test_xray_bytes(1000, 1200)
        self.assertTrue(len(xray_bytes) > 0)

        img = Image.open(io.BytesIO(xray_bytes))
        self.assertEqual(img.size, (1000, 1200))

        norm_a = normalize_medical_image_896(xray_bytes)
        norm_b = normalize_medical_image_896(xray_bytes)
        self.assertEqual(norm_a.size, (896, 896))
        self.assertEqual(norm_a.mode, "RGB")

        buf_a = io.BytesIO()
        buf_b = io.BytesIO()
        norm_a.save(buf_a, format="PNG")
        norm_b.save(buf_b, format="PNG")
        self.assertEqual(buf_a.getvalue(), buf_b.getvalue())


if __name__ == "__main__":
    unittest.main()
