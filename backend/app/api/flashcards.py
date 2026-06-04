from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.flashcards import FlashcardSet, Flashcard, FlashcardReview, FlashcardDifficulty, StudyEvent
from app.models.models import Document, Enrollment, EnrollmentStatus, UserRole
from app.services.doc_service import semantic_search
from app.services.flashcard_service import generate_flashcards_from_chunks

router = APIRouter(prefix="/flashcards", tags=["flashcards"])


def set_out(s: FlashcardSet):
    return {"id": s.id, "title": s.title, "document_id": s.document_id,
            "class_id": s.class_id, "created_by": s.created_by,
            "card_count": s.card_count, "created_at": s.created_at.isoformat()}


def card_out(c: Flashcard):
    return {"id": c.id, "set_id": c.set_id, "front": c.front,
            "back": c.back, "hint": c.hint, "card_index": c.card_index}


class GenerateBody(BaseModel):
    document_id: str
    class_id: str
    n_cards: int = 15


class ReviewBody(BaseModel):
    card_id: str
    difficulty: str  # again | hard | good | easy


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

    chunks = semantic_search(
        db, "conceptos principales definiciones términos importantes",
        body.class_id, u.id, u.role,
        document_ids=[body.document_id], top_k=20
    )
    if not chunks:
        raise HTTPException(422, "El documento no tiene contenido procesado aún")

    try:
        result = generate_flashcards_from_chunks(chunks, body.n_cards)
    except Exception as e:
        raise HTTPException(422, f"Error generando flashcards: {str(e)}")

    card_list = result.get("cards", [])
    fset = FlashcardSet(
        document_id=body.document_id,
        class_id=body.class_id,
        created_by=u.id,
        title=result.get("title", f"Flashcards — {doc.filename}"),
        card_count=len(card_list)
    )
    db.add(fset); db.flush()

    for i, c in enumerate(card_list):
        db.add(Flashcard(
            set_id=fset.id,
            front=c.get("front", ""),
            back=c.get("back", ""),
            hint=c.get("hint"),
            card_index=i
        ))

    db.add(StudyEvent(user_id=u.id, class_id=body.class_id, event_type="flashcard"))
    db.commit(); db.refresh(fset)
    return set_out(fset)


@router.get("")
def list_sets(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    sets = db.query(FlashcardSet).filter(
        FlashcardSet.class_id == class_id,
        FlashcardSet.created_by == u.id
    ).order_by(FlashcardSet.created_at.desc()).all()
    return [set_out(s) for s in sets]


@router.get("/{set_id}/cards")
def get_cards(set_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    fset = db.query(FlashcardSet).filter(FlashcardSet.id == set_id, FlashcardSet.created_by == u.id).first()
    if not fset:
        raise HTTPException(404, "Set no encontrado")
    cards = db.query(Flashcard).filter(Flashcard.set_id == set_id).order_by(Flashcard.card_index).all()
    return {"set": set_out(fset), "cards": [card_out(c) for c in cards]}


@router.post("/review")
def review_card(body: ReviewBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    card = db.query(Flashcard).filter(Flashcard.id == body.card_id).first()
    if not card:
        raise HTTPException(404, "Tarjeta no encontrada")
    try:
        diff = FlashcardDifficulty[body.difficulty]
    except KeyError:
        raise HTTPException(400, "Dificultad inválida")
    db.add(FlashcardReview(card_id=body.card_id, user_id=u.id, difficulty=diff))
    db.commit()
    return {"message": "Revisión registrada"}


@router.delete("/{set_id}")
def delete_set(set_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    fset = db.query(FlashcardSet).filter(FlashcardSet.id == set_id, FlashcardSet.created_by == u.id).first()
    if not fset:
        raise HTTPException(404, "Set no encontrado")
    db.delete(fset); db.commit()
    return {"message": "Set eliminado"}
