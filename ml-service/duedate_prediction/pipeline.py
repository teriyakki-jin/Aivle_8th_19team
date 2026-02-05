import pandas as pd
from duedate_prediction.model_loader import ModelRegistry
from duedate_prediction.feature import to_feature_df

def predict_pipeline(req):
    X = to_feature_df(req.dict())

    # 학습 시 저장한 feature_columns 기준
    X = X.reindex(
        columns=ModelRegistry.feature_columns,
        fill_value=0.0
    )

    # dtype 통일
    for c in X.columns:
        if c != "snapshot_stage":
            X[c] = X[c].astype(float)

    # Stage1
    prob = ModelRegistry.stage1.predict_proba(X)[:, 1][0]

    if prob < ModelRegistry.threshold:
        return {
            "delay_flag": 0,
            "delay_probability": float(prob),
            "predicted_delay_minutes": 0.0
        }

    # Stage2
    delay_min = ModelRegistry.stage2.predict(X)[0]

    return {
        "delay_flag": 1,
        "delay_probability": float(prob),
        "predicted_delay_minutes": float(delay_min)
    }
