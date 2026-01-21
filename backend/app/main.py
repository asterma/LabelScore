from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db, SessionLocal
from app.api.routes import auth, sessions, annotations, images, scan, export
from app.services.auth import create_default_admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()

    # Create default admin user
    db = SessionLocal()
    try:
        create_default_admin(
            db,
            settings.default_admin_username,
            settings.default_admin_password
        )
    finally:
        db.close()

    yield
    # Shutdown


app = FastAPI(
    title="LabelScore API",
    description="图像标注质量评估 API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(annotations.router, prefix="/api")
app.include_router(images.router, prefix="/api")
app.include_router(scan.router, prefix="/api")
app.include_router(export.router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
