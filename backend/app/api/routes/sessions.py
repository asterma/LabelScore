from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.session import (
    SessionListItem,
    SessionDetail,
    SessionListResponse,
    SessionFilter,
    SessionStats,
)
from app.schemas.annotation import ImageListResponse, AnnotationInfo
from app.services.session import get_sessions, get_session_by_id, get_session_stats
from app.services.annotation import get_annotations_by_session


router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("", response_model=SessionListResponse)
async def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    license_plate: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get paginated list of sessions."""
    filter = SessionFilter(
        license_plate=license_plate,
        date_from=date_from,
        date_to=date_to,
        status=status,
    )

    items, total = get_sessions(db, filter, page, page_size)

    return SessionListResponse(
        items=[SessionListItem.model_validate(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/stats", response_model=SessionStats)
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get overall statistics."""
    return get_session_stats(db)


@router.get("/{session_id}", response_model=SessionDetail)
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session details."""
    session = get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return SessionDetail.model_validate(session)


@router.get("/{session_id}/images", response_model=ImageListResponse)
async def get_session_images(
    session_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all images in a session."""
    session = get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    annotations, total = get_annotations_by_session(db, session_id, page, page_size)

    items = []
    for ann in annotations:
        info = AnnotationInfo.model_validate(ann)
        info.license_plate = session.license_plate
        info.date = session.date_str
        info.session_name = session.session_id
        items.append(info)

    return ImageListResponse(items=items, total=total)
