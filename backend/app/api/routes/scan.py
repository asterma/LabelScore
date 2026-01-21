from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.scanner import scanner_service
from app.api.deps import get_current_user
from app.models.user import User


router = APIRouter(prefix="/scan", tags=["scan"])

class ScanSessionRequest(BaseModel):
    session_path: str


@router.post("/start")
async def start_scan(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start file system scan to discover images."""
    result = scanner_service.scan_all(db)
    return result


@router.post("/session")
async def scan_session(
    request: ScanSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Scan a single session directory under images_root_dir."""
    result = scanner_service.scan_session_path(db, request.session_path)
    return result


@router.get("/status")
async def get_scan_status(current_user: User = Depends(get_current_user)):
    """Get current scan status."""
    return scanner_service.get_status()
