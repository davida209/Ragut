from openai import OpenAI
from app.core.config import settings
import json

cerebras = OpenAI(
    api_key=settings.CEREBRAS_API_KEY,
    base_url="https://api.cerebras.ai/v1"
)
MODEL = "llama3.1-70b"

FLASHCARD_PROMPT = """Eres un experto en técnicas de memorización educativa.
Basándote en el siguiente contenido, genera exactamente {n} flashcards de alta calidad.

CONTENIDO:
{context}

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{{
  "title": "título descriptivo del set de flashcards",
  "cards": [
    {{
      "front": "concepto, término o pregunta clara y concisa",
      "back": "definición, respuesta o explicación completa",
      "hint": "pista breve opcional para recordar (puede ser null)"
    }}
  ]
}}

Las flashcards deben cubrir los conceptos más importantes. El frente debe ser una pregunta o término, el reverso la respuesta completa.
"""

SUMMARY_PROMPT = """Eres un asistente académico experto en síntesis de contenido educativo.
Basándote en el siguiente contenido, genera un resumen estructurado completo.

CONTENIDO:
{context}

Responde ÚNICAMENTE con JSON válido, sin texto adicional:
{{
  "title": "título del resumen",
  "content": "resumen completo en markdown, con secciones, párrafos y listas donde corresponda. Mínimo 300 palabras.",
  "key_concepts": [
    {{
      "term": "término o concepto clave",
      "definition": "definición breve y precisa"
    }}
  ]
}}

Incluye entre 8 y 15 conceptos clave. El resumen debe ser pedagógico y claro.
"""


def generate_flashcards_from_chunks(chunks: list, n_cards: int = 15) -> dict:
    context = "\n\n".join([f"[{c['filename']}]\n{c['content']}" for c in chunks])[:8000]
    prompt = FLASHCARD_PROMPT.format(n=n_cards, context=context)
    response = cerebras.chat.completions.create(
        model=MODEL, max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    text = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)


def generate_summary_from_chunks(chunks: list) -> dict:
    context = "\n\n".join([f"[{c['filename']}]\n{c['content']}" for c in chunks])[:10000]
    prompt = SUMMARY_PROMPT.format(context=context)
    response = cerebras.chat.completions.create(
        model=MODEL, max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )
    text = response.choices[0].message.content.strip().replace("```json", "").replace("```", "").strip()
    return json.loads(text)


def stream_chat_response(question: str, chunks: list, history: list):
    """Generator that yields SSE-formatted chunks for streaming."""
    context = "\n\n".join([f"[Fuente: {c['filename']}]\n{c['content']}" for c in chunks])[:6000]
    messages = []
    for msg in history[-6:]:
        messages.append({"role": msg["role"], "content": msg["content"]})
    messages.append({"role": "user", "content": f"Contexto:\n{context}\n\nPregunta: {question}"})

    system = """Eres RagUT, asistente educativo de la Universidad Tecnológica de Cancún.
Responde basándote ÚNICAMENTE en los documentos del contexto. Sé claro, pedagógico y conciso.
Cuando cites información específica, menciona el documento fuente entre paréntesis.
Responde en español."""

    stream = cerebras.chat.completions.create(
        model=MODEL, max_tokens=1024, stream=True,
        messages=[{"role": "system", "content": system}] + messages
    )
    for chunk in stream:
        delta = chunk.choices[0].delta
        if delta.content:
            yield delta.content
