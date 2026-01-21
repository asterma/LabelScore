from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.annotation import (
    AnnotationInfo,
    AnnotationUpdate,
    AnnotationWithNavigation,
)
from app.services.annotation import (
    get_annotation_by_id,
    update_annotation,
    get_next_unannotated,
    get_annotation_with_navigation,
)
from app.services.session import get_session_by_id


router = APIRouter(prefix="/annotations", tags=["annotations"])


@router.get("/{annotation_id}", response_model=AnnotationWithNavigation)
async def get_annotation(
    annotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get annotation with navigation info."""
    result = get_annotation_with_navigation(db, annotation_id)
    if not result:
        raise HTTPException(status_code=404, detail="Annotation not found")

    annotation = result["annotation"]
    session = get_session_by_id(db, annotation.session_id)

    response = AnnotationWithNavigation(
        id=annotation.id,
        session_id=annotation.session_id,
        file_path=annotation.file_path,
        file_name=annotation.file_name,
        score=annotation.score,
        is_undecidable=annotation.is_undecidable,
        difficulty=annotation.difficulty,
        annotated_by=annotation.annotated_by,
        annotated_at=annotation.annotated_at,
        license_plate=session.license_plate if session else None,
        date=session.date_str if session else None,
        session_name=session.session_id if session else None,
        prev_id=result["prev_id"],
        next_id=result["next_id"],
        next_unannotated_id=result["next_unannotated_id"],
        position=result["position"],
        total=result["total"],
    )
    return response


@router.put("/{annotation_id}", response_model=AnnotationInfo)
async def update_annotation_score(
    annotation_id: int,
    update: AnnotationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update annotation score or undecidable status."""
    annotation = update_annotation(db, annotation_id, update, current_user.id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    session = get_session_by_id(db, annotation.session_id)

    return AnnotationInfo(
        id=annotation.id,
        session_id=annotation.session_id,
        file_path=annotation.file_path,
        file_name=annotation.file_name,
        score=annotation.score,
        is_undecidable=annotation.is_undecidable,
        difficulty=annotation.difficulty,
        annotated_by=annotation.annotated_by,
        annotated_at=annotation.annotated_at,
        license_plate=session.license_plate if session else None,
        date=session.date_str if session else None,
        session_name=session.session_id if session else None,
    )


@router.get("/next/{session_id}", response_model=AnnotationInfo | None)
async def get_next_unannotated_image(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get next unannotated image in session."""
    session = get_session_by_id(db, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    annotation = get_next_unannotated(db, session_id)
    if not annotation:
        return None

    return AnnotationInfo(
        id=annotation.id,
        session_id=annotation.session_id,
        file_path=annotation.file_path,
        file_name=annotation.file_name,
        score=annotation.score,
        is_undecidable=annotation.is_undecidable,
        difficulty=annotation.difficulty,
        annotated_by=annotation.annotated_by,
        annotated_at=annotation.annotated_at,
        license_plate=session.license_plate,
        date=session.date_str,
        session_name=session.session_id,
    )
