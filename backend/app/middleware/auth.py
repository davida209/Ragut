from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.auth_service import decode_token, get_user_by_id
from app.models.models import User, UserRole

bearer = HTTPBearer()


def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer), db: Session = Depends(get_db)) -> User:
    payload = decode_token(creds.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    user = get_user_by_id(db, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    return user


def require_admin(u: User = Depends(get_current_user)) -> User:
    if u.role != UserRole.admin:
        raise HTTPException(status_code=403, detail="Se requiere rol de administrador")
    return u


def require_professor(u: User = Depends(get_current_user)) -> User:
    if u.role not in [UserRole.admin, UserRole.professor]:
        raise HTTPException(status_code=403, detail="Se requiere rol de profesor")
    return u
