from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field

DifficultyLevel = Literal["default", "easy", "median", "hard", "Error"]


class AnnotationBase(BaseModel):
    file_path: str
    file_name: str


class AnnotationInfo(AnnotationBase):
    id: int
    session_id: int
    score: int | None
    is_undecidable: bool
    difficulty: DifficultyLevel
    annotated_by: int | None
    annotated_at: datetime | None

    # Extra fields from session
    license_plate: str | None = None
    date: str | None = None
    session_name: str | None = None

    class Config:
        from_attributes = True


class AnnotationUpdate(BaseModel):
    score: int | None = Field(None, ge=1, le=5)
    is_undecidable: bool | None = None
    difficulty: DifficultyLevel | None = None


class ImageListResponse(BaseModel):
    items: list[AnnotationInfo]
    total: int
    current_index: int | None = None


class AnnotationWithNavigation(AnnotationInfo):
    prev_id: int | None = None
    next_id: int | None = None
    next_unannotated_id: int | None = None
    position: int
    total: int
