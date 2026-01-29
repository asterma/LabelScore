import os
import re
from datetime import date, datetime
from pathlib import Path
from dataclasses import dataclass

from sqlalchemy.orm import Session as DBSession

from app.core.config import settings
from app.models import Session, ProcessingVersion, Slice, GTVersion, Artifact, Review


@dataclass
class ParsedSessionPath:
    """Parsed session path information."""
    license_plate: str
    year: int
    month: int
    day: int
    session_uuid: str


@dataclass
class ParsedProcessingVersion:
    """Parsed processing version directory name."""
    processing_date: date | None
    software_version: str
    dir_name: str


@dataclass
class ParsedGTVersion:
    """Parsed GT version directory name."""
    gt_type: str  # "OD" or "RF"
    gt_date: date
    version_tag: str
    dir_name: str


# Pattern: {license_plate}/{year}/{month}/{day}/{session_uuid}
SESSION_PATH_PATTERN = re.compile(
    r"(?P<license_plate>[^/]+)/"
    r"(?P<year>\d{4})/"
    r"(?P<month>\d{1,2})/"
    r"(?P<day>\d{1,2})/"
    r"(?P<session_uuid>[a-f0-9-]{36})$"
)

# Pattern: {date}_{software_version}, e.g., 2026-01-20_tmp_ld_annotatorv039
PROCESSING_VERSION_PATTERN = re.compile(
    r"^(?P<date>\d{4}-\d{2}-\d{2})_(?P<version>.+)$"
)

# Pattern: {software_version}_run-xxx, e.g., tmp_ld_annotatorv039_run-001
PROCESSING_VERSION_RUN_PATTERN = re.compile(
    r"^(?P<version>.+)_run-(?P<run>\d+)$"
)

# Pattern: GT_{type}-{date}-{version_tag}, e.g., GT_OD-2026-01-20-v1.0.0
GT_VERSION_PATTERN = re.compile(
    r"^GT_(?P<type>OD|RF)-(?P<date>\d{4}-\d{2}-\d{2})-(?P<version>v[\d.]+)$"
)


def parse_session_path(session_path: Path) -> ParsedSessionPath | None:
    """Parse session path to extract metadata."""
    path_str = str(session_path).replace("\\", "/")
    match = SESSION_PATH_PATTERN.search(path_str)
    if not match:
        return None

    return ParsedSessionPath(
        license_plate=match.group("license_plate"),
        year=int(match.group("year")),
        month=int(match.group("month")),
        day=int(match.group("day")),
        session_uuid=match.group("session_uuid"),
    )


def parse_processing_version(dir_name: str) -> ParsedProcessingVersion | None:
    """Parse processing version directory name."""
    match = PROCESSING_VERSION_PATTERN.match(dir_name)
    if match:
        date_str = match.group("date")
        year, month, day = map(int, date_str.split("-"))
        return ParsedProcessingVersion(
            processing_date=date(year, month, day),
            software_version=match.group("version"),
            dir_name=dir_name,
        )

    match = PROCESSING_VERSION_RUN_PATTERN.match(dir_name)
    if not match:
        return None

    return ParsedProcessingVersion(
        processing_date=None,
        software_version=match.group("version"),
        dir_name=dir_name,
    )


def parse_processing_time_from_log(pv_path: Path) -> datetime | None:
    log_path = pv_path / "run.log"
    if not log_path.exists():
        return None

    try:
        with log_path.open("r", encoding="utf-8") as f:
            first_line = f.readline().strip()
    except OSError:
        return None

    if not first_line:
        return None

    match = re.match(r"^(?P<dt>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})", first_line)
    if not match:
        return None

    try:
        return datetime.strptime(match.group("dt"), "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return None


def parse_gt_version(dir_name: str) -> ParsedGTVersion | None:
    """Parse GT version directory name."""
    match = GT_VERSION_PATTERN.match(dir_name)
    if not match:
        return None

    date_str = match.group("date")
    year, month, day = map(int, date_str.split("-"))

    return ParsedGTVersion(
        gt_type=match.group("type"),
        gt_date=date(year, month, day),
        version_tag=match.group("version"),
        dir_name=dir_name,
    )


def get_file_type(file_path: Path) -> str:
    """Determine file type based on extension."""
    ext = file_path.suffix.lower()
    if ext in {".jpg", ".jpeg", ".png", ".bmp"}:
        return "image"
    elif ext in {".mp4", ".avi", ".mkv", ".mov"}:
        return "video"
    elif ext in {".bag"}:
        return "bag"
    elif ext in {".mf4", ".MF4"}:
        return "raw"
    else:
        return "other"


class ScannerService:
    """File system scanner service for new data structure."""

    def __init__(self):
        self.root_dir = Path(settings.images_root_dir)
        self.scan_status = {
            "is_running": False,
            "progress": 0,
            "total": 0,
            "current_file": "",
            "sessions_found": 0,
            "slices_found": 0,
            "artifacts_found": 0,
        }

    def get_status(self) -> dict:
        """Get current scan status."""
        return self.scan_status.copy()

    def scan_session(
        self,
        db: DBSession,
        raw_session_path: str,
        sync_delete: bool = False,
    ) -> dict:
        """
        Scan a session directory and register all data.

        Expected structure:
        {license_plate}/{year}/{month}/{day}/{session_uuid}/
        ├── {date}_{software_version}/  (ProcessingVersion)
        │   ├── sync/                   (Slices defined here)
        │   ├── map/IMG_INTENSITY/
        │   ├── map/visualize/
        │   ├── od/
        │   ├── SingleOdomEgo_3d/
        │   ├── SingleOdomSlam_3d/
        │   ├── video/{slice_name}/
        │   ├── GT_OD-{date}-{version}/
        │   └── GT_RF-{date}-{version}/
        ├── MT_ROOFTOPBOX/              (Raw data)
        └── ...
        """
        raw_path = Path(raw_session_path).resolve()

        if not raw_path.exists() or not raw_path.is_dir():
            return {"error": "Invalid session path"}

        # Parse session info
        parsed_session = parse_session_path(raw_path)
        if not parsed_session:
            return {"error": "Failed to parse session path. Expected: {license_plate}/{year}/{month}/{day}/{session_uuid}"}

        self.scan_status = {
            "is_running": True,
            "progress": 0,
            "total": 0,
            "current_file": "",
            "sessions_found": 0,
            "slices_found": 0,
            "artifacts_found": 0,
            "slices_removed": 0,
            "artifacts_removed": 0,
            "gt_versions_removed": 0,
            "reviews_removed": 0,
        }

        try:
            # Create or get session
            session = self._get_or_create_session(db, parsed_session, raw_path)
            self.scan_status["sessions_found"] = 1

            # Find all processing versions (directories matching pattern)
            for item in raw_path.iterdir():
                if not item.is_dir():
                    continue

                parsed_pv = parse_processing_version(item.name)
                if not parsed_pv:
                    continue

                processing_time = parse_processing_time_from_log(item)
                processing_date = (
                    processing_time.date()
                    if processing_time
                    else parsed_pv.processing_date or session.date
                )

                # Create or get processing version
                pv = self._get_or_create_processing_version(
                    db, session, parsed_pv, item, processing_date, processing_time
                )

                slices = {
                    s.slice_name: s
                    for s in db.query(Slice).filter(Slice.processing_version_id == pv.id).all()
                }
                seen_slices: set[str] = set()
                seen_artifacts: set[tuple[str, int | None, str, str]] = set()
                seen_gt_versions: set[int] = set()

                # Scan slices from sync directory
                sync_dir = item / "sync"
                if sync_dir.exists():
                    self._scan_slices(db, pv, sync_dir, slices, seen_slices)

                # Scan preprocessing artifacts
                self._scan_preprocessing_artifacts(db, pv, item, slices, seen_artifacts)

                # Scan GT versions
                self._scan_gt_versions(db, pv, item, slices, seen_artifacts, seen_gt_versions)

                if sync_delete:
                    removed = self._sync_processing_version(
                        db, pv, seen_slices, seen_artifacts, seen_gt_versions
                    )
                    self.scan_status["slices_removed"] += removed["slices_removed"]
                    self.scan_status["artifacts_removed"] += removed["artifacts_removed"]
                    self.scan_status["gt_versions_removed"] += removed["gt_versions_removed"]
                    self.scan_status["reviews_removed"] += removed["reviews_removed"]

            db.commit()

            return {
                "status": "completed",
                "session_id": session.id,
                "slices_found": self.scan_status["slices_found"],
                "artifacts_found": self.scan_status["artifacts_found"],
                "slices_removed": self.scan_status["slices_removed"],
                "artifacts_removed": self.scan_status["artifacts_removed"],
                "gt_versions_removed": self.scan_status["gt_versions_removed"],
                "reviews_removed": self.scan_status["reviews_removed"],
            }

        except Exception as e:
            db.rollback()
            return {"error": str(e)}
        finally:
            self.scan_status["is_running"] = False

    def _get_or_create_session(
        self, db: DBSession, parsed: ParsedSessionPath, raw_path: Path
    ) -> Session:
        """Get existing session or create new one."""
        session_date = date(parsed.year, parsed.month, parsed.day)

        session = db.query(Session).filter(
            Session.license_plate == parsed.license_plate,
            Session.date == session_date,
            Session.session_uuid == parsed.session_uuid,
        ).first()

        if session:
            return session

        session = Session(
            license_plate=parsed.license_plate,
            date=session_date,
            session_uuid=parsed.session_uuid,
            raw_root_path=str(raw_path),
        )
        db.add(session)
        db.flush()
        return session

    def _get_or_create_processing_version(
        self,
        db: DBSession,
        session: Session,
        parsed: ParsedProcessingVersion,
        pv_path: Path,
        processing_date: date,
        processing_time: datetime | None,
    ) -> ProcessingVersion:
        """Get existing processing version or create new one."""
        pv = db.query(ProcessingVersion).filter(
            ProcessingVersion.session_id == session.id,
            ProcessingVersion.dir_name == parsed.dir_name,
        ).first()

        if pv:
            if processing_time and pv.processing_time != processing_time:
                pv.processing_time = processing_time
            if pv.processing_date != processing_date:
                pv.processing_date = processing_date
            return pv

        pv = ProcessingVersion(
            session_id=session.id,
            dir_name=parsed.dir_name,
            software_version=parsed.software_version,
            processing_date=processing_date,
            processing_time=processing_time,
            root_path=str(pv_path),
        )
        db.add(pv)
        db.flush()
        return pv

    def _scan_slices(
        self,
        db: DBSession,
        pv: ProcessingVersion,
        sync_dir: Path,
        slices: dict[str, Slice],
        seen_slices: set[str],
    ):
        """Scan slices from sync directory (bag files)."""
        for bag_file in sync_dir.glob("*.bag"):
            slice_name = bag_file.stem  # Remove .bag extension
            seen_slices.add(slice_name)

            # Check if slice already exists
            existing = slices.get(slice_name)
            if not existing:
                slice_obj = Slice(processing_version_id=pv.id, slice_name=slice_name)
                db.add(slice_obj)
                db.flush()
                slices[slice_name] = slice_obj
                self.scan_status["slices_found"] += 1

        db.flush()

    def _scan_preprocessing_artifacts(
        self,
        db: DBSession,
        pv: ProcessingVersion,
        pv_path: Path,
        slices: dict[str, Slice],
        seen_artifacts: set[tuple[str, int | None, str, str]],
    ):
        """Scan preprocessing artifacts (non-GT files)."""
        if not slices:
            return

        # Define preprocessing directories to scan
        preprocessing_dirs = [
            ("sync", "sync"),
            ("map/IMG_INTENSITY", "map/IMG_INTENSITY"),
            ("map/INTENSITY", "map/INTENSITY"),
            ("map/visualize", "map/visualize"),
            ("od", "od"),
            ("SingleOdomEgo_3d", "SingleOdomEgo_3d"),
            ("SingleOdomSlam_3d", "SingleOdomSlam_3d"),
            ("Road_feature", "Road_feature"),
        ]

        for dir_path, category in preprocessing_dirs:
            full_dir = pv_path / dir_path
            if not full_dir.exists():
                continue

            for file_path in full_dir.iterdir():
                if file_path.is_dir():
                    continue

                self._create_artifact_for_slice(
                    db, pv, slices, file_path, category, gt_version=None, seen_artifacts=seen_artifacts
                )

        # Scan video directory (has subdirectories per slice)
        video_dir = pv_path / "video"
        if video_dir.exists():
            for slice_dir in video_dir.iterdir():
                if not slice_dir.is_dir():
                    continue

                slice_name = slice_dir.name
                if slice_name not in slices:
                    continue

                slice_obj = slices[slice_name]
                for video_file in slice_dir.iterdir():
                    if video_file.is_dir():
                        continue

                    self._create_artifact(
                        db,
                        slice_obj,
                        video_file,
                        "video",
                        gt_version=None,
                        seen_artifacts=seen_artifacts,
                    )

    def _scan_gt_versions(
        self,
        db: DBSession,
        pv: ProcessingVersion,
        pv_path: Path,
        slices: dict[str, Slice],
        seen_artifacts: set[tuple[str, int | None, str, str]],
        seen_gt_versions: set[int],
    ):
        """Scan GT version directories."""
        if not slices:
            return

        for item in pv_path.iterdir():
            if not item.is_dir():
                continue

            parsed_gt = parse_gt_version(item.name)
            if not parsed_gt:
                continue

            # Create or get GT version
            gt_version = self._get_or_create_gt_version(db, pv, parsed_gt)
            seen_gt_versions.add(gt_version.id)

            # Scan GT artifacts
            self._scan_gt_artifacts(db, gt_version, slices, item, seen_artifacts)

    def _get_or_create_gt_version(
        self, db: DBSession, pv: ProcessingVersion, parsed: ParsedGTVersion
    ) -> GTVersion:
        """Get existing GT version or create new one."""
        gt = db.query(GTVersion).filter(
            GTVersion.processing_version_id == pv.id,
            GTVersion.gt_type == parsed.gt_type,
            GTVersion.version_tag == parsed.version_tag,
        ).first()

        if gt:
            return gt

        gt = GTVersion(
            processing_version_id=pv.id,
            gt_type=parsed.gt_type,
            dir_name=parsed.dir_name,
            gt_date=parsed.gt_date,
            version_tag=parsed.version_tag,
        )
        db.add(gt)
        db.flush()
        return gt

    def _scan_gt_artifacts(
        self,
        db: DBSession,
        gt_version: GTVersion,
        slices: dict[str, Slice],
        gt_path: Path,
        seen_artifacts: set[tuple[str, int | None, str, str]],
    ):
        """Scan artifacts under a GT version directory."""
        # GT directories have structure like:
        # GT_OD-2026-01-20-v1.0.0/
        # ├── OD_LDE/  (or RF_LDE for RF)
        # └── video/

        gt_type = gt_version.gt_type  # "OD" or "RF"

        # Scan LDE directory
        lde_dir = gt_path / f"{gt_type}_LDE"
        if lde_dir.exists():
            for file_path in lde_dir.iterdir():
                if file_path.is_dir():
                    continue
                self._create_artifact_for_slice(
                    db,
                    None,
                    slices,
                    file_path,
                    f"GT_{gt_type}/LDE",
                    gt_version=gt_version,
                    seen_artifacts=seen_artifacts,
                )

        # Scan video directory
        video_dir = gt_path / "video"
        if video_dir.exists():
            for file_path in video_dir.iterdir():
                if file_path.is_dir():
                    continue
                self._create_artifact_for_slice(
                    db,
                    None,
                    slices,
                    file_path,
                    f"GT_{gt_type}/video",
                    gt_version=gt_version,
                    seen_artifacts=seen_artifacts,
                )

    def _create_artifact_for_slice(
        self,
        db: DBSession,
        pv: ProcessingVersion | None,
        slices: dict[str, Slice],
        file_path: Path,
        category: str,
        gt_version: GTVersion | None,
        seen_artifacts: set[tuple[str, int | None, str, str]] | None = None,
    ):
        """Create artifact by matching file name to slice."""
        file_name = file_path.name

        # Find matching slice
        matched_slice = None
        for slice_name, slice_obj in slices.items():
            if file_name.startswith(slice_name):
                matched_slice = slice_obj
                break

        if not matched_slice:
            return

        self._create_artifact(
            db, matched_slice, file_path, category, gt_version, seen_artifacts=seen_artifacts
        )

    def _create_artifact(
        self,
        db: DBSession,
        slice_obj: Slice,
        file_path: Path,
        category: str,
        gt_version: GTVersion | None,
        seen_artifacts: set[tuple[str, int | None, str, str]] | None = None,
    ):
        """Create artifact record."""
        file_name = file_path.name
        file_type = get_file_type(file_path)
        if seen_artifacts is not None:
            seen_artifacts.add((slice_obj.slice_name, gt_version.id if gt_version else None, category, file_name))

        # Check if artifact already exists
        existing = db.query(Artifact).filter(
            Artifact.slice_id == slice_obj.id,
            Artifact.gt_version_id == (gt_version.id if gt_version else None),
            Artifact.category == category,
            Artifact.file_name == file_name,
        ).first()

        if existing:
            return

        artifact = Artifact(
            slice_id=slice_obj.id,
            gt_version_id=gt_version.id if gt_version else None,
            category=category,
            file_name=file_name,
            file_path=str(file_path),
            file_type=file_type,
        )
        db.add(artifact)
        self.scan_status["artifacts_found"] += 1

    def _sync_processing_version(
        self,
        db: DBSession,
        pv: ProcessingVersion,
        seen_slices: set[str],
        seen_artifacts: set[tuple[str, int | None, str, str]],
        seen_gt_versions: set[int],
    ) -> dict:
        removed = {
            "slices_removed": 0,
            "artifacts_removed": 0,
            "gt_versions_removed": 0,
            "reviews_removed": 0,
        }

        existing_slices = db.query(Slice).filter(
            Slice.processing_version_id == pv.id
        ).all()
        slices_to_delete = [s for s in existing_slices if s.slice_name not in seen_slices]
        if slices_to_delete:
            slice_ids = [s.id for s in slices_to_delete]
            removed["reviews_removed"] += db.query(Review).filter(
                Review.slice_id.in_(slice_ids)
            ).delete(synchronize_session=False)
            removed["artifacts_removed"] += db.query(Artifact).filter(
                Artifact.slice_id.in_(slice_ids)
            ).delete(synchronize_session=False)
            removed["slices_removed"] += db.query(Slice).filter(
                Slice.id.in_(slice_ids)
            ).delete(synchronize_session=False)

        existing_gt_versions = db.query(GTVersion).filter(
            GTVersion.processing_version_id == pv.id
        ).all()
        gt_to_delete = [gt for gt in existing_gt_versions if gt.id not in seen_gt_versions]
        if gt_to_delete:
            gt_ids = [gt.id for gt in gt_to_delete]
            removed["reviews_removed"] += db.query(Review).filter(
                Review.gt_version_id.in_(gt_ids)
            ).delete(synchronize_session=False)
            removed["artifacts_removed"] += db.query(Artifact).filter(
                Artifact.gt_version_id.in_(gt_ids)
            ).delete(synchronize_session=False)
            removed["gt_versions_removed"] += db.query(GTVersion).filter(
                GTVersion.id.in_(gt_ids)
            ).delete(synchronize_session=False)

        existing_artifacts = db.query(Artifact).join(Slice).filter(
            Slice.processing_version_id == pv.id
        ).all()
        for artifact in existing_artifacts:
            key = (
                artifact.slice.slice_name,
                artifact.gt_version_id,
                artifact.category,
                artifact.file_name,
            )
            if key not in seen_artifacts:
                db.delete(artifact)
                removed["artifacts_removed"] += 1

        return removed

    def create_reviews_for_slices(self, db: DBSession, processing_version_id: int):
        """Create review records for all slices in a processing version."""
        slices = db.query(Slice).filter(
            Slice.processing_version_id == processing_version_id
        ).all()

        gt_versions = db.query(GTVersion).filter(
            GTVersion.processing_version_id == processing_version_id
        ).all()

        for slice_obj in slices:
            # Create preprocessing review
            existing = db.query(Review).filter(
                Review.slice_id == slice_obj.id,
                Review.gt_version_id == None,
            ).first()

            if not existing:
                db.add(Review(
                    slice_id=slice_obj.id,
                    gt_version_id=None,
                    result="unknown",
                ))

            # Create GT reviews for slices that have GT artifacts
            for gt in gt_versions:
                has_gt_artifact = db.query(Artifact).filter(
                    Artifact.slice_id == slice_obj.id,
                    Artifact.gt_version_id == gt.id,
                ).first()

                if has_gt_artifact:
                    existing_gt_review = db.query(Review).filter(
                        Review.slice_id == slice_obj.id,
                        Review.gt_version_id == gt.id,
                    ).first()

                    if not existing_gt_review:
                        db.add(Review(
                            slice_id=slice_obj.id,
                            gt_version_id=gt.id,
                            result="unknown",
                        ))

        db.commit()


# Singleton instance
scanner_service = ScannerService()
