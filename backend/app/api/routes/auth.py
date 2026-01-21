from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import create_access_token
from app.schemas.auth import LoginRequest, LoginResponse, RegisterRequest, UserInfo
from app.services.auth import authenticate_user, create_user, get_user_by_username
from app.api.deps import get_current_user
from app.models.user import User


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """User login endpoint."""
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return LoginResponse(
        access_token=access_token,
        user=UserInfo.model_validate(user),
    )


@router.post("/register", response_model=UserInfo)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new user."""
    existing = get_user_by_username(db, request.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered",
        )

    user = create_user(
        db,
        username=request.username,
        password=request.password,
        display_name=request.display_name,
    )
    return UserInfo.model_validate(user)


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    """Get current user info."""
    return UserInfo.model_validate(current_user)
