import re
from typing import List, Optional

import numpy as np
import networkx as nx
from sklearn.feature_extraction.text import TfidfVectorizer


def _split_sentences(text: str) -> List[str]:
    # Simple sentence splitter adequate for academic announcements.
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    return [p.strip() for p in parts if p.strip()]


def _textrank_sentences(sentences: List[str], top_k: int = 4) -> List[str]:
    if len(sentences) <= top_k:
        return sentences

    vectorizer = TfidfVectorizer(stop_words="english")
    tfidf = vectorizer.fit_transform(sentences)
    sim = (tfidf * tfidf.T).toarray()
    np.fill_diagonal(sim, 0.0)

    graph = nx.from_numpy_array(sim)
    scores = nx.pagerank(graph, weight="weight")

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:top_k]
    idxs = sorted([i for i, _ in ranked])  # keep original order
    return [sentences[i] for i in idxs]


def summarize_if_needed(body: str, word_threshold: int = 60, top_k: int = 4) -> Optional[str]:
    words = body.split()
    if len(words) <= word_threshold:
        return None
    sents = _split_sentences(body)
    if not sents:
        return None
    summary_sents = _textrank_sentences(sents, top_k=top_k)
    return " ".join(summary_sents)

