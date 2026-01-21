from datetime import datetime

from sqlalchemy.orm import Session

from app.models.annotation import Annotation
from app.models.session import Session as SessionModel
from app.schemas.annotation import AnnotationUpdate


def get_annotations_by_session(
    db: Session,
    session_id: int,
    page: int = 1,
    page_size: int = 100,
) -> tuple[list[Annotation], int]:
    """Get annotations for a session."""
    query = db.query(Annotation).filter(Annotation.session_id == session_id)
    query = query.order_by(Annotation.file_name.asc())

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return items, total


def get_annotation_by_id(db: Session, annotation_id: int) -> Annotation | None:
    """Get annotation by ID."""
    return db.query(Annotation).filter(Annotation.id == annotation_id).first()


def update_annotation(
    db: Session,
    annotation_id: int,
    update: AnnotationUpdate,
    user_id: int,
) -> Annotation | None:
    """Update annotation score or undecidable status."""
    annotation = get_annotation_by_id(db, annotation_id)
    if not annotation:
        return None

    # Get previous state
    was_annotated = annotation.score is not None or annotation.is_undecidable

    fields_set = update.model_fields_set

    # Update annotation
    if "score" in fields_set:
        annotation.score = update.score
    if "is_undecidable" in fields_set:
        annotation.is_undecidable = update.is_undecidable
    if "difficulty" in fields_set:
        annotation.difficulty = update.difficulty

    annotation.annotated_by = user_id
    annotation.annotated_at = datetime.utcnow()

    db.commit()
    db.refresh(annotation)

    # Update session counts if annotation state changed
    is_annotated = annotation.score is not None or annotation.is_undecidable
    if was_annotated != is_annotated:
        _update_session_annotated_count(db, annotation.session_id)

    return annotation


def _update_session_annotated_count(db: Session, session_id: int):
    """Update annotated_images count for a session."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if session:
        annotated = db.query(Annotation).filter(
            Annotation.session_id == session_id,
            (Annotation.score.isnot(None)) | (Annotation.is_undecidable == True)
        ).count()
        session.annotated_images = annotated
        db.commit()


def get_next_unannotated(db: Session, session_id: int) -> Annotation | None:
    """Get next unannotated image in session."""
    return db.query(Annotation).filter(
        Annotation.session_id == session_id,
        Annotation.score.is_(None),
        Annotation.is_undecidable == False
    ).order_by(Annotation.file_name.asc()).first()


def get_annotation_with_navigation(
    db: Session,
    annotation_id: int,
) -> dict | None:
    """Get annotation with navigation info (prev, next, next unannotated)."""
    annotation = get_annotation_by_id(db, annotation_id)
    if not annotation:
        return None

    session_id = annotation.session_id

    # Get all annotations in session ordered by file_name
    all_annotations = db.query(Annotation).filter(
        Annotation.session_id == session_id
    ).order_by(Annotation.file_name.asc()).all()

    total = len(all_annotations)
    current_idx = next(
        (i for i, a in enumerate(all_annotations) if a.id == annotation_id),
        None
    )

    if current_idx is None:
        return None

    prev_id = all_annotations[current_idx - 1].id if current_idx > 0 else None
    next_id = all_annotations[current_idx + 1].id if current_idx < total - 1 else None

    # Find next unannotated
    next_unannotated_id = None
    for i in range(current_idx + 1, total):
        a = all_annotations[i]
        if a.score is None and not a.is_undecidable:
            next_unannotated_id = a.id
            break

    # If not found after current, search from beginning
    if next_unannotated_id is None:
        for i in range(0, current_idx):
            a = all_annotations[i]
            if a.score is None and not a.is_undecidable:
                next_unannotated_id = a.id
                break

    return {
        "annotation": annotation,
        "prev_id": prev_id,
        "next_id": next_id,
        "next_unannotated_id": next_unannotated_id,
        "position": current_idx + 1,
        "total": total,
    }
