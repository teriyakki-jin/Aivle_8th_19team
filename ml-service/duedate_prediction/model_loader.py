import json
import os
from catboost import CatBoostClassifier, CatBoostRegressor

class ModelRegistry:
    stage1 = None
    stage2 = None
    threshold = None
    feature_columns = None

    @classmethod
    def load(cls):
        # 현재 파일 기준으로 duedate_prediction/models 경로 사용
        base_dir = os.path.dirname(os.path.abspath(__file__))
        model_dir = os.path.join(base_dir, "models")

        cls.stage1 = CatBoostClassifier()
        cls.stage1.load_model(os.path.join(model_dir, "stage1.cb"))

        cls.stage2 = CatBoostRegressor()
        cls.stage2.load_model(os.path.join(model_dir, "stage2.cb"))

        with open(os.path.join(model_dir, "threshold.json")) as f:
            cls.threshold = json.load(f)["threshold"]

        with open(os.path.join(model_dir, "feature_columns.json")) as f:
            cls.feature_columns = json.load(f)["feature_columns"]
