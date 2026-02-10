import pandas as pd
from duedate_prediction.model_loader import ModelRegistry
from duedate_prediction.feature import to_feature_df

def predict_pipeline(req):
    # ===============================
    # 1) feature 생성
    # ===============================
    X = to_feature_df(req.dict())

    # ===============================
    # 2) 학습 시 저장한 feature_columns 기준 정렬
    # ===============================
    X = X.reindex(
        columns=ModelRegistry.feature_columns,
        fill_value=0.0
    )

    # ===============================
    # 3) snapshot_stage 보호 (CatBoost categorical)
    # ===============================
    X["snapshot_stage"] = X["snapshot_stage"].astype(str)

    # ===============================
    # 4) numeric dtype 통일
    # ===============================
    for c in X.columns:
        if c != "snapshot_stage":
            X[c] = X[c].astype(float)

    # ===============================
    # 5) Stage1: 지연 여부 판단
    # ===============================
    prob = ModelRegistry.stage1.predict_proba(X)[:, 1][0]

    if prob < ModelRegistry.threshold:
        return {
            "delay_flag": 0,
            "delay_probability": float(prob),
            "predicted_remaining_delay_minutes": 0.0
        }

    # ===============================
    # 6) Stage2: 남은 지연 시간 예측
    # ===============================
    delay_min = ModelRegistry.stage2.predict(X)[0]

    return {
        "delay_flag": 1,
        "delay_probability": float(prob),
        "predicted_remaining_delay_minutes": float(delay_min)
    }
