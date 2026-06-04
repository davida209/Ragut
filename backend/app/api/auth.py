from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.services.auth_service import *
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def user_out(u):
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role, "is_active": u.is_active, "created_at": u.created_at.isoformat()}


class RegisterBody(BaseModel):
    email: EmailStr
    full_name: str
    password: str


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


@router.post("/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    if get_user_by_email(db, body.email):
        raise HTTPException(400, "El email ya está registrado")
    user = create_user(db, body.email, body.full_name, body.password)
    return {"access_token": create_access_token({"sub": user.id}), "refresh_token": create_refresh_token({"sub": user.id}), "user": user_out(user)}


@router.post("/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = authenticate_user(db, body.email, body.password)
    if not user:
        raise HTTPException(401, "Credenciales incorrectas")
    return {"access_token": create_access_token({"sub": user.id}), "refresh_token": create_refresh_token({"sub": user.id}), "user": user_out(user)}


@router.post("/refresh")
def refresh(body: RefreshBody, db: Session = Depends(get_db)):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(401, "Refresh token inválido")
    user = get_user_by_id(db, payload.get("sub"))
    if not user: raise HTTPException(401, "Usuario no encontrado")
    return {"access_token": create_access_token({"sub": user.id})}


@router.get("/me")
def me(u=Depends(get_current_user)):
    return user_out(u)
