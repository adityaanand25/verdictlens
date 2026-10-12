from pathlib import Path

import pytest

from backend.app.pipeline import SummarizationPipeline


def test_summarize_requires_a_local_model_directory(tmp_path: Path) -> None:
    service = SummarizationPipeline(tmp_path / "missing-model")

    with pytest.raises(FileNotFoundError, match="backend/.env"):
        service._ensure_loaded()


def test_summarize_rejects_blank_text(tmp_path: Path) -> None:
    service = SummarizationPipeline(tmp_path / "missing-model")

    with pytest.raises(ValueError, match="non-whitespace"):
        service.summarize("  \n", max_new_tokens=64, num_beams=1)


def test_extract_entities_finds_legal_provisions(tmp_path: Path) -> None:
    service = SummarizationPipeline(tmp_path / "missing-model")

    entities = service._extract_entities("The appeal concerns Section 302 IPC and Article 21.")

    assert "Section 302" in entities["acts_sections"]
    assert "IPC" in entities["acts_sections"]
    assert "Article 21" in entities["acts_sections"]