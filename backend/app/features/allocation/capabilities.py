"""Table II of the paper: a project assumption, not clinical routing guidance."""

from app.core.enums import InjuryType, Service

REQUIRED_SERVICES: dict[InjuryType, frozenset[Service]] = {
    InjuryType.ROAD_ACCIDENT: frozenset({Service.GENERAL_EMERGENCY, Service.TRAUMA_CARE}),
    InjuryType.BURN: frozenset({Service.GENERAL_EMERGENCY, Service.BURN_CARE}),
    InjuryType.FALL_FRACTURE: frozenset({Service.GENERAL_EMERGENCY, Service.ORTHOPAEDICS}),
    InjuryType.CARDIAC: frozenset({Service.GENERAL_EMERGENCY, Service.CARDIAC_CARE}),
    InjuryType.BREATHING: frozenset({Service.GENERAL_EMERGENCY}),
    InjuryType.CUT: frozenset({Service.GENERAL_EMERGENCY}),
    InjuryType.OTHER: frozenset({Service.GENERAL_EMERGENCY}),
}


def required_services(injury_type: InjuryType | str) -> frozenset[Service]:
    return REQUIRED_SERVICES[InjuryType(injury_type)]
