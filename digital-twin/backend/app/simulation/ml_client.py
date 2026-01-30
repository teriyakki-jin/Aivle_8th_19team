"""
ML Service 클라이언트
ml-service API와 통신하여 품질 예측 및 결함 감지
"""

import requests
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

ML_SERVICE_URL = "http://localhost:8001"


class MLServiceClient:
    """ML Service API 클라이언트"""

    def __init__(self, base_url: str = ML_SERVICE_URL):
        self.base_url = base_url
        self.timeout = 3  # 짧은 타임아웃 (블로킹 방지)

    def health_check(self) -> bool:
        """ML 서비스 상태 확인"""
        try:
            response = requests.get(f"{self.base_url}/health", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"ML Service health check failed: {e}")
            return False

    def predict_welding(self) -> Dict[str, Any]:
        """용접 결함 감지 (자동 입력)"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/smartfactory/welding/image/auto",
                timeout=self.timeout
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Welding prediction failed: {response.status_code}")
                return {"status": "error", "defects": []}
        except Exception as e:
            logger.error(f"Welding prediction error: {e}")
            return {"status": "error", "defects": []}

    def predict_paint(self) -> Dict[str, Any]:
        """도장 결함 감지 (자동 입력)"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/smartfactory/paint/auto",
                timeout=self.timeout
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Paint prediction failed: {response.status_code}")
                return {"status": "error", "defects": []}
        except Exception as e:
            logger.error(f"Paint prediction error: {e}")
            return {"status": "error", "defects": []}

    def predict_body_assembly(self, part: str = "door") -> Dict[str, Any]:
        """차체 조립 검사 (자동 입력)"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/smartfactory/body/inspect/auto",
                data={"part": part, "conf": 0.25},
                timeout=self.timeout
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Body inspection failed: {response.status_code}")
                return {"pass_fail": "FAIL", "detections": []}
        except Exception as e:
            logger.error(f"Body inspection error: {e}")
            return {"pass_fail": "FAIL", "detections": []}

    def predict_press_vibration(self) -> Dict[str, Any]:
        """프레스 진동 이상 감지"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/smartfactory/press/vibration",
                timeout=self.timeout
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Press vibration failed: {response.status_code}")
                return {"status": "error", "anomaly": False}
        except Exception as e:
            logger.error(f"Press vibration error: {e}")
            return {"status": "error", "anomaly": False}

    def predict_press_image(self) -> Dict[str, Any]:
        """프레스 이미지 검사"""
        try:
            response = requests.post(
                f"{self.base_url}/api/v1/smartfactory/press/image",
                timeout=self.timeout
            )
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"Press image failed: {response.status_code}")
                return {"status": "error", "defects": []}
        except Exception as e:
            logger.error(f"Press image error: {e}")
            return {"status": "error", "defects": []}


# 글로벌 ML 클라이언트 인스턴스
ml_client = MLServiceClient()
