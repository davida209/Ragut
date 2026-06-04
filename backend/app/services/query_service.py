from typing import List, Optional
from openai import OpenAI
from app.core.config import settings

# Cerebras Cloud uses OpenAI-compatible API
cerebras = OpenAI(
    api_key=settings.CEREBRAS_API_KEY,
    base_url="https://api.cerebras.ai/v1"
)

CEREBRAS_MODEL = "llama3.1-70b"

SYSTEM_PROMPT = """Eres RagUT, un asistente educativo inteligente de la Universidad Tecnológica de Cancún. Responde preguntas de estudiantes basándote ÚNICAMENTE en los documentos proporcionados en el contexto.

Reglas:
- Usa solo información del contexto dado.
- Si la respuesta no está en los documentos, dilo claramente.
- Sé conciso, claro y pedagógico.
- Indica el documento fuente cuando sea relevante.
- Responde en español a menos que el estudiante escriba en otro idioma.
- Sé amigable y motivador como buen tutor.
"""

EXAM_PROMPT = """Eres un generador de exámenes educativos profesional para la Universidad Tecnológica de Cancún.

Basándote en el siguiente contenido, genera exactamente {n} preguntas de opción múltiple.

CONTENIDO:
{context}

Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código:
{{
  "title": "título descriptivo del examen",
  "questions": [
    {{
      "id": 1,
      "question": "texto de la pregunta",
      "options": ["A. opción 1", "B. opción 2", "C. opción 3", "D. opción 4"],
      "correct_answer": "A",
      "explanation": "explicación breve de por qué es correcta"
    }}
  ]
}}
"""


def ask_question(
    question: str,
    chunks: List[dict],
    conversation_history: Optional[List[dict]] = None
) -> dict:
    if not chunks:
        return {
            "answer": "No encontré información relevante en los documentos disponibles para responder tu pregunta.",
            "sources": []
        }

    context = ""
    for chunk in chunks:
        context += f"\n[Fuente: {chunk['filename']}]\n{chunk['content']}\n"

    history = conversation_history or []
    messages = []
    for msg in history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    messages.append({
        "role": "user",
        "content": f"Contexto de los documentos:\n{context[:6000]}\n\nPregunta: {question}"
    })

    response = cerebras.chat.completions.create(
        model=CEREBRAS_MODEL,
        max_tokens=1024,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}] + messages
    )

    answer = response.choices[0].message.content
    sources = list({c["filename"] for c in chunks})
    return {"answer": answer, "sources": sources}


def generate_exam(chunks: List[dict], n_questions: int = 10, topic: str = "") -> dict:
    if not chunks:
        raise ValueError("No hay suficiente contenido para generar un examen.")

    context = ""
    for chunk in chunks:
        context += f"\n[{chunk['filename']}]\n{chunk['content']}\n"

    prompt = EXAM_PROMPT.format(n=n_questions, context=context[:8000])

    response = cerebras.chat.completions.create(
        model=CEREBRAS_MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    import json
    text = response.choices[0].message.content.strip()
    text = text.replace("```json", "").replace("```", "").strip()
    return json.loads(text)
