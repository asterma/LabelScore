from datetime import datetime

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class ProcessingVersion(Base):
    """处理版本，如 2026-01-20_tmp_ld_annotatorv039 或 tmp_ld_annotatorv039_run-001"""
    __tablename__ = "processing_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    dir_name = Column(String(100), nullable=False)  # 完整目录名
    software_version = Column(String(100), nullable=False)  # 软件版本，如 "tmp_ld_annotatorv039"
    processing_date = Column(Date, nullable=False)  # 处理日期，如 2026-01-20
    processing_time = Column(DateTime, nullable=True)  # 处理时间（精确到秒）
    root_path = Column(String(500), nullable=False)  # 处理版本根路径

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="processing_versions")
    slices = relationship("Slice", back_populates="processing_version", cascade="all, delete-orphan")
    gt_versions = relationship("GTVersion", back_populates="processing_version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("session_id", "dir_name", name="uq_processing_version"),
    )
