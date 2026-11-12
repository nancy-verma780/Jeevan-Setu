"""Replaceable wound-image analyzer interface.

Output is informational only. Nothing here feeds priority or hospital ranking.
"""

import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol

import numpy as np
from PIL import Image

from app.core.config import get_settings

log = logging.getLogger("jeevansetu.analyzer")

WOUND_CLASSES = ("diabetic", "pressure", "surgical", "venous")
UNCERTAIN = "UNCERTAIN"


@dataclass(frozen=True)
class AnalysisResult:
    prediction: str | None  # a class, UNCERTAIN, or None when no model ran
    confidence: float | None
    abstained: bool | None
    heatmap: Image.Image | None = None


class Analyzer(Protocol):
    name: str
    version: str

    def analyze(self, image: Image.Image) -> AnalysisResult: ...


class UnavailableAnalyzer:
    """Used when no trained weights are installed. Never guesses."""

    name = "none"
    version = "0"

    def analyze(self, image: Image.Image) -> AnalysisResult:
        return AnalysisResult(prediction=None, confidence=None, abstained=None)


def apply_threshold(probabilities: Sequence[float], classes: Sequence[str], tau: float) -> tuple[str, float, bool]:
    """Eq. (4): answer only when the top probability reaches tau."""
    top = int(np.argmax(probabilities))
    confidence = float(probabilities[top])
    if confidence < tau:
        return UNCERTAIN, round(confidence, 4), True
    return classes[top], round(confidence, 4), False


def overlay_heatmap(image: Image.Image, cam: np.ndarray, strength: float = 0.5) -> Image.Image:
    """Blends a 0..1 Grad-CAM map over the photo, warm where the model looked."""
    cam = np.clip(cam.astype(np.float32), 0, 1)
    cam_img = Image.fromarray((cam * 255).astype(np.uint8)).resize(image.size, Image.BILINEAR)
    weight = np.asarray(cam_img, dtype=np.float32)[..., None] / 255.0
    base = np.asarray(image.convert("RGB"), dtype=np.float32)
    warm = np.stack([np.full_like(weight[..., 0], 220), weight[..., 0] * 180, np.full_like(weight[..., 0], 40)], axis=-1)
    blended = base * (1 - strength * weight) + warm * (strength * weight)
    return Image.fromarray(blended.clip(0, 255).astype(np.uint8))


_current: Analyzer | None = None


def _build() -> Analyzer:
    settings = get_settings()
    if settings.analyzer == "mobilenetv2":
        try:
            from app.features.images.mobilenet import MobileNetV2Analyzer

            return MobileNetV2Analyzer(settings.analyzer_weights_path, settings.abstain_threshold)
        except (ImportError, FileNotFoundError) as exc:
            log.warning("Wound analyzer unavailable, photos will not be analysed: %s", exc)
    return UnavailableAnalyzer()


def get_analyzer() -> Analyzer:
    global _current
    if _current is None:
        _current = _build()
    return _current


def set_analyzer(analyzer: Analyzer | None) -> None:
    """Swap the analyzer (tests, or a different model behind the same interface)."""
    global _current
    _current = analyzer
