from functools import lru_cache
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings


class Encoder:
    def __init__(self, model_name: str):
        self._model = SentenceTransformer(model_name)

    def embed(self, text: str) -> np.ndarray:
        vec = self._model.encode([text], normalize_embeddings=True)[0]
        return np.asarray(vec, dtype=np.float32)

    def embed_many(self, texts: List[str]) -> np.ndarray:
        vecs = self._model.encode(texts, normalize_embeddings=True)
        return np.asarray(vecs, dtype=np.float32)


@lru_cache(maxsize=1)
def get_encoder() -> Encoder:
    return Encoder(settings.embedding_model)

