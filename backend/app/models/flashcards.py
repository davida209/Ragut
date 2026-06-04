from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Integer, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
import enum
from app.core.database import Base
from app.models.models import new_uuid


class FlashcardDifficulty(str, enum.Enum):
    again = "again"      # No lo supe
    hard = "hard"        # Difícil
    good = "good"        # Bien
    easy = "easy"        # Fácil


class FlashcardSet(Base):
    __tablename__ = "flashcard_sets"
    id = Column(String, primary_key=True, default=new_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    card_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    cards = relationship("Flashcard", back_populates="set_", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"
    id = Column(String, primary_key=True, default=new_uuid)
    set_id = Column(String, ForeignKey("flashcard_sets.id"), nullable=False)
    front = Column(Text, nullable=False)   # Pregunta / concepto
    back = Column(Text, nullable=False)    # Respuesta / definición
    hint = Column(Text, nullable=True)     # Pista opcional
    card_index = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    set_ = relationship("FlashcardSet", back_populates="cards")
    reviews = relationship("FlashcardReview", back_populates="card")


class FlashcardReview(Base):
    __tablename__ = "flashcard_reviews"
    id = Column(String, primary_key=True, default=new_uuid)
    card_id = Column(String, ForeignKey("flashcards.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    difficulty = Column(SAEnum(FlashcardDifficulty), nullable=False)
    reviewed_at = Column(DateTime, default=datetime.utcnow)
    card = relationship("Flashcard", back_populates="reviews")


class Summary(Base):
    __tablename__ = "summaries"
    id = Column(String, primary_key=True, default=new_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    key_concepts = Column(JSONB, default=list)   # [{"term": "...", "definition": "..."}]
    created_at = Column(DateTime, default=datetime.utcnow)


class StudyEvent(Base):
    """Tracks user study activity for the dashboard."""
    __tablename__ = "study_events"
    id = Column(String, primary_key=True, default=new_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=True)
    event_type = Column(String, nullable=False)  # chat, exam, flashcard, summary
    created_at = Column(DateTime, default=datetime.utcnow)
