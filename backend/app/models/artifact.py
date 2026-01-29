from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Artifact(Base):
    """
    制品（生成文件）
    - 预处理制品：gt_version_id 为 NULL
    - GT制品：gt_version_id 不为 NULL
    """
    __tablename__ = "artifacts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slice_id = Column(Integer, ForeignKey("slices.id", ondelete="CASCADE"), nullable=False, index=True)
    gt_version_id = Column(
        Integer, ForeignKey("gt_versions.id", ondelete="CASCADE"), nullable=True, index=True
    )  # NULL表示预处理制品

    category = Column(String(50), nullable=False)  # 如 "sync", "map/visualize", "od", "GT_OD/video"
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False)  # "image", "video", "bag", "raw"

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    slice = relationship("Slice", back_populates="artifacts")
    gt_version = relationship("GTVersion", back_populates="artifacts")

    __table_args__ = (
        # 预处理制品和GT制品分别唯一
        UniqueConstraint("slice_id", "gt_version_id", "category", "file_name", name="uq_artifact"),
    )
