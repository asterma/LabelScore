from sqlalchemy.orm import Session

from app.models.user import User
from app.core.security import verify_password, get_password_hash


def get_user_by_username(db: Session, username: str) -> User | None:
    """Get user by username."""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Authenticate user with username and password."""
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def create_user(
    db: Session,
    username: str,
    password: str,
    display_name: str | None = None,
) -> User:
    """Create a new user."""
    user = User(
        username=username,
        password_hash=get_password_hash(password),
        display_name=display_name or username,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_default_admin(db: Session, username: str, password: str) -> User | None:
    """Create default admin user if not exists."""
    existing = get_user_by_username(db, username)
    if existing:
        return None
    return create_user(db, username, password, "Admin")
