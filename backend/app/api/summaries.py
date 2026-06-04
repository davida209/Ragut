from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.flashcards import Summary, StudyEvent
from app.models.models import Document, Enrollment, EnrollmentStatus, UserRole
from app.services.doc_service import semantic_search
from app.services.flashcard_service import generate_summary_from_chunks

router = APIRouter(prefix="/summaries", tags=["summaries"])


def summary_out(s: Summary, include_content=True):
    d = {"id": s.id, "title": s.title, "document_id": s.document_id,
         "class_id": s.class_id, "created_by": s.created_by,
         "key_concepts": s.key_concepts, "created_at": s.created_at.isoformat()}
    if include_content:
        d["content"] = s.content
    return d


class GenerateBody(BaseModel):
    document_id: str
    class_id: str


@router.post("/generate")
def generate(body: GenerateBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role == UserRole.student:
        ok = db.query(Enrollment).filter(
            Enrollment.student_id == u.id,
            Enrollment.class_id == body.class_id,
            Enrollment.status == EnrollmentStatus.active
        ).first()
        if not ok:
            raise HTTPException(403, "No estás inscrito en esta clase")

    doc = db.query(Document).filter(Document.id == body.document_id).first()
    if not doc:
        raise HTTPException(404, "Documento no encontrado")

    # Check if summary already exists for this doc/user
    existing = db.query(Summary).filter(
        Summary.document_id == body.document_id,
        Summary.created_by == u.id
    ).first()

    chunks = semantic_search(
        db, "resumen contenido principal ideas temas",
        body.class_id, u.id, u.role,
        document_ids=[body.document_id], top_k=25
    )
    if not chunks:
        raise HTTPException(422, "El documento no tiene contenido procesado aún")

    try:
        result = generate_summary_from_chunks(chunks)
    except Exception as e:
        raise HTTPException(422, f"Error generando resumen: {str(e)}")

    if existing:
        existing.title = result.get("title", existing.title)
        existing.content = result.get("content", "")
        existing.key_concepts = result.get("key_concepts", [])
        db.commit(); db.refresh(existing)
        return summary_out(existing)

    summary = Summary(
        document_id=body.document_id,
        class_id=body.class_id,
        created_by=u.id,
        title=result.get("title", f"Resumen — {doc.filename}"),
        content=result.get("content", ""),
        key_concepts=result.get("key_concepts", [])
    )
    db.add(summary)
    db.add(StudyEvent(user_id=u.id, class_id=body.class_id, event_type="summary"))
    db.commit(); db.refresh(summary)
    return summary_out(summary)


@router.get("")
def list_summaries(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    summaries = db.query(Summary).filter(
        Summary.class_id == class_id,
        Summary.created_by == u.id
    ).order_by(Summary.created_at.desc()).all()
    return [summary_out(s, include_content=False) for s in summaries]


@router.get("/{summary_id}")
def get_summary(summary_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    s = db.query(Summary).filter(Summary.id == summary_id, Summary.created_by == u.id).first()
    if not s:
        raise HTTPException(404, "Resumen no encontrado")
    return summary_out(s)


@router.delete("/{summary_id}")
def delete_summary(summary_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    s = db.query(Summary).filter(Summary.id == summary_id, Summary.created_by == u.id).first()
    if not s:
        raise HTTPException(404, "Resumen no encontrado")
    db.delete(s); db.commit()
    return {"message": "Resumen eliminado"}
