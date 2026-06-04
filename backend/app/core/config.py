from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    CEREBRAS_API_KEY: str

    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    STORAGE_BUCKET: str = "edurag-pdfs"

    VECTOR_STORE: str = "supabase"
    EMBEDDING_PROVIDER: str = "huggingface"
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"

    FRONTEND_URL: str = "http://localhost:5173"
    FIRST_ADMIN_EMAIL: str = "admin@ragut.edu"
    FIRST_ADMIN_PASSWORD: str = "Admin123!"

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings():
    return Settings()

settings = get_settings()
