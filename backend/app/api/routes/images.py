from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_user
from app.models.user import User
from app.services.annotation import get_annotation_by_id


router = APIRouter(prefix="/images", tags=["images"])


def _build_intensity_path(relative_path: str) -> str:
    if "/map/visualize/" not in relative_path or not relative_path.endswith("_driving_line.jpg"):
        raise ValueError("Unsupported image path pattern")

    base = relative_path.replace("/map/visualize/", "/map/IMG_INTENSITY/")
    return base.replace("_driving_line.jpg", "_labeling.jpg")


@router.get("/{annotation_id}")
async def get_image(
    annotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get image file by annotation ID."""
    annotation = get_annotation_by_id(db, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    image_path = Path(settings.images_root_dir) / annotation.file_path

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Image file not found")

    return FileResponse(
        path=str(image_path),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/{annotation_id}/intensity")
async def get_intensity_image(
    annotation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get intensity image file by annotation ID."""
    annotation = get_annotation_by_id(db, annotation_id)
    if not annotation:
        raise HTTPException(status_code=404, detail="Annotation not found")

    try:
        intensity_relative = _build_intensity_path(annotation.file_path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Unsupported image path pattern")

    image_path = Path(settings.images_root_dir) / intensity_relative

    if not image_path.exists():
        raise HTTPException(status_code=404, detail="Intensity image not found")

    return FileResponse(
        path=str(image_path),
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=3600"},
    )
