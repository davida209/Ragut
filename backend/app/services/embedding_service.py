import requests
import numpy as np
from typing import List
from app.core.config import settings

HF_API_URL = f"https://api-inference.huggingface.co/pipeline/feature-extraction/{settings.EMBEDDING_MODEL}"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 dimension


def get_embeddings(texts: List[str]) -> List[List[float]]:
    """Get embeddings from HuggingFace Inference API (free tier)."""
    headers = {"Content-Type": "application/json"}

    results = []
    batch_size = 32

    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        response = requests.post(
            HF_API_URL,
            headers=headers,
            json={"inputs": batch, "options": {"wait_for_model": True}},
            timeout=60
        )
        response.raise_for_status()
        data = response.json()

        # HuggingFace returns list of lists; handle sentence pooling
        if isinstance(data[0][0], list):
            # Mean pooling over tokens
            for token_embeddings in data:
                arr = np.array(token_embeddings)
                pooled = arr.mean(axis=0).tolist()
                results.append(pooled)
        else:
            results.extend(data)

    return results


def cosine_similarity(a: List[float], b: List[float]) -> float:
    a_arr = np.array(a)
    b_arr = np.array(b)
    return float(np.dot(a_arr, b_arr) / (np.linalg.norm(a_arr) * np.linalg.norm(b_arr) + 1e-10))
