from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    license_plate = Column(String(20), nullable=False, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    day = Column(Integer, nullable=False)
    session_id = Column(String(100), nullable=False, index=True)
    software_version = Column(String(50), nullable=False)

    total_images = Column(Integer, default=0)
    annotated_images = Column(Integer, default=0)

    base_path = Column(String(500), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    annotations = relationship("Annotation", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint(
            "license_plate", "year", "month", "day", "session_id", "software_version",
            name="uq_session"
        ),
    )

    @property
    def date_str(self) -> str:
        return f"{self.year}-{self.month:02d}-{self.day:02d}"
