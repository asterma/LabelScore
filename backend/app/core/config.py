from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "LabelScore"
    debug: bool = False

    # Database
    database_url: str = "sqlite:///./data/labelscore.db"

    # JWT
    jwt_secret_key: str = "your-secret-key-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24 hours

    # File paths
    images_root_dir: str = "/media/NAS/new_data/BMW/raw"
    upload_dir: str = "./data/uploads"
    max_upload_size: int = 50 * 1024 * 1024  # 50MB

    # Default admin user
    default_admin_username: str = "admin"
    default_admin_password: str = "admin123"

    class Config:
        env_file = ".env"


settings = Settings()
