from pydantic import BaseModel, Field, field_validator

from app.core.enums import Role
from app.core.phone import normalise_indian_mobile


class OtpRequestIn(BaseModel):
    phone: str

    @field_validator("phone")
    @classmethod
    def _phone(cls, value: str) -> str:
        return normalise_indian_mobile(value)


class OtpRequestOut(BaseModel):
    expires_in_seconds: int
    dev_code: str | None = None


class OtpVerifyIn(OtpRequestIn):
    code: str = Field(pattern=r"^\d{6}$")


class PasswordLoginIn(BaseModel):
    email: str = Field(min_length=3, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
    password: str = Field(min_length=1, max_length=200)


class MeOut(BaseModel):
    id: int
    role: Role
    name: str
    phone: str | None
    email: str | None
    hospital_id: int | None
    hospital_name: str | None
