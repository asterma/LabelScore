from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, Boolean
from sqlalchemy.orm import relationship

from app.core.database import Base


class Review(Base):
    """
    评审记录
    - 预处理评审：gt_version_id 为 NULL
    - GT评审：gt_version_id 不为 NULL
    """
    __tablename__ = "reviews"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slice_id = Column(Integer, ForeignKey("slices.id", ondelete="CASCADE"), nullable=False, index=True)
    gt_version_id = Column(
        Integer, ForeignKey("gt_versions.id", ondelete="CASCADE"), nullable=True, index=True
    )  # NULL表示预处理评审

    result = Column(String(32), nullable=False, default="unknown")  # "unknown", "pass", "fail", etc.
    score = Column(Integer, nullable=True)  # 1-5
    is_undecidable = Column(Boolean, default=False, nullable=False)
    difficulty = Column(String(16), default="default", nullable=False)
    comment = Column(String(500), nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    slice = relationship("Slice", back_populates="reviews")
    gt_version = relationship("GTVersion", back_populates="reviews")
    reviewer = relationship("User")

    __table_args__ = (
        # 同一slice在同一gt_version下只能有一条评审（预处理时gt_version_id为NULL）
        UniqueConstraint("slice_id", "gt_version_id", name="uq_review"),
    )
