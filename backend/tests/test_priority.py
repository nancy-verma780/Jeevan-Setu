import pytest

from app.core.enums import Priority
from app.features.priority.engine import CORE_FIELDS, RULE_SET_VERSION, evaluate

ALL_NO = {field: "no" for field in CORE_FIELDS}


def test_each_red_flag_alone_gives_red_flag():
    for field in CORE_FIELDS:
        result = evaluate("cut", {**ALL_NO, field: "yes"}, 30)
        assert result.category is Priority.RED_FLAG, field
        assert [r.field for r in result.reasons] == [field]


def test_red_flag_wins_over_unknown_core_fields():
    result = evaluate("cut", {"heavy_bleeding": "yes"}, None)
    assert result.category is Priority.RED_FLAG


def test_unknown_core_field_needs_review():
    result = evaluate("cut", {**ALL_NO, "breathing_difficulty": "unknown"}, 30)
    assert result.category is Priority.NEEDS_REVIEW
    assert result.reasons[0].field == "breathing_difficulty"


def test_missing_core_field_is_unknown_never_no():
    symptoms = dict(ALL_NO)
    del symptoms["chest_pain"]
    assert evaluate("cut", symptoms, 30).category is Priority.NEEDS_REVIEW


def test_garbage_answer_is_unknown():
    assert evaluate("cut", {**ALL_NO, "seizure_now": "maybe"}, 30).category is Priority.NEEDS_REVIEW


def test_needs_review_does_not_infer_a_lower_category():
    result = evaluate("burn", {**ALL_NO, "unresponsive": "unknown"}, 80)
    assert result.category is Priority.NEEDS_REVIEW


@pytest.mark.parametrize(
    ("injury", "symptoms", "age"),
    [
        ("cut", {"minor_bleeding": "yes"}, 30),
        ("cut", {"severe_pain": "yes"}, 30),
        ("cut", {"suspected_fracture": "yes"}, 30),
        ("cut", {}, 4),
        ("cut", {}, 65),
        ("burn", {}, 30),
        ("fall_fracture", {}, 30),
    ],
)
def test_concerns_give_elevated(injury, symptoms, age):
    result = evaluate(injury, {**ALL_NO, **symptoms}, age)
    assert result.category is Priority.ELEVATED


@pytest.mark.parametrize("age", [5, 64, None])
def test_age_boundaries_not_elevated(age):
    assert evaluate("cut", ALL_NO, age).category is Priority.STANDARD


def test_unknown_non_core_answer_does_not_block_standard():
    result = evaluate("cut", {**ALL_NO, "severe_pain": "unknown"}, 30)
    assert result.category is Priority.STANDARD


def test_reasons_and_version_are_recorded():
    result = evaluate("road_accident", {**ALL_NO, "minor_bleeding": "yes"}, 70)
    assert result.rule_set_version == RULE_SET_VERSION
    texts = [r.text for r in result.reasons]
    assert "Some bleeding: Yes" in texts
    assert "Age 65 or over" in texts
    assert all(r.rule for r in result.reasons)
