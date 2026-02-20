import pandas as pd
import numpy as np

ANOM_COLS = [
    "press_anomaly_score",
    "weld_anomaly_score",
    "paint_anomaly_score",
    "assembly_anomaly_score",
    "inspection_anomaly_score",
]

def to_feature_df(req_dict: dict) -> pd.DataFrame:
    """
    학습 코드(preprocess_and_make_features)와
    의미/계산 방식이 100% 동일한 실시간 feature 생성기
    """
    df = pd.DataFrame([req_dict])

    # ===============================
    # anomaly 컬럼 보정
    # ===============================
    for c in ANOM_COLS:
        if c not in df.columns:
            df[c] = np.nan  # 미래 공정은 NaN 유지 (중요)

    # 누적 계산용 (합/평균)
    anom_filled = df[ANOM_COLS].fillna(0.0)

    # ===============================
    # anomaly 파생 피처 (학습과 동일)
    # ===============================
    df["anomaly_sum"] = anom_filled.sum(axis=1)

    # ⚠️ 중요: 관측된 공정만 count (clip 필수)
    df["anomaly_count"] = (
        df[ANOM_COLS].notna().sum(axis=1).clip(lower=1)
    )

    df["anomaly_mean"] = df["anomaly_sum"] / df["anomaly_count"]

    # ===============================
    # 시간 압박 피처
    # ===============================
    df["anomaly_time_pressure"] = (
        df["anomaly_sum"] / (df["remaining_slack_minutes"] + 1.0)
    )

    df["slack_usage_ratio"] = (
        df["elapsed_minutes"]
        / (df["elapsed_minutes"] + df["remaining_slack_minutes"] + 1.0)
    )

    # ===============================
    # stop 빈도
    # ===============================
    hours = (df["elapsed_minutes"] / 60.0).clip(lower=1e-6)
    df["stop_per_hour"] = df["stop_count_total"] / hours

    return df
