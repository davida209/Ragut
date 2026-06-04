import uuid
from datetime import datetime
from sqlalchemy import Column, String, Boolean, DateTime, Float, Text, Integer, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy import event
import enum
from app.core.database import Base


def new_uuid():
    return str(uuid.uuid4())


class UserRole(str, enum.Enum):
    admin = "admin"
    professor = "professor"
    student = "student"


class EnrollmentStatus(str, enum.Enum):
    pending = "pending"
    active = "active"
    rejected = "rejected"


class DocumentStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    error = "error"


class DocumentVisibility(str, enum.Enum):
    class_wide = "class_wide"
    private = "private"


class OwnerType(str, enum.Enum):
    professor = "professor"
    student = "student"


class ExamType(str, enum.Enum):
    official = "official"
    practice = "practice"
    review = "review"


class ExamVisibility(str, enum.Enum):
    public = "public"
    private = "private"


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=new_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.student)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    enrollments = relationship("Enrollment", foreign_keys="Enrollment.student_id", back_populates="student")
    taught_classes = relationship("Class", back_populates="professor")
    documents = relationship("Document", back_populates="uploader")


class Class(Base):
    __tablename__ = "classes"
    id = Column(String, primary_key=True, default=new_uuid)
    professor_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, default="")
    access_code = Column(String(8), unique=True, nullable=False)
    require_approval = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    professor = relationship("User", back_populates="taught_classes")
    enrollments = relationship("Enrollment", back_populates="class_")
    documents = relationship("Document", back_populates="class_")
    exams = relationship("Exam", back_populates="class_")


class Enrollment(Base):
    __tablename__ = "enrollments"
    id = Column(String, primary_key=True, default=new_uuid)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    status = Column(SAEnum(EnrollmentStatus), default=EnrollmentStatus.pending)
    enrolled_at = Column(DateTime, default=datetime.utcnow)
    enrolled_by = Column(String, ForeignKey("users.id"), nullable=True)
    student = relationship("User", foreign_keys=[student_id], back_populates="enrollments")
    class_ = relationship("Class", back_populates="enrollments")


class Document(Base):
    __tablename__ = "documents"
    id = Column(String, primary_key=True, default=new_uuid)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    uploaded_by = Column(String, ForeignKey("users.id"), nullable=False)
    owner_type = Column(SAEnum(OwnerType), nullable=False)
    visibility = Column(SAEnum(DocumentVisibility), default=DocumentVisibility.class_wide)
    filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    status = Column(SAEnum(DocumentStatus), default=DocumentStatus.processing)
    page_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    class_ = relationship("Class", back_populates="documents")
    uploader = relationship("User", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")


class DocumentChunk(Base):
    """Stores text chunks with their embeddings in PostgreSQL via pgvector."""
    __tablename__ = "document_chunks"
    id = Column(String, primary_key=True, default=new_uuid)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    owner_type = Column(SAEnum(OwnerType), nullable=False)
    uploaded_by = Column(String, nullable=False)
    visibility = Column(SAEnum(DocumentVisibility), default=DocumentVisibility.class_wide)
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    # embedding stored as JSON array (pgvector via raw SQL for search)
    embedding_json = Column(JSONB, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    document = relationship("Document", back_populates="chunks")


class Exam(Base):
    __tablename__ = "exams"
    id = Column(String, primary_key=True, default=new_uuid)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    exam_type = Column(SAEnum(ExamType), nullable=False)
    visibility = Column(SAEnum(ExamVisibility), default=ExamVisibility.private)
    questions_json = Column(JSONB, default=list)
    due_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    class_ = relationship("Class", back_populates="exams")
    attempts = relationship("ExamAttempt", back_populates="exam")


class ExamAttempt(Base):
    __tablename__ = "exam_attempts"
    id = Column(String, primary_key=True, default=new_uuid)
    exam_id = Column(String, ForeignKey("exams.id"), nullable=False)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    answers_json = Column(JSONB, default=list)
    score = Column(Float, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    exam = relationship("Exam", back_populates="attempts")


class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, default=new_uuid)
    student_id = Column(String, ForeignKey("users.id"), nullable=False)
    class_id = Column(String, ForeignKey("classes.id"), nullable=False)
    title = Column(String, default="Nueva conversación")
    created_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("Message", back_populates="conversation")


class Message(Base):
    __tablename__ = "messages"
    id = Column(String, primary_key=True, default=new_uuid)
    conversation_id = Column(String, ForeignKey("conversations.id"), nullable=False)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    sources = Column(JSONB, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation = relationship("Conversation", back_populates="messages")
