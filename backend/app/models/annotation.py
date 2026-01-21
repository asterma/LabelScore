from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship

from app.core.database import Base


class Annotation(Base):
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)

    file_path = Column(String(500), nullable=False)
    file_name = Column(String(255), nullable=False)

    score = Column(Integer, nullable=True)
    is_undecidable = Column(Boolean, default=False)
    difficulty = Column(String(16), nullable=False, default="default", server_default="default")

    annotated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    annotated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    session = relationship("Session", back_populates="annotations")
    annotator = relationship("User", back_populates="annotations")

    __table_args__ = (
        CheckConstraint("score IS NULL OR (score >= 1 AND score <= 5)", name="valid_score"),
        CheckConstraint(
            "difficulty IN ('default', 'easy', 'median', 'hard', 'Error')",
            name="valid_difficulty",
        ),
        UniqueConstraint("file_path", name="uq_file_path"),
    )

    @property
    def is_annotated(self) -> bool:
        return self.score is not None or self.is_undecidable
