from datetime import datetime
from typing import Literal, Optional, List
from pydantic import BaseModel, HttpUrl

Status = Literal["normal", "defect"]

class DefectPrediction(BaseModel):
    id: str
    status: Status
    defect_type: Optional[str] = None
    confidence: float
    location: str
    timestamp: datetime
    image_url: HttpUrl | str  # 개발 중엔 str로도 허용

class PredictionList(BaseModel):
    items: List[DefectPrediction]
    total: int

class Metrics(BaseModel):
    total_inspections: int
    defect_rate: float        # 0~1 사이
    normal_rate: float        # 0~1 사이
    improvement_pct: float    # 전주 대비
