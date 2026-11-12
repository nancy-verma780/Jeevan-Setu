"""Image quality gate, section IV-C of the paper.

Blur is the variance of the Laplacian (Eq. 1) on a copy rescaled so the long
side is 512 px; exposure is the mean grayscale intensity on 0-255.
"""

import io
from dataclasses import dataclass

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import Settings
from app.core.errors import Invalid, UnsupportedMedia

ALLOWED_FORMATS = {"JPEG", "PNG"}
ANALYSIS_LONG_SIDE = 512

RETAKE_MESSAGES = {
    "too_dark": "The photo is too dark. Move to better light and take it again.",
    "too_bright": "The photo is too bright. Avoid direct sun or flash and take it again.",
    "blurred": "The photo is blurred. Hold the phone still and take it again.",
}


@dataclass(frozen=True)
class QualityReport:
    blur_score: float
    brightness: float
    flags: tuple[str, ...]


def decode_image(data: bytes, max_bytes: int, max_pixels: int) -> Image.Image:
    """Checks the real content, not the file name or the declared type."""
    if len(data) > max_bytes:
        raise Invalid("The photo is larger than 5 MB. Take a new one or send a smaller copy.", code="too_large")
    try:
        image = Image.open(io.BytesIO(data))
        if image.format not in ALLOWED_FORMATS:
            raise UnsupportedMedia("Only JPEG or PNG photos can be used.", code="unsupported_type")
        width, height = image.size
        if width * height > max_pixels:
            raise Invalid("The photo has too many pixels. Send a smaller copy.", code="too_many_pixels")
        image.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError) as exc:
        raise Invalid("This file could not be read as a photo. Take the photo again.", code="corrupt") from exc
    # Apply camera rotation before the metadata is thrown away on re-encode.
    return ImageOps.exif_transpose(image).convert("RGB")


def laplacian_variance(gray: np.ndarray) -> float:
    a = gray.astype(np.float32)
    lap = a[:-2, 1:-1] + a[2:, 1:-1] + a[1:-1, :-2] + a[1:-1, 2:] - 4 * a[1:-1, 1:-1]
    return float(lap.var())


def check_quality(image: Image.Image, settings: Settings) -> QualityReport:
    gray = image.convert("L")
    scale = ANALYSIS_LONG_SIDE / max(gray.size)
    if scale < 1:
        gray = gray.resize((max(1, round(gray.width * scale)), max(1, round(gray.height * scale))), Image.BILINEAR)
    pixels = np.asarray(gray)
    blur = laplacian_variance(pixels)
    brightness = float(pixels.mean())
    flags = []
    if brightness < settings.image_min_brightness:
        flags.append("too_dark")
    elif brightness > settings.image_max_brightness:
        flags.append("too_bright")
    if blur < settings.image_blur_threshold:
        flags.append("blurred")
    return QualityReport(round(blur, 2), round(brightness, 2), tuple(flags))
