import re

_INDIAN_MOBILE = re.compile(r"^[6-9]\d{9}$")


def normalise_indian_mobile(raw: str) -> str:
    """Returns +91XXXXXXXXXX or raises ValueError."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 12 and digits.startswith("91"):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]
    if not _INDIAN_MOBILE.match(digits):
        raise ValueError("Enter a 10-digit Indian mobile number.")
    return f"+91{digits}"


def mask_phone(phone: str | None) -> str | None:
    if not phone:
        return None
    return f"{phone[:5]}••• ••{phone[-3:]}"
