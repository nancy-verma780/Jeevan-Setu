"""Private image store. Files are only served through authorised, audited routes."""

import io
import re
import uuid
from pathlib import Path

from PIL import Image

from app.core.config import get_settings
from app.core.errors import NotFound

_KEY = re.compile(r"^[0-9a-f]{32}(_cam)?\.jpg$")


def _root() -> Path:
    root = Path(get_settings().image_store_dir).resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    return root


def save_jpeg(image: Image.Image, key: str | None = None) -> tuple[str, int]:
    """Re-encodes to JPEG. No EXIF is passed on, so GPS tags and other metadata are dropped."""
    key = key or f"{uuid.uuid4().hex}.jpg"
    buffer = io.BytesIO()
    image.convert("RGB").save(buffer, "JPEG", quality=90, optimize=True)
    data = buffer.getvalue()
    (_root() / key).write_bytes(data)
    return key, len(data)


def heatmap_key_for(photo_key: str) -> str:
    return photo_key.replace(".jpg", "_cam.jpg")


def read_bytes(key: str) -> bytes:
    if not _KEY.match(key):
        raise NotFound("Image not found.")
    path = _root() / key
    if not path.is_file():
        raise NotFound("Image not found.")
    return path.read_bytes()
