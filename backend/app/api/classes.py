import random, string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.middleware.auth import get_current_user, require_professor
from app.models.models import Class, Enrollment, EnrollmentStatus, User, UserRole

router = APIRouter(prefix="/classes", tags=["classes"])


def gen_code():
    while True:
        return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def cls_out(c, count=0):
    return {"id": c.id, "name": c.name, "description": c.description, "access_code": c.access_code,
            "require_approval": c.require_approval, "professor_id": c.professor_id,
            "professor_name": c.professor.full_name if c.professor else "", "is_active": c.is_active,
            "created_at": c.created_at.isoformat(), "enrollment_count": count}


class CreateClass(BaseModel):
    name: str
    description: Optional[str] = ""
    require_approval: bool = False


class EnrollBody(BaseModel):
    access_code: Optional[str] = None
    class_id: Optional[str] = None


@router.post("")
def create_class(body: CreateClass, db: Session = Depends(get_db), u=Depends(require_professor)):
    code = gen_code()
    while db.query(Class).filter(Class.access_code == code).first():
        code = gen_code()
    c = Class(professor_id=u.id, name=body.name, description=body.description, access_code=code, require_approval=body.require_approval)
    db.add(c); db.commit(); db.refresh(c)
    return cls_out(c)


@router.get("")
def list_classes(db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role == UserRole.admin:
        classes = db.query(Class).filter(Class.is_active == True).all()
    elif u.role == UserRole.professor:
        classes = db.query(Class).filter(Class.professor_id == u.id, Class.is_active == True).all()
    else:
        ids = [e.class_id for e in db.query(Enrollment).filter(Enrollment.student_id == u.id, Enrollment.status == EnrollmentStatus.active).all()]
        classes = db.query(Class).filter(Class.id.in_(ids), Class.is_active == True).all()
    return [cls_out(c, db.query(Enrollment).filter(Enrollment.class_id == c.id, Enrollment.status == EnrollmentStatus.active).count()) for c in classes]


@router.get("/{class_id}")
def get_class(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    c = db.query(Class).filter(Class.id == class_id).first()
    if not c: raise HTTPException(404, "Clase no encontrada")
    count = db.query(Enrollment).filter(Enrollment.class_id == class_id, Enrollment.status == EnrollmentStatus.active).count()
    return cls_out(c, count)


@router.post("/enroll")
def enroll(body: EnrollBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role != UserRole.student: raise HTTPException(400, "Solo los alumnos pueden inscribirse")
    if body.access_code:
        c = db.query(Class).filter(Class.access_code == body.access_code.upper(), Class.is_active == True).first()
    elif body.class_id:
        c = db.query(Class).filter(Class.id == body.class_id, Class.is_active == True).first()
    else: raise HTTPException(400, "Proporciona código o ID")
    if not c: raise HTTPException(404, "Clase no encontrada")
    existing = db.query(Enrollment).filter(Enrollment.student_id == u.id, Enrollment.class_id == c.id).first()
    if existing:
        if existing.status == EnrollmentStatus.active: raise HTTPException(400, "Ya estás inscrito")
        if existing.status == EnrollmentStatus.pending: raise HTTPException(400, "Solicitud ya enviada")
        existing.status = EnrollmentStatus.pending; db.commit()
        return {"status": "pending", "class_name": c.name}
    status = EnrollmentStatus.pending if c.require_approval else EnrollmentStatus.active
    db.add(Enrollment(student_id=u.id, class_id=c.id, status=status)); db.commit()
    return {"status": status, "class_name": c.name}


@router.get("/{class_id}/members")
def members(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    enrs = db.query(Enrollment).filter(Enrollment.class_id == class_id).all()
    return [{"enrollment_id": e.id, "student_id": e.student_id, "student_name": e.student.full_name,
             "student_email": e.student.email, "status": e.status, "enrolled_at": e.enrolled_at.isoformat()} for e in enrs]


@router.post("/{class_id}/members")
def add_member(class_id: str, body: dict, db: Session = Depends(get_db), u=Depends(require_professor)):
    student = db.query(User).filter(User.email == body.get("email")).first()
    if not student: raise HTTPException(404, "Usuario no encontrado")
    existing = db.query(Enrollment).filter(Enrollment.student_id == student.id, Enrollment.class_id == class_id).first()
    if existing: existing.status = EnrollmentStatus.active; existing.enrolled_by = u.id
    else: db.add(Enrollment(student_id=student.id, class_id=class_id, status=EnrollmentStatus.active, enrolled_by=u.id))
    db.commit(); return {"message": "Alumno agregado"}


@router.put("/{class_id}/members/{eid}")
def review(class_id: str, eid: str, body: dict, db: Session = Depends(get_db), u=Depends(require_professor)):
    e = db.query(Enrollment).filter(Enrollment.id == eid, Enrollment.class_id == class_id).first()
    if not e: raise HTTPException(404, "Inscripción no encontrada")
    e.status = EnrollmentStatus.active if body.get("action") == "approve" else EnrollmentStatus.rejected
    if body.get("action") == "approve": e.enrolled_by = u.id
    db.commit(); return {"status": e.status}


@router.delete("/{class_id}/members/{student_id}")
def remove_member(class_id: str, student_id: str, db: Session = Depends(get_db), u=Depends(require_professor)):
    e = db.query(Enrollment).filter(Enrollment.student_id == student_id, Enrollment.class_id == class_id).first()
    if e: db.delete(e); db.commit()
    return {"message": "Alumno removido"}
