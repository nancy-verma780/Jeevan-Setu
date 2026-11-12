"""Preliminary priority from Table I of the paper.

Rules run in a fixed order and every rule that fires is stored with a
plain-language reason. The image analyzer has no input here by design.
"""

from collections.abc import Mapping
from dataclasses import asdict, dataclass

from app.core.enums import Answer, InjuryType, Priority

RULE_SET_VERSION = "1.0"

# Red-flag questions. These are also the core fields: a red flag can only be
# ruled out when the question was actually answered.
RED_FLAG_RULES: tuple[tuple[str, str, str], ...] = (
    ("unresponsive", "R1", "Not responding or unconscious"),
    ("breathing_difficulty", "R2", "Not breathing or severe difficulty breathing"),
    ("heavy_bleeding", "R3", "Heavy bleeding"),
    ("chest_pain", "R4", "Chest pain"),
    ("seizure_now", "R5", "Seizure in progress"),
)
CORE_FIELDS: tuple[str, ...] = tuple(field for field, _, _ in RED_FLAG_RULES)

CONCERN_SYMPTOMS: tuple[tuple[str, str, str], ...] = (
    ("minor_bleeding", "C1", "Some bleeding"),
    ("severe_pain", "C2", "Pain 7/10 or more"),
    ("suspected_fracture", "C5", "Suspected fracture"),
)

SYMPTOM_FIELDS: tuple[str, ...] = CORE_FIELDS + tuple(field for field, _, _ in CONCERN_SYMPTOMS)


@dataclass(frozen=True)
class Reason:
    rule: str
    text: str
    field: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


@dataclass(frozen=True)
class PriorityResult:
    category: Priority
    reasons: tuple[Reason, ...]
    rule_set_version: str = RULE_SET_VERSION


def normalise_answer(value: object) -> Answer:
    """Anything other than an explicit yes or no counts as unknown, never as no."""
    if isinstance(value, str) and value.lower() in (Answer.YES, Answer.NO):
        return Answer(value.lower())
    return Answer.UNKNOWN


def evaluate(
    injury_type: InjuryType | str,
    symptoms: Mapping[str, object],
    patient_age: int | None,
) -> PriorityResult:
    answers = {field: normalise_answer(symptoms.get(field)) for field in SYMPTOM_FIELDS}
    injury = InjuryType(injury_type)

    red = [
        Reason(rule, f"{label}: Yes", field)
        for field, rule, label in RED_FLAG_RULES
        if answers[field] is Answer.YES
    ]
    if red:
        return PriorityResult(Priority.RED_FLAG, tuple(red))

    unknown = [
        Reason("U1", f"{label}: Unknown (core question)", field)
        for field, _, label in RED_FLAG_RULES
        if answers[field] is Answer.UNKNOWN
    ]
    if unknown:
        return PriorityResult(Priority.NEEDS_REVIEW, tuple(unknown))

    concerns = [
        Reason(rule, f"{label}: Yes", field)
        for field, rule, label in CONCERN_SYMPTOMS
        if answers[field] is Answer.YES
    ]
    if patient_age is not None and patient_age < 5:
        concerns.append(Reason("C3", "Age under 5", "patient_age"))
    if patient_age is not None and patient_age >= 65:
        concerns.append(Reason("C3", "Age 65 or over", "patient_age"))
    if injury is InjuryType.BURN:
        concerns.append(Reason("C4", "Burn injury", "injury_type"))
    if injury is InjuryType.FALL_FRACTURE and answers["suspected_fracture"] is not Answer.YES:
        concerns.append(Reason("C5", "Suspected fracture (injury type)", "injury_type"))
    if concerns:
        return PriorityResult(Priority.ELEVATED, tuple(concerns))

    return PriorityResult(
        Priority.STANDARD,
        (Reason("S1", "All core questions answered, no danger or concern signs"),),
    )
