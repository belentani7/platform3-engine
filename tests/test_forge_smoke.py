"""Smoke test minimo BELENTANI FORGE."""
from pathlib import Path


def test_project_root_exists():
    assert Path(".").exists()


def test_readme_exists():
    assert Path("README.md").exists()
