from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="JS_", env_file=".env", extra="ignore")

    env: str = "dev"
    database_url: str = "sqlite:///./jeevansetu.db"
    cors_origins: list[str] = ["http://localhost:5173"]

    session_cookie_name: str = "js_session"
    session_ttl_hours: int = 12
    cookie_secure: bool = False

    otp_ttl_seconds: int = 300
    otp_max_attempts: int = 5
    otp_max_requests_per_window: int = 3
    otp_window_seconds: int = 600
    otp_pepper: str = "dev-only-pepper"
    expose_dev_otp: bool = True

    consent_policy_version: str = "2026-10-01"

    reply_timeout_seconds: int = 120
    timeout_poll_seconds: int = 5
    run_timeout_checker: bool = True

    # Eq. 8 of the paper, plus the small reliability term.
    rank_weight_distance: float = 0.7
    rank_weight_resource: float = 0.3
    rank_weight_reliability: float = 0.05
    rank_bed_cap: int = 5
    rank_max_distance_km: float = 25.0
    availability_stale_minutes: int = 360

    # Image pipeline (section IV-C and IV-D of the paper).
    image_store_dir: str = "./private_images"
    image_max_bytes: int = 5 * 1024 * 1024
    image_max_pixels: int = 25_000_000
    image_blur_threshold: float = 45.0
    image_min_brightness: float = 40.0
    image_max_brightness: float = 220.0
    analyzer: str = "mobilenetv2"
    analyzer_weights_path: str = "./ml/weights/mobilenetv2_azh.pt"
    abstain_threshold: float = 0.39


@lru_cache
def get_settings() -> Settings:
    return Settings()
