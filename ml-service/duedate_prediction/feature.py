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
    df = pd.DataFrame([req_dict])

    # anomaly NaN → 0 (누적 계산용)
    for c in ANOM_COLS:
        if c not in df.columns:
            df[c] = 0.0

    anom_filled = df[ANOM_COLS].fillna(0.0)

    df["anomaly_sum"] = anom_filled.sum(axis=1)
    df["anomaly_count"] = df[ANOM_COLS].notna().sum(axis=1)
    df["anomaly_mean"] = df["anomaly_sum"] / df["anomaly_count"].clip(lower=1)

    df["anomaly_time_pressure"] = (
        df["anomaly_sum"] / (df["remaining_slack_minutes"] + 1.0)
    )

    df["slack_usage_ratio"] = (
        df["elapsed_minutes"]
        / (df["elapsed_minutes"] + df["remaining_slack_minutes"] + 1.0)
    )

    hours = (df["elapsed_minutes"] / 60.0).clip(lower=1e-6)
    df["stop_per_hour"] = df["stop_count_total"] / hours

    return df
