from datetime import datetime
from pydantic import BaseModel


class SessionBase(BaseModel):
    license_plate: str
    year: int
    month: int
    day: int
    session_id: str
    software_version: str


class SessionListItem(SessionBase):
    id: int
    total_images: int
    annotated_images: int
    created_at: datetime

    class Config:
        from_attributes = True

    @property
    def date_str(self) -> str:
        return f"{self.year}-{self.month:02d}-{self.day:02d}"


class SessionDetail(SessionListItem):
    base_path: str
    updated_at: datetime


class SessionListResponse(BaseModel):
    items: list[SessionListItem]
    total: int
    page: int
    page_size: int


class SessionFilter(BaseModel):
    license_plate: str | None = None
    date_from: str | None = None  # YYYY-MM-DD
    date_to: str | None = None
    status: str | None = None  # pending, in_progress, completed


class SessionStats(BaseModel):
    total_sessions: int
    total_images: int
    annotated_images: int
    completion_rate: float
