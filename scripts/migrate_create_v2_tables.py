#!/usr/bin/env python3
import sys
from pathlib import Path

from sqlalchemy import create_engine

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
from app import models  # noqa: F401,E402


def main() -> None:
    engine = create_engine(settings.database_url, future=True)
    Base.metadata.create_all(bind=engine)
    print("v2 tables ensured")


if __name__ == "__main__":
    main()
