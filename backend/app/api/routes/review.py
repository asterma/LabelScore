from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pathlib import Path

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.core.security import decode_access_token
from app.services.auth import get_user_by_id
from app.models import User, Slice, ProcessingVersion, GTVersion, Artifact, Review, Session as SessionModel

router = APIRouter(prefix="/review", tags=["review"])

DIFFICULTY_LEVELS = {"default", "easy", "median", "hard", "Error"}


def build_review_payload(review: Review | None):
    if not review:
        return {
            "result": "unknown",
            "review_id": None,
            "score": None,
            "is_undecidable": False,
            "difficulty": "default",
        }

    result = review.result or "unknown"
    if review.is_undecidable:
        result = "undecidable"
    elif review.score is not None:
        result = "scored"

    return {
        "result": result,
        "review_id": review.id,
        "score": review.score,
        "is_undecidable": review.is_undecidable,
        "difficulty": review.difficulty or "default",
    }


@router.get("/slices/{processing_version_id}")
async def get_slices_for_review(
    processing_version_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    filter_status: str = Query(None, description="Filter by status: unknown, scored, undecidable"),
):
    """Get slices for review with their review status."""
    pv = db.query(ProcessingVersion).filter(ProcessingVersion.id == processing_version_id).first()
    if not pv:
        raise HTTPException(status_code=404, detail="Processing version not found")

    query = db.query(Slice).filter(Slice.processing_version_id == processing_version_id)

    total = query.count()
    slices = query.order_by(Slice.slice_name).offset((page - 1) * page_size).limit(page_size).all()

    # Get GT versions for this processing version
    gt_versions = db.query(GTVersion).filter(
        GTVersion.processing_version_id == processing_version_id
    ).all()

    items = []
    for s in slices:
        # Get preprocessing review
        prep_review = db.query(Review).filter(
            Review.slice_id == s.id,
            Review.gt_version_id == None
        ).first()

        # Get GT reviews
        gt_reviews = []
        for gt in gt_versions:
            gt_review = db.query(Review).filter(
                Review.slice_id == s.id,
                Review.gt_version_id == gt.id
            ).first()

            # Check if this slice has GT artifacts
            has_gt_artifacts = db.query(Artifact).filter(
                Artifact.slice_id == s.id,
                Artifact.gt_version_id == gt.id
            ).first() is not None

            if has_gt_artifacts:
                gt_payload = build_review_payload(gt_review)
                gt_reviews.append({
                    "gt_version_id": gt.id,
                    "gt_type": gt.gt_type,
                    "version_tag": gt.version_tag,
                    "result": gt_payload["result"],
                    "review_id": gt_payload["review_id"],
                    "score": gt_payload["score"],
                    "is_undecidable": gt_payload["is_undecidable"],
                    "difficulty": gt_payload["difficulty"],
                })

        items.append({
            "id": s.id,
            "slice_name": s.slice_name,
            "preprocessing_review": build_review_payload(prep_review),
            "gt_reviews": gt_reviews,
        })

    # Apply filter if specified
    if filter_status:
        items = [item for item in items if item["preprocessing_review"]["result"] == filter_status]

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "session_id": pv.session_id,
        "processing_version": {
            "id": pv.id,
            "dir_name": pv.dir_name,
            "software_version": pv.software_version,
        },
        "gt_versions": [
            {"id": gt.id, "gt_type": gt.gt_type, "version_tag": gt.version_tag}
            for gt in gt_versions
        ],
    }


@router.get("/slice/{slice_id}")
async def get_slice_detail(
    slice_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get slice detail with artifacts and reviews."""
    slice_obj = db.query(Slice).filter(Slice.id == slice_id).first()
    if not slice_obj:
        raise HTTPException(status_code=404, detail="Slice not found")

    pv = db.query(ProcessingVersion).filter(
        ProcessingVersion.id == slice_obj.processing_version_id
    ).first()

    session = db.query(SessionModel).filter(SessionModel.id == pv.session_id).first()

    # Get preprocessing artifacts
    prep_artifacts = db.query(Artifact).filter(
        Artifact.slice_id == slice_id,
        Artifact.gt_version_id == None
    ).all()

    # Get preprocessing review
    prep_review = db.query(Review).filter(
        Review.slice_id == slice_id,
        Review.gt_version_id == None
    ).first()

    # Get GT versions and their artifacts/reviews
    gt_versions = db.query(GTVersion).filter(
        GTVersion.processing_version_id == pv.id
    ).all()

    gt_data = []
    for gt in gt_versions:
        gt_artifacts = db.query(Artifact).filter(
            Artifact.slice_id == slice_id,
            Artifact.gt_version_id == gt.id
        ).all()

        if gt_artifacts:  # Only include if has artifacts
            gt_review = db.query(Review).filter(
                Review.slice_id == slice_id,
                Review.gt_version_id == gt.id
            ).first()

            gt_data.append({
                "gt_version": {
                    "id": gt.id,
                    "gt_type": gt.gt_type,
                    "version_tag": gt.version_tag,
                    "dir_name": gt.dir_name,
                },
                "artifacts": [
                    {
                        "id": a.id,
                        "category": a.category,
                        "file_name": a.file_name,
                        "file_type": a.file_type,
                    }
                    for a in gt_artifacts
                ],
                "review": {
                    "id": gt_review.id,
                    "result": gt_review.result,
                    "comment": gt_review.comment,
                    "score": gt_review.score,
                    "is_undecidable": gt_review.is_undecidable,
                    "difficulty": gt_review.difficulty,
                } if gt_review else None,
            })

    # Get navigation info
    all_slices = db.query(Slice).filter(
        Slice.processing_version_id == pv.id
    ).order_by(Slice.slice_name).all()

    slice_ids = [s.id for s in all_slices]
    current_idx = slice_ids.index(slice_id) if slice_id in slice_ids else 0

    prev_id = slice_ids[current_idx - 1] if current_idx > 0 else None
    next_id = slice_ids[current_idx + 1] if current_idx < len(slice_ids) - 1 else None

    return {
        "slice": {
            "id": slice_obj.id,
            "slice_name": slice_obj.slice_name,
        },
        "session": {
            "id": session.id,
            "license_plate": session.license_plate,
            "date": session.date.isoformat(),
        },
        "processing_version": {
            "id": pv.id,
            "dir_name": pv.dir_name,
            "software_version": pv.software_version,
        },
        "preprocessing": {
            "artifacts": [
                {
                    "id": a.id,
                    "category": a.category,
                    "file_name": a.file_name,
                    "file_type": a.file_type,
                }
                for a in prep_artifacts
            ],
            "review": {
                "id": prep_review.id,
                "result": prep_review.result,
                "comment": prep_review.comment,
                "score": prep_review.score,
                "is_undecidable": prep_review.is_undecidable,
                "difficulty": prep_review.difficulty,
            } if prep_review else None,
        },
        "gt_data": gt_data,
        "navigation": {
            "prev_id": prev_id,
            "next_id": next_id,
            "position": current_idx + 1,
            "total": len(slice_ids),
        },
    }


@router.post("/update")
async def update_review(
    slice_id: int,
    gt_version_id: int = None,
    result: str = "unknown",
    score: int | None = None,
    is_undecidable: bool | None = None,
    difficulty: str | None = None,
    comment: str = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update or create a review."""
    # Validate slice exists
    slice_obj = db.query(Slice).filter(Slice.id == slice_id).first()
    if not slice_obj:
        raise HTTPException(status_code=404, detail="Slice not found")

    # Validate result
    if result not in ["unknown", "pass", "fail", "scored", "undecidable"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid result. Must be: unknown, pass, fail, scored, undecidable",
        )

    # Validate score
    if score is not None and (score < 1 or score > 5):
        raise HTTPException(status_code=400, detail="Invalid score. Must be 1-5")

    # Validate difficulty
    if difficulty is not None and difficulty not in DIFFICULTY_LEVELS:
        raise HTTPException(
            status_code=400,
            detail="Invalid difficulty. Must be: default, easy, median, hard, Error",
        )

    # Find or create review
    review = db.query(Review).filter(
        Review.slice_id == slice_id,
        Review.gt_version_id == gt_version_id
    ).first()

    if review:
        if comment is not None:
            review.comment = comment
        if score is not None:
            review.score = score
            review.is_undecidable = False
        if is_undecidable is not None:
            review.is_undecidable = is_undecidable
            if is_undecidable:
                review.score = None
        if difficulty is not None:
            review.difficulty = difficulty
        review.result = "unknown"
        if review.is_undecidable:
            review.result = "undecidable"
        elif review.score is not None:
            review.result = "scored"
        else:
            review.result = result
        review.reviewed_by = current_user.id
        from datetime import datetime
        review.reviewed_at = datetime.utcnow()
    else:
        from datetime import datetime
        review = Review(
            slice_id=slice_id,
            gt_version_id=gt_version_id,
            result=result,
            comment=comment,
            score=score,
            is_undecidable=is_undecidable or False,
            difficulty=difficulty or "default",
            reviewed_by=current_user.id,
            reviewed_at=datetime.utcnow(),
        )
        if review.is_undecidable:
            review.score = None
            review.result = "undecidable"
        elif review.score is not None:
            review.result = "scored"
        db.add(review)

    db.commit()
    db.refresh(review)

    return {
        "id": review.id,
        "slice_id": review.slice_id,
        "gt_version_id": review.gt_version_id,
        "result": review.result,
        "comment": review.comment,
        "score": review.score,
        "is_undecidable": review.is_undecidable,
        "difficulty": review.difficulty,
    }


@router.get("/artifact/{artifact_id}/file")
async def get_artifact_file(
    artifact_id: int,
    token: str | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """Get artifact file."""
    if current_user is None and token:
        payload = decode_access_token(token)
        if payload is not None:
            user_id = payload.get("sub")
            if user_id is not None:
                current_user = get_user_by_id(db, int(user_id))

    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    artifact = db.query(Artifact).filter(Artifact.id == artifact_id).first()
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    file_path = Path(artifact.file_path)
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Determine media type
    media_type = "application/octet-stream"
    ext = file_path.suffix.lower()
    if ext in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext == ".png":
        media_type = "image/png"
    elif ext == ".mp4":
        media_type = "video/mp4"

    return FileResponse(file_path, media_type=media_type)
