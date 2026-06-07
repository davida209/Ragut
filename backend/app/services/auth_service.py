import bcrypt
from sqlalchemy.orm import Session
from typing import Optional
from app.models.models import User, UserRole

def hash_password(p: str) -> str:
    # Truncar a 72 bytes según límite de bcrypt
    pwd_bytes = p.encode('utf-8')[:72]
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain: str, hashed: str) -> bool:
    pwd_bytes = plain.encode('utf-8')[:72]
    return bcrypt.checkpw(pwd_bytes, hashed.encode('utf-8'))

def get_user_by_email(db: Session, email: str): 
    return db.query(User).filter(User.email == email).first()

def get_user_by_id(db: Session, uid: str): 
    return db.query(User).filter(User.id == uid).first()

def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user or not verify_password(password, user.hashed_password) or not user.is_active:
        return None
    return user

def create_user(db: Session, email: str, full_name: str, password: str, role: UserRole = UserRole.student) -> User:
    user = User(email=email, full_name=full_name, hashed_password=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user