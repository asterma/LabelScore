from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Slice(Base):
    """数据切片，基于sync bag定义，属于ProcessingVersion"""
    __tablename__ = "slices"

    id = Column(Integer, primary_key=True, autoincrement=True)
    processing_version_id = Column(
        Integer, ForeignKey("processing_versions.id", ondelete="CASCADE"), nullable=False, index=True
    )

    slice_name = Column(String(255), nullable=False)  # 切片名称

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    processing_version = relationship("ProcessingVersion", back_populates="slices")
    artifacts = relationship("Artifact", back_populates="slice", cascade="all, delete-orphan")
    reviews = relationship("Review", back_populates="slice", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("processing_version_id", "slice_name", name="uq_slice"),
    )
