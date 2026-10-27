import os
import sys
import unittest
from unittest.mock import patch

from pydantic import ValidationError

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api")))

from app.core.config import Settings, _load_env_fallback, _parse_cors_origins, _safe_int, settings


class TestConfig(unittest.TestCase):
    def test_environment_settings_use_one_typed_schema(self) -> None:
        with patch.dict(os.environ, {
            "CORS_ORIGINS": "https://one.example, https://two.example",
            "MEDGEMMA_MAX_CONCURRENCY": "3",
            "DEBUG_ALLOW_UNVERIFIED_JWT": "false",
        }):
            config = Settings()
        self.assertEqual(config.CORS_ORIGINS, ["https://one.example", "https://two.example"])
        self.assertEqual(config.MEDGEMMA_MAX_CONCURRENCY, 3)
        self.assertFalse(config.DEBUG_ALLOW_UNVERIFIED_JWT)

    def test_json_origins_and_explicit_overrides(self) -> None:
        config = Settings(CORS_ORIGINS='["https://one.example"]', MEDGEMMA_MAX_CONCURRENCY="invalid")
        self.assertEqual(config.CORS_ORIGINS, ["https://one.example"])
        self.assertEqual(config.MEDGEMMA_MAX_CONCURRENCY, 1)
        with self.assertRaises(ValidationError):
            Settings(MEDGEMMA_MAX_CONCURRENCY=0)

    def test_safe_int_valid(self) -> None:
        self.assertEqual(_safe_int("42", default=1), 42)
        self.assertEqual(_safe_int("  10  ", default=1), 10)

    def test_safe_int_invalid(self) -> None:
        self.assertEqual(_safe_int("", default=5), 5)
        self.assertEqual(_safe_int(None, default=3), 3)
        self.assertEqual(_safe_int("invalid_number", default=2), 2)

    def test_cors_origins_parsing(self) -> None:
        defaults = _parse_cors_origins(None)
        self.assertIn("http://localhost:3000", defaults)
        self.assertIn("http://web:3000", defaults)

        custom = _parse_cors_origins("https://app.medgemma.com, https://admin.medgemma.com")
        self.assertEqual(custom, ["https://app.medgemma.com", "https://admin.medgemma.com"])

        empty_custom = _parse_cors_origins("   ")
        self.assertEqual(empty_custom, defaults)

    def test_settings_defaults(self) -> None:
        self.assertIsNotNone(settings.POSTGRES_USER)
        self.assertIsNotNone(settings.DATABASE_URL)
        self.assertIn("redis", settings.REDIS_URL)
        self.assertEqual(settings.MEDGEMMA_MODE, "local_4bit")
        self.assertEqual(settings.MEDGEMMA_PROCESSOR_VERSION, "1.5.0-896px")
        self.assertGreaterEqual(settings.MEDGEMMA_MAX_CONCURRENCY, 1)
        self.assertIsInstance(settings.CORS_ORIGINS, list)
        self.assertIn("http://localhost:3000", settings.CORS_ORIGINS)


if __name__ == "__main__":
    unittest.main()
