from datetime import datetime

from pydantic import BaseModel


class AnalysisOut(BaseModel):
    analyzer: str | None
    version: str | None
    prediction: str | None
    confidence: float | None
    abstained: bool | None
    has_heatmap: bool
    notice: str = "Preliminary, not a diagnosis"


class ImageOut(BaseModel):
    id: int
    created_at: datetime
    width: int
    height: int
    size_bytes: int
    analysis: AnalysisOut
