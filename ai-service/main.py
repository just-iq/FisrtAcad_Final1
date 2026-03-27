import os
import logging

# Force Hugging Face cache to writable directory on Render
os.environ["HF_HOME"] = "/tmp/hf_cache"
os.environ["TRANSFORMERS_CACHE"] = "/tmp/hf_cache"
os.environ["SENTENCE_TRANSFORMERS_HOME"] = "/tmp/hf_cache"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi import FastAPI

from app.config import settings
from app.schemas import (
    AnalyzeAnnouncementRequest,
    AnalyzeAnnouncementResponse,
    RecommendResourcesResponse,
)
from app.summarization.textrank import summarize_if_needed
from app.embeddings.encoder import get_encoder          # single source of truth
from app.recommendation.recommender import recommend_resources_for_student

app = FastAPI(title="FirstAcad AI Service", version="1.0.0")


@app.get("/health")
def health():
    return {"ok": True, "service": "firstacad-ai", "env": settings.env}


@app.get("/health/ai")
def ai_health():
    try:
        encoder = get_encoder()
        return {
            "status": "ok",
            "model_loaded": encoder is not None,
            "model_name": settings.embedding_model,
        }
    except Exception as e:
        logger.error("AI health check failed", exc_info=True)
        return {"status": "failed", "reason": str(e)}


@app.post("/analyze/announcement", response_model=AnalyzeAnnouncementResponse)
def analyze_announcement(req: AnalyzeAnnouncementRequest):
    encoder = get_encoder()

    text = (req.title.strip() + "\n\n" + req.body.strip()).strip()
    vec = encoder.embed(text)   # uses the Encoder wrapper — returns np.ndarray

    lowered = text.lower()
    keywords_high = [
        "exam", "test", "deadline", "due",
        "cancel", "postpon", "urgent", "immediately",
    ]
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
    return RecommendResourcesResponse(
        recommended_resource_ids=recs["resource_ids"],
        scores=recs["scores"],
    )