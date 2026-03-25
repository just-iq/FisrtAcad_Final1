from typing import List, Optional

from pydantic import BaseModel, Field


class AnalyzeAnnouncementRequest(BaseModel):
    id: str
    title: str
    body: str


class AnalyzeAnnouncementResponse(BaseModel):
    priority: str = Field(pattern="^(HIGH|MEDIUM|LOW)$")
    summary: Optional[str] = None
    score: float


class RecommendResourcesResponse(BaseModel):
    recommended_resource_ids: List[str]
    scores: List[float]

