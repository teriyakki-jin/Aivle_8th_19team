from pydantic import BaseModel
from typing import Optional

class PredictRequest(BaseModel):
    # ===============================
    # numeric
    # ===============================
    order_qty: float
    stop_count_total: float
    elapsed_minutes: float
    remaining_slack_minutes: float

    # ===============================
    # anomaly (nullable)
    # ===============================
    press_anomaly_score: Optional[float] = None
    weld_anomaly_score: Optional[float] = None
    paint_anomaly_score: Optional[float] = None
    assembly_anomaly_score: Optional[float] = None
    inspection_anomaly_score: Optional[float] = None

    # ===============================
    # categorical (CatBoost)
    # ===============================
    snapshot_stage: str  # "PRESS_DONE", "WELD_DONE", ...

class PredictResponse(BaseModel):
    delay_flag: int
    delay_probability: float

    # 🔥 Stage2 타깃 의미를 정확히 반영
    predicted_remaining_delay_minutes: float
