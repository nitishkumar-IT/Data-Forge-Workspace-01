from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[1]
STORAGE_DIR = BASE_DIR / "storage"
DATASET_DIR = STORAGE_DIR / "datasets"
MODEL_DIR = STORAGE_DIR / "models"
EXPORT_DIR = STORAGE_DIR / "exports"
DATABASE_PATH = STORAGE_DIR / "app.db"


class Settings(BaseSettings):
    app_name: str = "Data Forge API"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440
    frontend_url: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_use_tls: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

for path in (STORAGE_DIR, DATASET_DIR, MODEL_DIR, EXPORT_DIR):
    path.mkdir(parents=True, exist_ok=True)
