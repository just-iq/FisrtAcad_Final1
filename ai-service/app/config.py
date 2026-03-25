import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    env: str = os.getenv("ENV", "development")
    db_url: str = os.getenv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/firstacad")
    embedding_model: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


settings = Settings()

