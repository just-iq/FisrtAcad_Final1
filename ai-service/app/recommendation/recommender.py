from typing import Dict, List, Tuple

import numpy as np
from scipy.sparse import coo_matrix
from sklearn.decomposition import TruncatedSVD

from app.db import get_conn
from app.embeddings.encoder import get_encoder


def _fetch_resources() -> Tuple[List[str], List[str]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id::text, COALESCE(title,'') || ' ' || COALESCE(description,'') AS text FROM resources;")
            rows = cur.fetchall()
    ids = [r[0] for r in rows]
    texts = [r[1] for r in rows]
    return ids, texts


def _fetch_interactions() -> List[Tuple[str, str, float]]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT user_id::text, resource_id::text, COALESCE(weight, 1.0)::float
                FROM user_resource_interactions
                ORDER BY viewed_at DESC
                LIMIT 50000;
                """
            )
            rows = cur.fetchall()
    return [(r[0], r[1], float(r[2])) for r in rows]


def _content_based_scores(student_id: str, resource_ids: List[str], resource_texts: List[str]) -> np.ndarray:
    encoder = get_encoder()
    if not resource_ids:
        return np.array([], dtype=np.float32)

    # Profile: average embeddings of resources the student interacted with.
    interactions = _fetch_interactions()
    seen = [rid for uid, rid, _w in interactions if uid == student_id]
    seen_set = set(seen)

    # If no history, return zeros; caller can fall back to popularity.
    if not seen:
        return np.zeros(len(resource_ids), dtype=np.float32)

    id_to_idx = {rid: i for i, rid in enumerate(resource_ids)}
    seen_idxs = [id_to_idx[rid] for rid in seen if rid in id_to_idx]
    if not seen_idxs:
        return np.zeros(len(resource_ids), dtype=np.float32)

    # Embed all resources once; for small datasets this is OK. Can be cached later.
    vecs = encoder.embed_many(resource_texts)
    profile = vecs[seen_idxs].mean(axis=0)
    scores = vecs @ profile

    # Don’t recommend already-seen items.
    for i, rid in enumerate(resource_ids):
        if rid in seen_set:
            scores[i] = -1.0
    return scores.astype(np.float32)


def _collaborative_scores(student_id: str, resource_ids: List[str]) -> np.ndarray:
    interactions = _fetch_interactions()
    if not interactions or not resource_ids:
        return np.zeros(len(resource_ids), dtype=np.float32)

    users = sorted({u for u, _r, _w in interactions})
    items = resource_ids
    u_index = {u: i for i, u in enumerate(users)}
    i_index = {it: j for j, it in enumerate(items)}

    rows = []
    cols = []
    data = []
    for u, r, w in interactions:
        if r not in i_index or u not in u_index:
            continue
        rows.append(u_index[u])
        cols.append(i_index[r])
        data.append(w)

    if not rows:
        return np.zeros(len(items), dtype=np.float32)

    mat = coo_matrix((data, (rows, cols)), shape=(len(users), len(items))).tocsr()
    if student_id not in u_index:
        return np.zeros(len(items), dtype=np.float32)

    # Basic MF via truncated SVD (good academic baseline; works for implicit-ish weights).
    k = min(32, min(mat.shape) - 1) if min(mat.shape) > 2 else 1
    svd = TruncatedSVD(n_components=k, random_state=42)
    user_factors = svd.fit_transform(mat)
    item_factors = svd.components_.T

    uvec = user_factors[u_index[student_id]]
    scores = item_factors @ uvec

    # Don’t recommend already interacted items.
    seen_items = set(r for u, r, _w in interactions if u == student_id)
    for j, rid in enumerate(items):
        if rid in seen_items:
            scores[j] = -1.0

    return scores.astype(np.float32)


def recommend_resources_for_student(student_id: str, top_k: int = 10) -> Dict[str, List]:
    resource_ids, resource_texts = _fetch_resources()
    if not resource_ids:
        return {"resource_ids": [], "scores": []}

    cb = _content_based_scores(student_id, resource_ids, resource_texts)
    cf = _collaborative_scores(student_id, resource_ids)

    # Combine with simple weights.
    scores = 0.6 * cb + 0.4 * cf

    # If scores are all zero/negative (cold start), fall back to popularity.
    if np.all(scores <= 0.0):
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT resource_id::text, COUNT(*)::int AS c
                    FROM user_resource_interactions
                    GROUP BY resource_id
                    ORDER BY c DESC
                    LIMIT 100;
                    """
                )
                pop = cur.fetchall()
        pop_map = {rid: float(c) for rid, c in pop}
        scores = np.array([pop_map.get(rid, 0.0) for rid in resource_ids], dtype=np.float32)

    top = np.argsort(-scores)[:top_k]
    return {
        "resource_ids": [resource_ids[i] for i in top],
        "scores": [float(scores[i]) for i in top],
    }

