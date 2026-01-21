from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.session import Session as SessionModel
from app.models.annotation import Annotation
from app.schemas.session import SessionFilter, SessionStats


def get_sessions(
    db: Session,
    filter: SessionFilter | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[SessionModel], int]:
    """Get paginated list of sessions with optional filtering."""
    query = db.query(SessionModel)

    if filter:
        if filter.license_plate:
            query = query.filter(SessionModel.license_plate.contains(filter.license_plate))

        if filter.date_from:
            parts = filter.date_from.split("-")
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                query = query.filter(
                    (SessionModel.year > year) |
                    ((SessionModel.year == year) & (SessionModel.month > month)) |
                    ((SessionModel.year == year) & (SessionModel.month == month) & (SessionModel.day >= day))
                )

        if filter.date_to:
            parts = filter.date_to.split("-")
            if len(parts) == 3:
                year, month, day = int(parts[0]), int(parts[1]), int(parts[2])
                query = query.filter(
                    (SessionModel.year < year) |
                    ((SessionModel.year == year) & (SessionModel.month < month)) |
                    ((SessionModel.year == year) & (SessionModel.month == month) & (SessionModel.day <= day))
                )

        if filter.status:
            if filter.status == "pending":
                query = query.filter(SessionModel.annotated_images == 0)
            elif filter.status == "in_progress":
                query = query.filter(
                    SessionModel.annotated_images > 0,
                    SessionModel.annotated_images < SessionModel.total_images
                )
            elif filter.status == "completed":
                query = query.filter(
                    SessionModel.annotated_images == SessionModel.total_images,
                    SessionModel.total_images > 0
                )

    # Order by date desc
    query = query.order_by(
        SessionModel.year.desc(),
        SessionModel.month.desc(),
        SessionModel.day.desc(),
        SessionModel.session_id.asc()
    )

    total = query.count()
    items = query.offset((page - 1) * page_size).limit(page_size).all()

    return items, total


def get_session_by_id(db: Session, session_id: int) -> SessionModel | None:
    """Get session by ID."""
    return db.query(SessionModel).filter(SessionModel.id == session_id).first()


def get_session_stats(db: Session) -> SessionStats:
    """Get overall session statistics."""
    total_sessions = db.query(SessionModel).count()

    result = db.query(
        func.sum(SessionModel.total_images),
        func.sum(SessionModel.annotated_images)
    ).first()

    total_images = result[0] or 0
    annotated_images = result[1] or 0

    completion_rate = (annotated_images / total_images * 100) if total_images > 0 else 0

    return SessionStats(
        total_sessions=total_sessions,
        total_images=total_images,
        annotated_images=annotated_images,
        completion_rate=round(completion_rate, 2),
    )
