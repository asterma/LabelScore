#!/usr/bin/env python3
import argparse
import sys
from pathlib import Path
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.config import settings  # noqa: E402
from app.core.database import Base  # noqa: E402
from app.models.session import Session as SessionV1  # noqa: E402
from app.models.annotation import Annotation as AnnotationV1  # noqa: E402
from app.models.session_v2 import SessionV2  # noqa: E402
from app.models.slice import Slice  # noqa: E402
from app.models.processing_version import ProcessingVersion  # noqa: E402
from app.models.artifact import Artifact  # noqa: E402
from app.models.slice_review import SliceReview  # noqa: E402


def derive_slice_name(file_name: str) -> str:
    if file_name.endswith("_driving_line.jpg"):
        return file_name[: -len("_driving_line.jpg")]
    return Path(file_name).stem


def build_raw_root(session: SessionV1) -> str:
    root = Path(settings.images_root_dir)
    return str(root / session.license_plate / f"{session.year:04d}" / f"{session.month:02d}" / f"{session.day:02d}" / session.session_id)


def build_processed_root(session: SessionV1) -> str:
    root = Path(settings.images_root_dir)
    return str(root / session.base_path)


def map_review(annotation: AnnotationV1):
    if annotation.is_undecidable:
        return "error"
    if annotation.score is None:
        return "unknown"
    if annotation.score >= 4:
        return "good"
    if annotation.score <= 2:
        return "bad"
    return "unknown"


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrate v1 sessions/annotations to v2 schema.")
    parser.add_argument("--drop-old", action="store_true", help="Drop old v1 tables after migration.")
    args = parser.parse_args()

    engine = create_engine(settings.database_url, future=True)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    db = SessionLocal()
    try:
        sessions_v1 = db.query(SessionV1).all()
        for s in sessions_v1:
            session_v2 = db.query(SessionV2).filter(
                SessionV2.license_plate == s.license_plate,
                SessionV2.date == date(s.year, s.month, s.day),
                SessionV2.session_id == s.session_id,
            ).first()
            if not session_v2:
                session_v2 = SessionV2(
                    license_plate=s.license_plate,
                    date=date(s.year, s.month, s.day),
                    session_id=s.session_id,
                    raw_root_path=build_raw_root(s),
                )
                db.add(session_v2)
                db.flush()

            version = db.query(ProcessingVersion).filter(
                ProcessingVersion.session_id == session_v2.id,
                ProcessingVersion.software_version == s.software_version,
            ).first()
            if not version:
                version = ProcessingVersion(
                    session_id=session_v2.id,
                    software_version=s.software_version,
                    processed_root_path=build_processed_root(s),
                )
                db.add(version)
                db.flush()

            annotations = db.query(AnnotationV1).filter(AnnotationV1.session_id == s.id).all()
            for ann in annotations:
                slice_name = derive_slice_name(ann.file_name)
                slice_obj = db.query(Slice).filter(
                    Slice.session_id == session_v2.id,
                    Slice.slice_name == slice_name,
                ).first()
                if not slice_obj:
                    slice_obj = Slice(
                        session_id=session_v2.id,
                        slice_name=slice_name,
                        slice_path=str(Path(session_v2.raw_root_path) / "MT_ROOFTOPBOX" / f"{slice_name}.mf4"),
                    )
                    db.add(slice_obj)
                    db.flush()

                suffix = ann.file_name[len(slice_name):]
                file_path = str(Path(settings.images_root_dir) / ann.file_path)
                artifact = db.query(Artifact).filter(
                    Artifact.processing_version_id == version.id,
                    Artifact.slice_id == slice_obj.id,
                    Artifact.file_suffix == suffix,
                ).first()
                if not artifact:
                    artifact = Artifact(
                        processing_version_id=version.id,
                        slice_id=slice_obj.id,
                        kind="image",
                        file_suffix=suffix,
                        file_path=file_path,
                    )
                    db.add(artifact)

                review = db.query(SliceReview).filter(
                    SliceReview.processing_version_id == version.id,
                    SliceReview.slice_id == slice_obj.id,
                ).first()
                if not review:
                    review = SliceReview(
                        processing_version_id=version.id,
                        slice_id=slice_obj.id,
                        result=map_review(ann),
                        comment=f"score={ann.score}, difficulty={ann.difficulty}, undecidable={ann.is_undecidable}",
                        reviewed_by=ann.annotated_by,
                        reviewed_at=ann.annotated_at,
                    )
                    db.add(review)

        db.commit()

        if args.drop_old:
            with engine.begin() as conn:
                conn.execute(text("DROP TABLE IF EXISTS annotations"))
                conn.execute(text("DROP TABLE IF EXISTS sessions"))
            print("Dropped old v1 tables: annotations, sessions")

        print("Migration completed")
        return 0
    except Exception as exc:
        db.rollback()
        print(f"Migration failed: {exc}")
        return 1
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
