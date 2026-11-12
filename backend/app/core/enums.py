from enum import StrEnum


class Role(StrEnum):
    CITIZEN = "citizen"
    STAFF = "staff"
    ADMIN = "admin"


class Priority(StrEnum):
    RED_FLAG = "RED_FLAG"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    ELEVATED = "ELEVATED"
    STANDARD = "STANDARD"


class RequestStatus(StrEnum):
    SUBMITTED = "SUBMITTED"
    FINDING_HOSPITAL = "FINDING_HOSPITAL"
    AWAITING_HOSPITAL_RESPONSE = "AWAITING_HOSPITAL_RESPONSE"
    HOSPITAL_ACCEPTED = "HOSPITAL_ACCEPTED"
    NO_SUITABLE_HOSPITAL = "NO_SUITABLE_HOSPITAL"
    CANCELLED = "CANCELLED"


ACTIVE_REQUEST_STATUSES = (
    RequestStatus.SUBMITTED,
    RequestStatus.FINDING_HOSPITAL,
    RequestStatus.AWAITING_HOSPITAL_RESPONSE,
)


class AssignmentStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    TIMED_OUT = "TIMED_OUT"
    CANCELLED = "CANCELLED"


class InjuryType(StrEnum):
    ROAD_ACCIDENT = "road_accident"
    BURN = "burn"
    FALL_FRACTURE = "fall_fracture"
    CARDIAC = "cardiac"
    BREATHING = "breathing"
    CUT = "cut"
    OTHER = "other"


class Service(StrEnum):
    GENERAL_EMERGENCY = "general_emergency"
    TRAUMA_CARE = "trauma_care"
    BURN_CARE = "burn_care"
    ORTHOPAEDICS = "orthopaedics"
    CARDIAC_CARE = "cardiac_care"


class LocationSource(StrEnum):
    GPS = "gps"
    MAP_PIN = "map_pin"
    MANUAL = "manual"


class Answer(StrEnum):
    YES = "yes"
    NO = "no"
    UNKNOWN = "unknown"


class EventType(StrEnum):
    SUBMITTED = "SUBMITTED"
    PRIORITY_SET = "PRIORITY_SET"
    SENT_TO_HOSPITAL = "SENT_TO_HOSPITAL"
    HOSPITAL_ACCEPTED = "HOSPITAL_ACCEPTED"
    HOSPITAL_DECLINED = "HOSPITAL_DECLINED"
    HOSPITAL_TIMED_OUT = "HOSPITAL_TIMED_OUT"
    NO_SUITABLE_HOSPITAL = "NO_SUITABLE_HOSPITAL"
    CANCELLED = "CANCELLED"
