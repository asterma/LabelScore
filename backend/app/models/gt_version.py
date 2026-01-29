from datetime import datetime

from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class GTVersion(Base):
    """GT版本，如 GT_OD-2026-01-20-v1.0.0"""
    __tablename__ = "gt_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    processing_version_id = Column(
        Integer, ForeignKey("processing_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    gt_type = Column(String(20), nullable=False)  # "OD" 或 "RF"
    dir_name = Column(String(100), nullable=False)  # 完整目录名，如 "GT_OD-2026-01-20-v1.0.0"
    gt_date = Column(Date, nullable=False)  # GT日期，如 2026-01-20
    version_tag = Column(String(20), nullable=False)  # 版本标签，如 "v1.0.0"

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    processing_version = relationship("ProcessingVersion", back_populates="gt_versions")
    artifacts = relationship("Artifact", back_populates="gt_version", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="gt_version", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("processing_version_id", "gt_type", "version_tag", name="uq_gt_version"),
    )
