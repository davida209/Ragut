from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.models import Exam, ExamAttempt, ExamType, ExamVisibility, Enrollment, EnrollmentStatus, UserRole
from app.services.doc_service import semantic_search
from app.services.query_service import generate_exam

router = APIRouter(prefix="/exams", tags=["exams"])


def exam_out(e, include_q=True):
    d = {"id": e.id, "title": e.title, "class_id": e.class_id, "created_by": e.created_by,
         "exam_type": e.exam_type, "visibility": e.visibility,
         "due_date": e.due_date.isoformat() if e.due_date else None,
         "created_at": e.created_at.isoformat(), "question_count": len(e.questions_json or [])}
    if include_q: d["questions"] = e.questions_json
    return d


class GenerateBody(BaseModel):
    class_id: str
    title: str
    exam_type: str = "practice"
    n_questions: int = 10
    document_ids: Optional[List[str]] = None
    visibility: str = "private"
    topic: Optional[str] = ""
    due_date: Optional[str] = None


class SubmitBody(BaseModel):
    answers: List[dict]


@router.post("/generate")
def generate(body: GenerateBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role == UserRole.student:
        ok = db.query(Enrollment).filter(Enrollment.student_id == u.id, Enrollment.class_id == body.class_id, Enrollment.status == EnrollmentStatus.active).first()
        if not ok: raise HTTPException(403, "No estás inscrito")

    chunks = semantic_search(db, body.topic or "conceptos principales temas importantes", body.class_id, u.id, u.role, body.document_ids, top_k=min(body.n_questions * 2, 20))
    if not chunks: raise HTTPException(422, "No hay suficiente contenido para generar el examen")

    try:
        result = generate_exam(chunks, body.n_questions, body.topic or "")
    except Exception as e:
        raise HTTPException(422, f"Error generando examen: {str(e)}")

    etype = ExamType[body.exam_type] if body.exam_type in ExamType.__members__ else ExamType.practice
    vis = ExamVisibility.public if body.visibility == "public" else ExamVisibility.private

    exam = Exam(class_id=body.class_id, created_by=u.id, title=body.title or result.get("title", "Examen"),
                exam_type=etype, visibility=vis, questions_json=result.get("questions", []),
                due_date=datetime.fromisoformat(body.due_date) if body.due_date else None)
    db.add(exam); db.commit(); db.refresh(exam)
    return exam_out(exam)


@router.get("")
def list_exams(class_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role in [UserRole.professor, UserRole.admin]:
        exams = db.query(Exam).filter(Exam.class_id == class_id).all()
    else:
        exams = db.query(Exam).filter(Exam.class_id == class_id,
            (Exam.visibility == ExamVisibility.public) | (Exam.created_by == u.id)).all()
    return [exam_out(e, False) for e in exams]


@router.get("/{exam_id}")
def get_exam(exam_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    e = db.query(Exam).filter(Exam.id == exam_id).first()
    if not e: raise HTTPException(404, "Examen no encontrado")
    if e.visibility == ExamVisibility.private and e.created_by != u.id and u.role not in [UserRole.admin, UserRole.professor]:
        raise HTTPException(403, "Sin acceso")
    qs = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in (e.questions_json or [])]
    return {**exam_out(e, False), "questions": qs}


@router.post("/{exam_id}/attempt")
def attempt(exam_id: str, body: SubmitBody, db: Session = Depends(get_db), u=Depends(get_current_user)):
    e = db.query(Exam).filter(Exam.id == exam_id).first()
    if not e: raise HTTPException(404)
    qs = e.questions_json or []
    correct = 0
    graded = []
    for q in qs:
        ans = next((a.get("answer") for a in body.answers if str(a.get("id")) == str(q["id"])), None)
        ok = ans == q.get("correct_answer")
        if ok: correct += 1
        graded.append({"id": q["id"], "question": q["question"], "user_answer": ans,
                       "correct_answer": q.get("correct_answer"), "is_correct": ok, "explanation": q.get("explanation", "")})
    score = correct / len(qs) if qs else 0
    db.add(ExamAttempt(exam_id=exam_id, student_id=u.id, answers_json=body.answers, score=score, completed_at=datetime.utcnow()))
    db.commit()
    return {"score": round(score * 100), "correct": correct, "total": len(qs), "graded": graded}


@router.get("/{exam_id}/results")
def results(exam_id: str, db: Session = Depends(get_db), u=Depends(get_current_user)):
    if u.role not in [UserRole.professor, UserRole.admin]: raise HTTPException(403)
    attempts = db.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all()
    return [{"student_id": a.student_id, "score": round((a.score or 0) * 100), "completed_at": a.completed_at.isoformat() if a.completed_at else None} for a in attempts]
