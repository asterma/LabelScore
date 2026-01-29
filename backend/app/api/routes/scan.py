from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.scanner import scanner_service
from app.api.deps import get_current_user
from app.models.user import User


router = APIRouter(prefix="/scan", tags=["scan"])


class ScanSessionRequest(BaseModel):
    """Request to scan a session directory."""
    session_path: str  # Path to session: {license_plate}/{year}/{month}/{day}/{session_uuid}
    sync_delete: bool = False  # Delete missing slices/artifacts when rescanning


class CreateReviewsRequest(BaseModel):
    """Request to create review records for a processing version."""
    processing_version_id: int


@router.post("/session")
async def scan_session(
    request: ScanSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scan a session directory and register all data.

    Expected path structure: {license_plate}/{year}/{month}/{day}/{session_uuid}

    This will:
    1. Create/update Session record
    2. Scan all ProcessingVersion directories
    3. Register Slices from sync/ directory
    4. Register preprocessing Artifacts
    5. Scan GT versions and register GT Artifacts
    """
    result = scanner_service.scan_session(db, request.session_path, sync_delete=request.sync_delete)
    return result


@router.post("/create-reviews")
async def create_reviews(
    request: CreateReviewsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create review records for all slices in a processing version.

    This creates:
    - One preprocessing review per slice
    - One GT review per slice per GT version (only for slices with GT artifacts)
    """
    scanner_service.create_reviews_for_slices(db, request.processing_version_id)
    return {"status": "completed"}


@router.get("/status")
async def get_scan_status(current_user: User = Depends(get_current_user)):
    """Get current scan status."""
    return scanner_service.get_status()
