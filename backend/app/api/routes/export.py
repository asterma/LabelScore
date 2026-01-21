from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.export import export_to_csv, export_to_json


router = APIRouter(prefix="/export", tags=["export"])


@router.get("/csv")
async def export_csv(
    session_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export annotations to CSV format."""
    content = export_to_csv(db, session_id)
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=annotations.csv"},
    )


@router.get("/json")
async def export_json(
    session_id: int | None = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export annotations to JSON format."""
    content = export_to_json(db, session_id)
    return Response(
        content=content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=annotations.json"},
    )
