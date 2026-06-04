import os, tempfile, threading
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Document, DocumentChunk, Enrollment, EnrollmentStatus, OwnerType, DocumentVisibility, DocumentStatus, UserRole, Class
from app.services.doc_service import process_document, upload_pdf_to_storage

router = APIRouter(prefix="/documents", tags=["documents"])


def doc_out(d):
    return {"id": d.id, "filename": d.filename, "class_id": d.class_id, "uploaded_by": d.uploaded_by,
            "owner_type": d.owner_type, "visibility": d.visibility, "status": d.status,
            "page_count": d.page_count, "chunk_count": d.chunk_count, "created_at": d.created_at.isoformat()}


def can_access(db, user, class_id):
    if user.role == UserRole.admin: return True
    c = db.query(Class).filter(Class.id == class_id).first()
    if user.role == UserRole.professor and c and c.professor_id == user.id: return True
    return db.query(Enrollment).filter(Enrollment.student_id == user.id, Enrollment.class_id == class_id, Enrollment.status == EnrollmentStatus.active).first() is not None


@router.post("/upload")
def upload(class_id: str = Form(...), visibility: str = Form("class_wide"),
           file: UploadFile = File(...), db: Session = Depends(get_db), u=Depends(get_current_user)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se permiten archivos PDF")
    if not can_access(db, u, class_id):
        raise HTTPException(403, "Sin acceso a esta clase")

    is_prof = u.role in [UserRole.professor, UserRole.admin]
    owner_type = OwnerType.professor if is_prof else OwnerType.student
    vis = DocumentVisibility.class_wide if is_prof else DocumentVisibility[visibility]
    storage_path = f"{class_id}/{u.id}/{file.filename}"

    file_bytes = file.file.read()

    # Upload to Supabase Storage
    try:
        upload_pdf_to_storage(file_bytes, storage_path)
    except Exception:
        pass  # Continue even if storage fails, we still process

    doc = Document(class_id=class_id, uploaded_by=u.id, owner_type=owner_type,
                   visibility=vis, filename=file.filename, storage_path=storage_path,
                   status=DocumentStatus.processing)
    db.add(doc); db.commit(); db.refresh(doc)

    # Save temp file for processing
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    tmp.write(file_bytes); tmp.close()

    def bg():
        from app.core.database import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_doc = bg_db.query(Document).filter(Document.id == doc.id).first()
            process_document(bg_db, bg_doc, tmp.name)
        finally:
            bg_db.close()

    threading.Thread(target=bg).start()
    return doc_out(doc)


@router.get("")
def list_docs(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if not can_access(db, u, class_id): raise HTTPException(403, "Sin acceso")
    q = db.query(Document).filter(Document.class_id == class_id)
    if u.role not in [UserRole.professor, UserRole.admin]:
        q = q.filter((Document.visibility == DocumentVisibility.class_wide) | (Document.uploaded_by == u.id))
    return [doc_out(d) for d in q.all()]


@router.delete("/{doc_id}")
def delete_doc(doc_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc: raise HTTPException(404, "Documento no encontrado")
    if doc.uploaded_by != u.id and u.role not in [UserRole.admin, UserRole.professor]:
        raise HTTPException(403, "Sin permisos")
    db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).delete()
    db.delete(doc); db.commit()
    return {"message": "Documento eliminado"}
