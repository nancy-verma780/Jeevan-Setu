import io

import numpy as np
import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.enums import Priority
from app.features.audit.models import AuditLog
from app.features.images import analyzer as analyzer_module
from app.features.images.analyzer import AnalysisResult, UNCERTAIN, apply_threshold
from app.features.images.models import ImageRecord
from tests.helpers import login_citizen, login_staff, pending_assignment_id, submit


def _jpeg(array: np.ndarray, exif_gps: bool = False) -> bytes:
    image = Image.fromarray(array.astype(np.uint8), "RGB")
    buffer = io.BytesIO()
    if exif_gps:
        exif = Image.Exif()
        exif[0x8825] = {1: "N", 2: (28.0, 28.0, 0.0)}
        image.save(buffer, "JPEG", exif=exif)
    else:
        image.save(buffer, "JPEG", quality=95)
    return buffer.getvalue()


def _sharp_photo() -> bytes:
    rng = np.random.default_rng(7)
    return _jpeg(rng.integers(40, 200, size=(480, 640, 3)))


class FixedAnalyzer:
    name = "stub"
    version = "test"

    def __init__(self, probabilities, tau=0.39):
        self.probabilities = probabilities
        self.tau = tau

    def analyze(self, image):
        prediction, confidence, abstained = apply_threshold(self.probabilities, analyzer_module.WOUND_CLASSES, self.tau)
        heat = analyzer_module.overlay_heatmap(image, np.ones((7, 7)))
        return AnalysisResult(prediction, confidence, abstained, heat)


@pytest.fixture(autouse=True)
def private_store(tmp_path, monkeypatch):
    from app.core.config import get_settings

    monkeypatch.setenv("JS_IMAGE_STORE_DIR", str(tmp_path / "images"))
    get_settings.cache_clear()
    yield
    analyzer_module.set_analyzer(None)


@pytest.fixture
def reporter(hospitals, make_client):
    client = make_client()
    login_citizen(client)
    request = submit(client).json()
    return client, request


def _upload(client, request_id, data, name="photo.jpg", content_type="image/jpeg"):
    return client.post(f"/api/emergencies/{request_id}/images", files={"photo": (name, data, content_type)})


def test_corrupt_image_rejected_and_request_unaffected(reporter, db):
    client, request = reporter
    response = _upload(client, request["id"], b"\xff\xd8\xff\xe0 not really a jpeg")
    assert response.status_code == 422 and response.json()["code"] == "corrupt"
    assert client.get(f"/api/emergencies/{request['id']}").json()["status"] == "AWAITING_HOSPITAL_RESPONSE"
    assert db.scalar(select(func.count(ImageRecord.id))) == 0


def test_unsupported_type_is_415(reporter):
    client, request = reporter
    buffer = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(buffer, "GIF")
    response = _upload(client, request["id"], buffer.getvalue(), "x.jpg", "image/jpeg")
    assert response.status_code == 415


def test_blurred_image_asks_for_retake(reporter):
    client, request = reporter
    flat = np.full((480, 640, 3), 128)
    response = _upload(client, request["id"], _jpeg(flat))
    assert response.status_code == 422 and response.json()["code"] == "retake_blurred"


def test_dark_image_asks_for_retake(reporter):
    client, request = reporter
    rng = np.random.default_rng(1)
    response = _upload(client, request["id"], _jpeg(rng.integers(0, 30, size=(480, 640, 3))))
    assert response.json()["code"] == "retake_too_dark"


def test_low_confidence_returns_uncertain(reporter):
    client, request = reporter
    analyzer_module.set_analyzer(FixedAnalyzer([0.31, 0.25, 0.24, 0.20]))
    body = _upload(client, request["id"], _sharp_photo()).json()
    assert body["analysis"]["prediction"] == UNCERTAIN
    assert body["analysis"]["abstained"] is True
    assert body["analysis"]["notice"] == "Preliminary, not a diagnosis"


def test_confident_prediction_never_changes_priority_or_routing(reporter):
    client, request = reporter
    analyzer_module.set_analyzer(FixedAnalyzer([0.9, 0.05, 0.03, 0.02]))
    before = client.get(f"/api/emergencies/{request['id']}").json()
    body = _upload(client, request["id"], _sharp_photo()).json()
    after = client.get(f"/api/emergencies/{request['id']}").json()
    assert body["analysis"]["prediction"] == "diabetic"
    assert after["priority"] == before["priority"] == Priority.ELEVATED.value
    assert after["current_hospital"]["hospital_id"] == before["current_hospital"]["hospital_id"]


def test_metadata_is_stripped(reporter, tmp_path):
    client, request = reporter
    rng = np.random.default_rng(3)
    _upload(client, request["id"], _jpeg(rng.integers(40, 200, size=(480, 640, 3)), exif_gps=True))
    stored = list((tmp_path / "images").glob("*.jpg"))
    assert stored and not Image.open(stored[0]).getexif()


def test_without_weights_the_photo_is_stored_but_not_analysed(reporter):
    client, request = reporter
    analyzer_module.set_analyzer(analyzer_module.UnavailableAnalyzer())
    body = _upload(client, request["id"], _sharp_photo()).json()
    assert body["analysis"]["prediction"] is None and body["analysis"]["has_heatmap"] is False


def test_staff_view_is_audited_and_cross_hospital_404(reporter, make_client, db):
    client, request = reporter
    analyzer_module.set_analyzer(FixedAnalyzer([0.5, 0.2, 0.2, 0.1]))
    image_id = _upload(client, request["id"], _sharp_photo()).json()["id"]
    h3, h2 = make_client(), make_client()
    login_staff(h3, "H3")
    login_staff(h2, "H2")
    assert len(h3.get(f"/api/staff/requests/{pending_assignment_id(h3)}/images").json()) == 1
    photo = h3.get(f"/api/staff/images/{image_id}")
    heat = h3.get(f"/api/staff/images/{image_id}?variant=heatmap")
    assert photo.status_code == 200 and photo.headers["content-type"] == "image/jpeg"
    assert heat.status_code == 200
    assert h2.get(f"/api/staff/images/{image_id}").status_code == 404
    views = db.scalar(select(func.count(AuditLog.id)).where(AuditLog.action == "IMAGE_VIEW"))
    assert views == 2


def test_other_citizen_cannot_upload(reporter, make_client):
    _, request = reporter
    other = make_client()
    login_citizen(other, "9876500011")
    assert _upload(other, request["id"], _sharp_photo()).status_code == 404
