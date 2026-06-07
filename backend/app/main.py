from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import Base, engine
from app.models import models
from app.models import flashcards as fc_models
from app.api import auth, classes, documents, query, exams, admin, flashcards, summaries, dashboard

Base.metadata.create_all(bind=engine)

app = FastAPI(title="RagUT API", version="2.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ragut.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in [auth.router, classes.router, documents.router, query.router,
          exams.router, admin.router, flashcards.router, summaries.router, dashboard.router]:
    app.include_router(r)


@app.get("/health")
def health():
    return {"status": "ok", "project": "RagUT", "version": "2.0.0"}


@app.on_event("startup")
def startup():
    from app.core.database import SessionLocal
    from app.services.auth_service import get_user_by_email, create_user
    from app.models.models import UserRole
    db = SessionLocal()
    try:
        if not get_user_by_email(db, settings.FIRST_ADMIN_EMAIL):
            create_user(db, settings.FIRST_ADMIN_EMAIL, "Administrador",
                        settings.FIRST_ADMIN_PASSWORD, UserRole.admin)
            print(f"[RagUT] Admin creado: {settings.FIRST_ADMIN_EMAIL}")
    finally:
        db.close()
