import os
import tempfile
import threading
import pdfplumber
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from supabase import create_client

from app.core.config import settings
from app.models.models import (
    Document, DocumentChunk, DocumentStatus, OwnerType, DocumentVisibility
)
from app.services.embedding_service import get_embeddings

supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)

CHUNK_SIZE = 400
CHUNK_OVERLAP = 60


def upload_pdf_to_storage(file_bytes: bytes, storage_path: str) -> str:
    supabase.storage.from_(settings.STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf"}
    )
    return storage_path


def extract_text(file_path: str) -> tuple[str, int]:
    text_out = ""
    pages = 0
    with pdfplumber.open(file_path) as pdf:
        pages = len(pdf.pages)
        for page in pdf.pages:
            text_out += (page.extract_text() or "") + "\n"
    return text_out, pages


def chunk_text(text: str) -> List[str]:
    words = text.split()
    chunks, i = [], 0
    while i < len(words):
        chunk = " ".join(words[i:i + CHUNK_SIZE])
        if len(chunk.strip()) > 80:
            chunks.append(chunk)
        i += CHUNK_SIZE - CHUNK_OVERLAP
    return chunks


def process_document(db: Session, document: Document, file_path: str):
    try:
        raw_text, pages = extract_text(file_path)
        chunks = chunk_text(raw_text)

        if not chunks:
            document.status = DocumentStatus.error
            db.commit()
            return

        embeddings = get_embeddings(chunks)

        for idx, (chunk_text_content, embedding) in enumerate(zip(chunks, embeddings)):
            chunk = DocumentChunk(
                document_id=document.id,
                class_id=document.class_id,
                owner_type=document.owner_type,
                uploaded_by=document.uploaded_by,
                visibility=document.visibility,
                content=chunk_text_content,
                chunk_index=idx,
                embedding_json=embedding
            )
            db.add(chunk)

        document.status = DocumentStatus.ready
        document.page_count = pages
        document.chunk_count = len(chunks)
        db.commit()

    except Exception as e:
        document.status = DocumentStatus.error
        db.commit()
        raise e
    finally:
        if os.path.exists(file_path):
            os.remove(file_path)


def semantic_search(
    db: Session,
    query: str,
    class_id: str,
    user_id: str,
    user_role: str,
    document_ids: Optional[List[str]] = None,
    top_k: int = 5
) -> List[dict]:
    from app.services.embedding_service import get_embeddings
    query_embedding = get_embeddings([query])[0]

    # Build filter conditions
    conditions = ["dc.class_id = :class_id"]
    params: dict = {"class_id": class_id, "top_k": top_k}

    if user_role in ("professor", "admin"):
        conditions.append("(dc.visibility = 'class_wide' OR dc.uploaded_by = :user_id)")
        params["user_id"] = user_id
    else:
        conditions.append("(dc.visibility = 'class_wide' OR dc.uploaded_by = :user_id)")
        params["user_id"] = user_id

    if document_ids:
        conditions.append("dc.document_id = ANY(:doc_ids)")
        params["doc_ids"] = document_ids

    where_clause = " AND ".join(conditions)

    # Cosine similarity via Python since pgvector operator may need custom setup
    sql = text(f"""
        SELECT dc.id, dc.content, dc.document_id, dc.embedding_json,
               d.filename
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE {where_clause}
        LIMIT 200
    """)

    rows = db.execute(sql, params).fetchall()

    import numpy as np
    scored = []
    q_arr = np.array(query_embedding)

    for row in rows:
        emb = row.embedding_json
        if not emb:
            continue
        e_arr = np.array(emb)
        sim = float(np.dot(q_arr, e_arr) / (np.linalg.norm(q_arr) * np.linalg.norm(e_arr) + 1e-10))
        scored.append({
            "content": row.content,
            "filename": row.filename,
            "document_id": row.document_id,
            "score": sim
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:top_k]
