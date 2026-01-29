from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models import User, Session as SessionModel, ProcessingVersion, Slice, GTVersion, Artifact, Review

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("")
async def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    license_plate: str = None,
):
    """Get all sessions with pagination."""
    query = db.query(SessionModel)

    if license_plate:
        query = query.filter(SessionModel.license_plate.contains(license_plate))

    total = query.count()
    sessions = query.order_by(SessionModel.date.desc()).offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in sessions:
        # Count slices and reviews
        pv_ids = [pv.id for pv in s.processing_versions]
        slice_count = db.query(Slice).filter(Slice.processing_version_id.in_(pv_ids)).count() if pv_ids else 0
        review_count = db.query(Review).join(Slice).filter(Slice.processing_version_id.in_(pv_ids)).count() if pv_ids else 0
        reviewed_count = db.query(Review).join(Slice).filter(
            Slice.processing_version_id.in_(pv_ids),
            Review.result != 'unknown'
        ).count() if pv_ids else 0

        items.append({
            "id": s.id,
            "license_plate": s.license_plate,
            "date": s.date.isoformat(),
            "session_uuid": s.session_uuid,
            "processing_versions": len(s.processing_versions),
            "slice_count": slice_count,
            "review_count": review_count,
            "reviewed_count": reviewed_count,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/stats")
async def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get overall statistics."""
    total_sessions = db.query(SessionModel).count()
    total_processing_versions = db.query(ProcessingVersion).count()
    total_slices = db.query(Slice).count()
    total_gt_versions = db.query(GTVersion).count()
    total_artifacts = db.query(Artifact).count()
    total_reviews = db.query(Review).count()
    reviewed_count = db.query(Review).filter(Review.result != 'unknown').count()

    return {
        "total_sessions": total_sessions,
        "total_processing_versions": total_processing_versions,
        "total_slices": total_slices,
        "total_gt_versions": total_gt_versions,
        "total_artifacts": total_artifacts,
        "total_reviews": total_reviews,
        "reviewed_count": reviewed_count,
        "completion_rate": (reviewed_count / total_reviews * 100) if total_reviews > 0 else 0,
    }


@router.get("/{session_id}")
async def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get session details with processing versions."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        return {"error": "Session not found"}

    processing_versions = []
    for pv in session.processing_versions:
        slices = db.query(Slice).filter(Slice.processing_version_id == pv.id).all()
        gt_versions = db.query(GTVersion).filter(GTVersion.processing_version_id == pv.id).all()

        processing_versions.append({
            "id": pv.id,
            "dir_name": pv.dir_name,
            "software_version": pv.software_version,
            "processing_date": pv.processing_date.isoformat(),
            "processing_time": pv.processing_time.isoformat() if pv.processing_time else None,
            "slice_count": len(slices),
            "gt_versions": [
                {
                    "id": gt.id,
                    "gt_type": gt.gt_type,
                    "version_tag": gt.version_tag,
                    "dir_name": gt.dir_name,
                }
                for gt in gt_versions
            ],
        })

    return {
        "id": session.id,
        "license_plate": session.license_plate,
        "date": session.date.isoformat(),
        "session_uuid": session.session_uuid,
        "raw_root_path": session.raw_root_path,
        "processing_versions": processing_versions,
    }


@router.get("/{session_id}/slices")
async def get_session_slices(
    session_id: int,
    processing_version_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """Get slices for a session."""
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    if not session:
        return {"error": "Session not found"}

    pv_ids = [pv.id for pv in session.processing_versions]
    if processing_version_id:
        pv_ids = [processing_version_id] if processing_version_id in pv_ids else []

    query = db.query(Slice).filter(Slice.processing_version_id.in_(pv_ids))
    total = query.count()
    slices = query.offset((page - 1) * page_size).limit(page_size).all()

    items = []
    for s in slices:
        # Get review status
        preprocessing_review = db.query(Review).filter(
            Review.slice_id == s.id,
            Review.gt_version_id == None
        ).first()

        gt_reviews = db.query(Review).filter(
            Review.slice_id == s.id,
            Review.gt_version_id != None
        ).all()

        items.append({
            "id": s.id,
            "slice_name": s.slice_name,
            "processing_version_id": s.processing_version_id,
            "preprocessing_review": {
                "result": preprocessing_review.result if preprocessing_review else "unknown",
            } if preprocessing_review else None,
            "gt_reviews": [
                {
                    "gt_version_id": r.gt_version_id,
                    "result": r.result,
                }
                for r in gt_reviews
            ],
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
