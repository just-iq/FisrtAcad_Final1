import gc
import logging
import time
from functools import lru_cache
from typing import List

import numpy as np

from app.config import settings

logger = logging.getLogger(__name__)


class Encoder:
    def __init__(self, model_name: str):
        from sentence_transformers import SentenceTransformer  # deferred import

        logger.info(f"Loading model: {model_name}")
        start = time.time()

        self._model = SentenceTransformer(
            model_name,
            device="cpu",
        )
        # Keep everything on CPU and reclaim any temp allocations
        self._model = self._model.cpu()
        gc.collect()

        logger.info(f"Model loaded in {time.time() - start:.1f}s")

    def embed(self, text: str) -> np.ndarray:
        vec = self._model.encode([text], normalize_embeddings=True)[0]
        return np.asarray(vec, dtype=np.float32)

    def embed_many(self, texts: List[str]) -> np.ndarray:
        vecs = self._model.encode(texts, normalize_embeddings=True, batch_size=16)
        return np.asarray(vecs, dtype=np.float32)


@lru_cache(maxsize=1)
def get_encoder() -> Encoder:
    """
    Returns a singleton Encoder. The @lru_cache guarantees the model is
    loaded exactly once across the entire process lifetime.
    """
    return Encoder(settings.embedding_model)