import csv
import json
from io import StringIO
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.session import Session as SessionModel
from app.models.annotation import Annotation
from app.models.user import User


def export_to_csv(db: Session, session_id: int | None = None) -> str:
    """Export annotations to CSV format."""
    query = db.query(
        Annotation,
        SessionModel,
        User.username.label("annotator_name")
    ).join(
        SessionModel, Annotation.session_id == SessionModel.id
    ).outerjoin(
        User, Annotation.annotated_by == User.id
    )

    if session_id:
        query = query.filter(Annotation.session_id == session_id)

    query = query.order_by(
        SessionModel.license_plate,
        SessionModel.year,
        SessionModel.month,
        SessionModel.day,
        Annotation.file_name
    )

    results = query.all()

    output = StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "id",
        "license_plate",
        "date",
        "session_id",
        "software_version",
        "file_name",
        "file_path",
        "score",
        "is_undecidable",
        "difficulty",
        "annotated_by",
        "annotated_at",
    ])

    for annotation, session, annotator_name in results:
        writer.writerow([
            annotation.id,
            session.license_plate,
            f"{session.year}-{session.month:02d}-{session.day:02d}",
            session.session_id,
            session.software_version,
            annotation.file_name,
            annotation.file_path,
            annotation.score if annotation.score else "",
            "true" if annotation.is_undecidable else "false",
            annotation.difficulty,
            annotator_name or "",
            annotation.annotated_at.isoformat() if annotation.annotated_at else "",
        ])

    return output.getvalue()


def export_to_json(db: Session, session_id: int | None = None) -> str:
    """Export annotations to JSON format."""
    query = db.query(
        Annotation,
        SessionModel,
        User.username.label("annotator_name")
    ).join(
        SessionModel, Annotation.session_id == SessionModel.id
    ).outerjoin(
        User, Annotation.annotated_by == User.id
    )

    if session_id:
        query = query.filter(Annotation.session_id == session_id)

    query = query.order_by(
        SessionModel.license_plate,
        SessionModel.year,
        SessionModel.month,
        SessionModel.day,
        Annotation.file_name
    )

    results = query.all()

    data = {
        "exported_at": datetime.utcnow().isoformat(),
        "total_count": len(results),
        "annotations": []
    }

    for annotation, session, annotator_name in results:
        data["annotations"].append({
            "id": annotation.id,
            "license_plate": session.license_plate,
            "date": f"{session.year}-{session.month:02d}-{session.day:02d}",
            "session_id": session.session_id,
            "software_version": session.software_version,
            "file_name": annotation.file_name,
            "file_path": annotation.file_path,
            "score": annotation.score,
            "is_undecidable": annotation.is_undecidable,
            "difficulty": annotation.difficulty,
            "annotated_by": annotator_name,
            "annotated_at": annotation.annotated_at.isoformat() if annotation.annotated_at else None,
        })

    return json.dumps(data, ensure_ascii=False, indent=2)
