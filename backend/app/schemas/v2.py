from datetime import datetime, date
from typing import Literal

from pydantic import BaseModel


# ==================== Session ====================
class SessionBase(BaseModel):
    license_plate: str
    date: date
    session_uuid: str
    raw_root_path: str


class SessionInfo(SessionBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==================== ProcessingVersion ====================
class ProcessingVersionBase(BaseModel):
    session_id: int
    dir_name: str
    software_version: str
    run_tag: str | None = None
    processing_date: date
    processing_time: datetime | None = None
    root_path: str


class ProcessingVersionInfo(ProcessingVersionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Slice ====================
class SliceBase(BaseModel):
    processing_version_id: int
    slice_name: str


class SliceInfo(SliceBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== GTVersion ====================
class GTVersionBase(BaseModel):
    processing_version_id: int
    gt_type: str  # "OD" or "RF"
    dir_name: str
    gt_date: date
    version_tag: str


class GTVersionInfo(GTVersionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Artifact ====================
ArtifactFileType = Literal["image", "video", "bag", "raw", "other"]


class ArtifactBase(BaseModel):
    slice_id: int
    gt_version_id: int | None = None  # NULL for preprocessing artifacts
    category: str
    file_name: str
    file_path: str
    file_type: ArtifactFileType


class ArtifactInfo(ArtifactBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== Review ====================
ReviewResult = Literal["pass", "fail", "unknown", "scored", "undecidable"]
DifficultyLevel = Literal["default", "easy", "median", "hard", "Error"]


class ReviewBase(BaseModel):
    slice_id: int
    gt_version_id: int | None = None  # NULL for preprocessing review
    result: ReviewResult = "unknown"
    score: int | None = None
    is_undecidable: bool = False
    difficulty: DifficultyLevel = "default"
    comment: str | None = None


class ReviewInfo(ReviewBase):
    id: int
    reviewed_by: int | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewUpdate(BaseModel):
    result: ReviewResult
    score: int | None = None
    is_undecidable: bool | None = None
    difficulty: DifficultyLevel | None = None
    comment: str | None = None
