from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import Optional
from app.core.database import get_db
from app.middleware.auth import require_admin
from app.models.models import User, Class, Enrollment, EnrollmentStatus, UserRole
from app.services.auth_service import create_user, hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


def u_out(u): return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat()}


class CreateUserBody(BaseModel):
    email: EmailStr; full_name: str; password: str; role: str = "student"


class UpdateUserBody(BaseModel):
    full_name: Optional[str] = None; role: Optional[str] = None; is_active: Optional[bool] = None; password: Optional[str] = None


@router.get("/stats")
def stats(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return {"total_users": db.query(User).count(), "active_classes": db.query(Class).filter(Class.is_active == True).count(),
            "pending_enrollments": db.query(Enrollment).filter(Enrollment.status == EnrollmentStatus.pending).count(),
            "professors": db.query(User).filter(User.role == UserRole.professor).count(),
            "students": db.query(User).filter(User.role == UserRole.student).count()}


@router.get("/users")
def list_users(db: Session = Depends(get_db), admin=Depends(require_admin)):
    return [u_out(u) for u in db.query(User).order_by(User.created_at.desc()).all()]


@router.post("/users")
def create(body: CreateUserBody, db: Session = Depends(get_db), admin=Depends(require_admin)):
    from app.services.auth_service import get_user_by_email
    if get_user_by_email(db, body.email): raise HTTPException(400, "Email ya registrado")
    role = UserRole[body.role] if body.role in UserRole.__members__ else UserRole.student
    return u_out(create_user(db, body.email, body.full_name, body.password, role))


@router.put("/users/{uid}")
def update(uid: str, body: UpdateUserBody, db: Session = Depends(get_db), admin=Depends(require_admin)):
    u = db.query(User).filter(User.id == uid).first()
    if not u: raise HTTPException(404)
    if body.full_name: u.full_name = body.full_name
    if body.role: u.role = UserRole[body.role]
    if body.is_active is not None: u.is_active = body.is_active
    if body.password: u.hashed_password = hash_password(body.password)
    db.commit(); return u_out(u)
