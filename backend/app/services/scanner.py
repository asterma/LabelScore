import os
import re
from pathlib import Path
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.session import Session as SessionModel
from app.models.annotation import Annotation


@dataclass
class ParsedPath:
    """Parsed image path information."""
    license_plate: str
    year: int
    month: int
    day: int
    session_id: str
    software_version: str
    file_name: str
    relative_path: str


# Path pattern: /{license_plate}/{year}/{month}/{day}/{session_id}/{version}/map/visualize/{file}_driving_line.jpg
PATH_PATTERN = re.compile(
    r"^(?P<license_plate>[^/]+)/"
    r"(?P<year>\d{4})/"
    r"(?P<month>\d{1,2})/"
    r"(?P<day>\d{1,2})/"
    r"(?P<session_id>[^/]+)/"
    r"(?P<version>[^/]+)/"
    r"map/visualize/"
    r"(?P<filename>.+_driving_line\.jpg)$"
)


def parse_image_path(relative_path: str) -> ParsedPath | None:
    """Parse image path and extract metadata."""
    match = PATH_PATTERN.match(relative_path)
    if not match:
        return None

    return ParsedPath(
        license_plate=match.group("license_plate"),
        year=int(match.group("year")),
        month=int(match.group("month")),
        day=int(match.group("day")),
        session_id=match.group("session_id"),
        software_version=match.group("version"),
        file_name=match.group("filename"),
        relative_path=relative_path,
    )


class ScannerService:
    """File system scanner service."""

    def __init__(self):
        self.root_dir = Path(settings.images_root_dir)
        self.scan_status = {
            "is_running": False,
            "progress": 0,
            "total": 0,
            "current_file": "",
            "sessions_found": 0,
            "images_found": 0,
        }

    def scan_all(self, db: Session) -> dict:
        """Scan all images in root directory."""
        if self.scan_status["is_running"]:
            return {"error": "Scan already in progress"}

        self.scan_status = {
            "is_running": True,
            "progress": 0,
            "total": 0,
            "current_file": "",
            "sessions_found": 0,
            "images_found": 0,
        }

        try:
            # Find all jpg files
            image_files = list(self.root_dir.rglob("*_driving_line.jpg"))
            self.scan_status["total"] = len(image_files)

            sessions_cache: dict[str, SessionModel] = {}

            for idx, image_path in enumerate(image_files):
                self.scan_status["progress"] = idx + 1
                self.scan_status["current_file"] = str(image_path)

                # Get relative path
                try:
                    relative_path = str(image_path.relative_to(self.root_dir))
                except ValueError:
                    continue

                # Parse path
                parsed = parse_image_path(relative_path)
                if not parsed:
                    continue

                # Get or create session
                session_key = (
                    f"{parsed.license_plate}|{parsed.year}|{parsed.month}|"
                    f"{parsed.day}|{parsed.session_id}|{parsed.software_version}"
                )

                if session_key not in sessions_cache:
                    session = self._get_or_create_session(db, parsed)
                    sessions_cache[session_key] = session
                    self.scan_status["sessions_found"] += 1
                else:
                    session = sessions_cache[session_key]

                # Create annotation if not exists
                existing = db.query(Annotation).filter(
                    Annotation.file_path == relative_path
                ).first()

                if not existing:
                    annotation = Annotation(
                        session_id=session.id,
                        file_path=relative_path,
                        file_name=parsed.file_name,
                    )
                    db.add(annotation)
                    self.scan_status["images_found"] += 1

            db.commit()

            # Update session image counts
            self._update_session_counts(db)
            db.commit()

            return {
                "status": "completed",
                "sessions_found": self.scan_status["sessions_found"],
                "images_found": self.scan_status["images_found"],
            }

        except Exception as e:
            db.rollback()
            return {"error": str(e)}
        finally:
            self.scan_status["is_running"] = False

    def scan_session_path(self, db: Session, session_path: str) -> dict:
        """Scan a single session directory under root directory."""
        if self.scan_status["is_running"]:
            return {"error": "Scan already in progress"}

        self.scan_status = {
            "is_running": True,
            "progress": 0,
            "total": 0,
            "current_file": "",
            "sessions_found": 0,
            "images_found": 0,
        }

        try:
            raw_path = Path(session_path)
            target_path = raw_path if raw_path.is_absolute() else self.root_dir / raw_path
            target_path = target_path.resolve()
            root_resolved = self.root_dir.resolve()

            if not target_path.exists() or not target_path.is_dir():
                return {"error": "Invalid session path"}

            try:
                target_path.relative_to(root_resolved)
            except ValueError:
                return {"error": "Path must be under images_root_dir"}

            image_files = list(target_path.rglob("*_driving_line.jpg"))
            self.scan_status["total"] = len(image_files)

            sessions_cache: dict[str, SessionModel] = {}

            for idx, image_path in enumerate(image_files):
                self.scan_status["progress"] = idx + 1
                self.scan_status["current_file"] = str(image_path)

                # Get relative path
                try:
                    relative_path = str(image_path.relative_to(root_resolved))
                except ValueError:
                    continue

                # Parse path
                parsed = parse_image_path(relative_path)
                if not parsed:
                    continue

                # Get or create session
                session_key = (
                    f"{parsed.license_plate}|{parsed.year}|{parsed.month}|"
                    f"{parsed.day}|{parsed.session_id}|{parsed.software_version}"
                )

                if session_key not in sessions_cache:
                    session = self._get_or_create_session(db, parsed)
                    sessions_cache[session_key] = session
                    self.scan_status["sessions_found"] += 1
                else:
                    session = sessions_cache[session_key]

                # Create annotation if not exists
                existing = db.query(Annotation).filter(
                    Annotation.file_path == relative_path
                ).first()

                if not existing:
                    annotation = Annotation(
                        session_id=session.id,
                        file_path=relative_path,
                        file_name=parsed.file_name,
                    )
                    db.add(annotation)
                    self.scan_status["images_found"] += 1

            db.commit()

            # Update session image counts
            self._update_session_counts(db)
            db.commit()

            return {
                "status": "completed",
                "sessions_found": self.scan_status["sessions_found"],
                "images_found": self.scan_status["images_found"],
            }

        except Exception as e:
            db.rollback()
            return {"error": str(e)}
        finally:
            self.scan_status["is_running"] = False

    def _get_or_create_session(self, db: Session, parsed: ParsedPath) -> SessionModel:
        """Get existing session or create new one."""
        session = db.query(SessionModel).filter(
            SessionModel.license_plate == parsed.license_plate,
            SessionModel.year == parsed.year,
            SessionModel.month == parsed.month,
            SessionModel.day == parsed.day,
            SessionModel.session_id == parsed.session_id,
            SessionModel.software_version == parsed.software_version,
        ).first()

        if session:
            return session

        # Build base path
        base_path = (
            f"{parsed.license_plate}/{parsed.year}/{parsed.month:02d}/{parsed.day:02d}/"
            f"{parsed.session_id}/{parsed.software_version}/map/visualize"
        )

        session = SessionModel(
            license_plate=parsed.license_plate,
            year=parsed.year,
            month=parsed.month,
            day=parsed.day,
            session_id=parsed.session_id,
            software_version=parsed.software_version,
            base_path=base_path,
        )
        db.add(session)
        db.flush()  # Get ID
        return session

    def _update_session_counts(self, db: Session):
        """Update total_images and annotated_images counts for all sessions."""
        sessions = db.query(SessionModel).all()
        for session in sessions:
            total = db.query(Annotation).filter(
                Annotation.session_id == session.id
            ).count()

            annotated = db.query(Annotation).filter(
                Annotation.session_id == session.id,
                (Annotation.score.isnot(None)) | (Annotation.is_undecidable == True)
            ).count()

            session.total_images = total
            session.annotated_images = annotated

    def get_status(self) -> dict:
        """Get current scan status."""
        return self.scan_status.copy()


# Singleton instance
scanner_service = ScannerService()
