# import os
# os.environ["HF_HOME"] = "/tmp/hf_cache"
# os.environ["TRANSFORMERS_CACHE"] = "/tmp/hf_cache"
# os.environ["SENTENCE_TRANSFORMERS_HOME"] = "/tmp/hf_cache"

# import logging
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# from fastapi import FastAPI

# from app.config import settings
# from app.schemas import AnalyzeAnnouncementRequest, AnalyzeAnnouncementResponse, RecommendResourcesResponse
# from app.summarization.textrank import summarize_if_needed
# from app.embeddings.encoder import get_encoder
# from app.recommendation.recommender import recommend_resources_for_student

# app = FastAPI(title="FirstAcad AI Service", version="1.0.0")


# @app.get("/health")
# def health():
#     return {"ok": True, "service": "firstacad-ai", "env": settings.env}


# @app.post("/analyze/announcement", response_model=AnalyzeAnnouncementResponse)
# def analyze_announcement(req: AnalyzeAnnouncementRequest):
#     # Priority: embedding-based + lightweight heuristics (no LLM APIs).
#     encoder = get_encoder()
#     text = (req.title.strip() + "\n\n" + req.body.strip()).strip()
#     vec = encoder.embed(text)

#     # Heuristic scoring that is ML-ready (swap in trained classifier later).
#     lowered = text.lower()
#     keywords_high = ["exam", "test", "deadline", "due", "cancel", "postpon", "urgent", "immediately"]
#     kw_hits = sum(1 for k in keywords_high if k in lowered)
#     length_bonus = min(len(text) / 2000.0, 1.0)
#     score = float(0.55 * kw_hits + 0.35 * length_bonus + 0.10 * float(abs(vec).mean()))

#     if score >= 1.2:
#         priority = "HIGH"
#     elif score >= 0.6:
#         priority = "MEDIUM"
#     else:
#         priority = "LOW"

#     summary = summarize_if_needed(req.body)
#     return AnalyzeAnnouncementResponse(priority=priority, summary=summary, score=score)


# @app.get("/recommend/resources/{student_id}", response_model=RecommendResourcesResponse)
# def recommend_resources(student_id: str):
#     recs = recommend_resources_for_student(student_id)
#     return RecommendResourcesResponse(recommended_resource_ids=recs["resource_ids"], scores=recs["scores"])

# @app.get("/health/ai")
# def ai_health():
#     if model is None:
#         return {"status": "failed", "reason": "Model failed to load at startup"}
#     return {"status": "ok", "model_loaded": True}

import os
import time
import logging
from fastapi import FastAPI, HTTPException

# Force Hugging Face cache to writable directory on Render
os.environ["HF_HOME"] = "/tmp/hf_cache"
os.environ["TRANSFORMERS_CACHE"] = "/tmp/hf_cache"
os.environ["SENTENCE_TRANSFORMERS_HOME"] = "/tmp/hf_cache"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.config import settings
from app.schemas import AnalyzeAnnouncementRequest, AnalyzeAnnouncementResponse, RecommendResourcesResponse
from app.summarization.textrank import summarize_if_needed
from app.embeddings.encoder import get_encoder
from app.recommendation.recommender import recommend_resources_for_student

# Lazy load the model - This is the recommended way for Render
_encoder = None

_encoder = None

_encoder = None

def get_encoder():
    """Lazy load a lightweight SentenceTransformer model"""
    global _encoder
    if _encoder is None:
        try:
            logger.info("=== LOADING LIGHTWEIGHT SENTENCE TRANSFORMER MODEL ===")
            logger.info(f"HF_HOME = {os.getenv('HF_HOME')}")

            start = time.time()
            
            from sentence_transformers import SentenceTransformer
            import torch
            import gc
            
            _encoder = SentenceTransformer(
                'paraphrase-MiniLM-L3-v2',   # Much lighter than all-MiniLM-L6-v2
                device='cpu',
                trust_remote_code=True
            )
            
            # Memory optimization
            logger.info("Applying memory optimization...")
            _encoder = _encoder.cpu()
            gc.collect()
            
            if hasattr(torch, 'cuda'):
                torch.cuda.empty_cache()
            
            load_time = time.time() - start
            logger.info(f"=== LIGHT MODEL LOADED SUCCESSFULLY in {load_time:.1f} seconds ===")
            
        except Exception as e:
            logger.error("=== FAILED TO LOAD MODEL ===", exc_info=True)
            _encoder = None
            raise HTTPException(status_code=503, detail="AI model failed to load")
    
    return _encoder


app = FastAPI(title="FirstAcad AI Service", version="1.0.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "firstacad-ai", "env": settings.env}


@app.post("/analyze/announcement", response_model=AnalyzeAnnouncementResponse)
def analyze_announcement(req: AnalyzeAnnouncementRequest):
    encoder = get_encoder()           # ← This will load the model on first call
    text = (req.title.strip() + "\n\n" + req.body.strip()).strip()
    vec = encoder.embed(text)

    # ... rest of your code remains the same
    lowered = text.lower()
    keywords_high = ["exam", "test", "deadline", "due", "cancel", "postpon", "urgent", "immediately"]
    kw_hits = sum(1 for k in keywords_high if k in lowered)
    length_bonus = min(len(text) / 2000.0, 1.0)
    score = float(0.55 * kw_hits + 0.35 * length_bonus + 0.10 * float(abs(vec).mean()))

    if score >= 1.2:
        priority = "HIGH"
    elif score >= 0.6:
        priority = "MEDIUM"
    else:
        priority = "LOW"

    summary = summarize_if_needed(req.body)
    return AnalyzeAnnouncementResponse(priority=priority, summary=summary, score=score)


@app.get("/recommend/resources/{student_id}", response_model=RecommendResourcesResponse)
def recommend_resources(student_id: str):
    recs = recommend_resources_for_student(student_id)
    return RecommendResourcesResponse(recommended_resource_ids=recs["resource_ids"], scores=recs["scores"])


@app.get("/health/ai")
def ai_health():
    try:
        encoder = get_encoder()
        return {
            "status": "ok", 
            "model_loaded": True,
            "model_name": "all-MiniLM-L6-v2"
        }
    except Exception as e:
        return {"status": "failed", "reason": str(e)}