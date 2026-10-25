import unittest
from pathlib import Path
from unittest.mock import patch

from medgemma_app.transformer import build_parser, MODEL_DIR


class TestTransformerCLI(unittest.TestCase):
    def setUp(self) -> None:
        self.parser = build_parser()

    def test_default_arguments(self) -> None:
        args = self.parser.parse_args([])
        self.assertFalse(args.check)
        self.assertEqual(args.prompt, "Explain what a red blood cell does in one sentence.")
        self.assertIsNone(args.image)
        self.assertEqual(args.max_new_tokens, 128)
        self.assertFalse(args.cpu_offload)
        self.assertEqual(args.model_dir, MODEL_DIR)

    def test_custom_arguments(self) -> None:
        custom_dir = Path("D:/custom_models")
        args = self.parser.parse_args([
            "--check",
            "--prompt", "Custom prompt",
            "--max-new-tokens", "256",
            "--cpu-offload",
            "--model-dir", str(custom_dir),
        ])
        self.assertTrue(args.check)
        self.assertEqual(args.prompt, "Custom prompt")
        self.assertEqual(args.max_new_tokens, 256)
        self.assertTrue(args.cpu_offload)
        self.assertEqual(args.model_dir, custom_dir)

    def test_max_tokens_bounds(self) -> None:
        args_lower = self.parser.parse_args(["--max-new-tokens", "1"])
        self.assertEqual(args_lower.max_new_tokens, 1)

        args_upper = self.parser.parse_args(["--max-new-tokens", "512"])
        self.assertEqual(args_upper.max_new_tokens, 512)


if __name__ == "__main__":
    unittest.main()
