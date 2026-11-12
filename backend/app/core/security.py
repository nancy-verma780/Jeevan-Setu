import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

# argon2-cffi defaults to Argon2id with RFC 9106 low-memory parameters.
_hasher = PasswordHasher()
_DUMMY_HASH = _hasher.hash("timing-equaliser")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str | None, password: str) -> bool:
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_otp(phone: str, code: str, pepper: str) -> str:
    return hmac.new(pepper.encode(), f"{phone}:{code}".encode(), hashlib.sha256).hexdigest()


def otp_matches(expected_hash: str, phone: str, code: str, pepper: str) -> bool:
    return hmac.compare_digest(expected_hash, hash_otp(phone, code, pepper))
