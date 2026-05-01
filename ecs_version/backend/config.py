"""
config.py — Application settings loaded from environment variables.
"""

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    aws_region: str = "us-east-1"
    bedrock_model_id: str = "us.anthropic.claude-sonnet-4-6"
    cognito_user_pool_id: str = "us-east-1_N9muKRSSh"
    cognito_client_id: str = "pi1876di442ghv26acdc5chjr"
    cognito_region: str = "us-east-1"
    allowed_origins: str = "https://moderator.theagenticworkers.com"
    dynamodb_endpoint_url: str | None = None

    @property
    def allowed_origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
