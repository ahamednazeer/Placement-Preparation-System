"""
Core configuration settings using Pydantic Settings.
Loads environment variables from .env file.
"""
from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
    
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/placement_prep"
    database_echo: bool = False
    
    @field_validator("database_url", mode="before")
    @classmethod
    def fix_database_url(cls, v: str) -> str:
        """Convert postgres:// to postgresql+asyncpg:// and handle SSL for asyncpg."""
        # Fix dialect
        if v.startswith("postgres://"):
            v = v.replace("postgres://", "postgresql+asyncpg://", 1)
        elif v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        
        # Remove sslmode parameter as asyncpg handles it differently
        # For local dev, we typically don't need SSL
        if "?" in v:
            base, params = v.split("?", 1)
            param_list = params.split("&")
            filtered_params = [p for p in param_list if not p.startswith("sslmode=")]
            if filtered_params:
                v = base + "?" + "&".join(filtered_params)
            else:
                v = base
        
        return v
    
    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    
    # Groq AI
    groq_api_key: str = ""
    
    # Application
    app_name: str = "Placement Preparation System"
    app_version: str = "0.1.0"
    debug: bool = True
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
        "http://localhost",  # Capacitor Android
        "https://localhost",  # Capacitor with HTTPS
        "http://192.168.1.14:8000",  # Local network
        "*",  # Allow all for development - restrict in production
    ]
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Global settings instance
settings = get_settings()
