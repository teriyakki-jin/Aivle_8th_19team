from pydantic import BaseModel
from typing import Optional

class PredictRequest(BaseModel):
    # numeric
    order_qty: float                # 주문 수량
    stop_count_total: float         # 누적 stop 횟수
    elapsed_minutes: float          # 누적 경과 시간(분)
    remaining_slack_minutes: float  # 남은 납기 여유(분)

    # anomaly (nullable allowed)
    press_anomaly_score: Optional[float] = None
    weld_anomaly_score: Optional[float] = None
    paint_anomaly_score: Optional[float] = None
    assembly_anomaly_score: Optional[float] = None
    inspection_anomaly_score: Optional[float] = None

    # ✅ categorical (cat_features)
    # (원-핫이 아니라 snapshot_stage 문자열로 받는다)
    # 지금까지 너가 Postman에 보냈던 snapshot_stage_PRESS_DONE: 0/1 방식은 버려야 해.
    # CatBoost가 cat_feature로 학습했으면 FastAPI도 snapshot_stage 문자열을 그대로 받아야 타입 문제가 사라져.
    snapshot_stage: str  # "PRESS_DONE", "WELD_DONE", ...

class PredictResponse(BaseModel):
    delay_flag: int
    delay_probability: float
    predicted_delay_minutes: float
