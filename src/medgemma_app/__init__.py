"""MedGemma application entry point."""


def main() -> None:
    from .transformer import main as run
    run()
