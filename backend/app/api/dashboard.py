from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from datetime import datetime, timedelta
from app.core.database import get_db
from app.middleware.auth import get_current_user
from app.models.flashcards import StudyEvent, FlashcardReview, FlashcardDifficulty
from app.models.models import Document, Message, Conversation, ExamAttempt, Enrollment, EnrollmentStatus

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats")
def get_stats(db: Session = Depends(get_db), u=Depends(get_current_user)):
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    # Documents uploaded by user
    docs_total = db.query(Document).filter(Document.uploaded_by == u.id).count()

    # Total questions asked (messages where role=user in conversations owned by user)
    questions_total = db.query(Message).join(
        Conversation, Message.conversation_id == Conversation.id
    ).filter(
        Conversation.student_id == u.id,
        Message.role == "user"
    ).count()

    questions_week = db.query(Message).join(
        Conversation, Message.conversation_id == Conversation.id
    ).filter(
        Conversation.student_id == u.id,
        Message.role == "user",
        Message.created_at >= week_ago
    ).count()

    # Exams completed
    exams_completed = db.query(ExamAttempt).filter(
        ExamAttempt.student_id == u.id,
        ExamAttempt.completed_at.isnot(None)
    ).count()

    avg_score_row = db.query(func.avg(ExamAttempt.score)).filter(
        ExamAttempt.student_id == u.id,
        ExamAttempt.completed_at.isnot(None)
    ).scalar()
    avg_score = round((avg_score_row or 0) * 100)

    # Flashcard reviews
    flashcard_reviews = db.query(FlashcardReview).filter(
        FlashcardReview.user_id == u.id
    ).count()

    flashcard_reviews_week = db.query(FlashcardReview).filter(
        FlashcardReview.user_id == u.id,
        FlashcardReview.reviewed_at >= week_ago
    ).count()

    # Study streak — count consecutive days with any StudyEvent
    events = db.query(
        func.date(StudyEvent.created_at).label("day")
    ).filter(
        StudyEvent.user_id == u.id
    ).distinct().order_by(text("day DESC")).all()

    streak = 0
    check_date = now.date()
    for row in events:
        if row.day == check_date or row.day == check_date - timedelta(days=1):
            streak += 1
            check_date = row.day - timedelta(days=1)
        else:
            break

    # Activity by day (last 14 days)
    daily_activity = []
    for i in range(13, -1, -1):
        day = (now - timedelta(days=i)).date()
        count = db.query(StudyEvent).filter(
            StudyEvent.user_id == u.id,
            func.date(StudyEvent.created_at) == day
        ).count()
        daily_activity.append({"date": day.isoformat(), "count": count})

    # Classes enrolled
    classes_count = db.query(Enrollment).filter(
        Enrollment.student_id == u.id,
        Enrollment.status == EnrollmentStatus.active
    ).count()

    return {
        "docs_total": docs_total,
        "questions_total": questions_total,
        "questions_week": questions_week,
        "exams_completed": exams_completed,
        "avg_score": avg_score,
        "flashcard_reviews": flashcard_reviews,
        "flashcard_reviews_week": flashcard_reviews_week,
        "study_streak": streak,
        "daily_activity": daily_activity,
        "classes_count": classes_count
    }
