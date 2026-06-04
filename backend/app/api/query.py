from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import json

from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Conversation, Message, Enrollment, EnrollmentStatus, UserRole
from app.models.flashcards import StudyEvent
from app.services.doc_service import semantic_search
from app.services.query_service import ask_question
from app.services.flashcard_service import stream_chat_response

router = APIRouter(prefix="/query", tags=["query"])


class AskBody(BaseModel):
    question: str
    class_id: str
    document_ids: Optional[List[str]] = None
    conversation_id: Optional[str] = None
    stream: bool = False


@router.post("/ask")
def ask(body: AskBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role == UserRole.student:
        ok = db.query(Enrollment).filter(
            Enrollment.student_id == u.id,
            Enrollment.class_id == body.class_id,
            Enrollment.status == EnrollmentStatus.active
        ).first()
        if not ok:
            raise HTTPException(403, "No estás inscrito en esta clase")

    chunks = semantic_search(db, body.question, body.class_id, u.id, u.role, body.document_ids, top_k=5)

    history = []
    conv = None
    if body.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == body.conversation_id).first()
        if conv:
            msgs = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at).all()
            history = [{"role": m.role, "content": m.content} for m in msgs[-6:]]

    if not conv:
        conv = Conversation(student_id=u.id, class_id=body.class_id, title=body.question[:60])
        db.add(conv); db.commit(); db.refresh(conv)

    db.add(StudyEvent(user_id=u.id, class_id=body.class_id, event_type="chat"))
    db.add(Message(conversation_id=conv.id, role="user", content=body.question))
    db.commit()

    if body.stream:
        sources = list({c["filename"] for c in chunks}) if chunks else []

        def event_stream():
            full_answer = ""
            yield f"data: {json.dumps({'type': 'meta', 'conversation_id': conv.id, 'sources': sources})}\n\n"
            for token in stream_chat_response(body.question, chunks, history):
                full_answer += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"
            from app.core.database import SessionLocal
            bg_db = SessionLocal()
            try:
                bg_db.add(Message(conversation_id=conv.id, role="assistant", content=full_answer, sources=sources))
                bg_db.commit()
            finally:
                bg_db.close()
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return StreamingResponse(event_stream(), media_type="text/event-stream",
                                 headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})

    result = ask_question(body.question, chunks, history)
    db.add(Message(conversation_id=conv.id, role="assistant", content=result["answer"], sources=result["sources"]))
    db.commit()
    return {"answer": result["answer"], "sources": result["sources"], "conversation_id": conv.id}


@router.get("/conversations")
def list_convs(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    convs = db.query(Conversation).filter(
        Conversation.student_id == u.id,
        Conversation.class_id == class_id
    ).order_by(Conversation.created_at.desc()).limit(20).all()
    return [{"id": c.id, "title": c.title, "created_at": c.created_at.isoformat()} for c in convs]


@router.get("/conversations/{conv_id}/messages")
def get_msgs(conv_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    conv = db.query(Conversation).filter(Conversation.id == conv_id, Conversation.student_id == u.id).first()
    if not conv:
        raise HTTPException(404, "Conversacion no encontrada")
    msgs = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at).all()
    return [{"id": m.id, "role": m.role, "content": m.content, "sources": m.sources,
             "created_at": m.created_at.isoformat()} for m in msgs]
