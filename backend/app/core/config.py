from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "PowderCoat AI Studio"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    # Falls back to a local SQLite file when Postgres is not configured,
    # so the API runs without Docker for local development.
    DATABASE_URL: str = "sqlite:///./powdercoat.db"

    SECRET_KEY: str = "dev-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8

    SEED_DATA: bool = True

    CORS_ORIGINS: list[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    @field_validator("DATABASE_URL")
    @classmethod
    def _normalize_database_url(cls, v: str) -> str:
        # Managed hosts (Render, Heroku, etc.) hand out postgres:// or postgresql://
        # URLs. SQLAlchemy needs the psycopg v3 driver to be named explicitly.
        if v.startswith("postgres://"):
            return "postgresql+psycopg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+psycopg://" + v[len("postgresql://"):]
        return v

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
