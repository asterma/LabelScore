from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Date, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Session(Base):
    """采集会话，由车牌+日期+session_uuid唯一确定"""
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    license_plate = Column(String(20), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    session_uuid = Column(String(100), nullable=False, index=True)
    raw_root_path = Column(String(500), nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    processing_versions = relationship("ProcessingVersion", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("license_plate", "date", "session_uuid", name="uq_session"),
    )
