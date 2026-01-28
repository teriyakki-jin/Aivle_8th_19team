# ml-service/save_results.py
"""
ML 서비스에서 분석 결과를 백엔드 DB에 저장하는 유틸리티
"""

import requests
import json
from typing import List, Dict, Any
from datetime import datetime
import uuid
from pathlib import Path


class AnalysisResultSaver:
    """분석 결과를 백엔드로 전송하는 클래스"""

    def __init__(self, backend_url: str = "http://localhost:8080"):
        self.backend_url = backend_url
        self.api_base = f"{backend_url}/api/v1/paint"

    def create_session(
        self,
        facility_name: str,
        location_code: str = None,
        notes: str = None,
    ) -> str:
        """
        새 검사 세션 생성
        Returns: session_id
        """
        payload = {
            "facilityName": facility_name,
            "locationCode": location_code,
            "notes": notes,
        }

        response = requests.post(
            f"{self.api_base}/session",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()["sessionId"]

    def save_analysis_result(
        self,
        session_id: str,
        facility_name: str,
        image_filename: str,
        image_path: str,
        image_url: str,
        yolo_predictions: Dict[str, Any],
        model_version: str = "v1.0",
        inference_time_ms: float = 0,
        inspector_id: str = None,
        inspector_name: str = None,
    ) -> str:
        """
        분석 결과 저장

        Args:
            session_id: 검사 세션 ID
            facility_name: 시설명
            image_filename: 원본 이미지 파일명
            image_path: 저장 경로
            image_url: 웹 서빙 URL
            yolo_predictions: YOLO 모델 추론 결과
                {
                    "status": "PASS" | "FAIL" | "WARNING",
                    "primary_defect": "orange_peel" | None,
                    "confidence": 0.925,
                    "detections": [
                        {
                            "class": "orange_peel",
                            "class_name": "주황색 굳음",
                            "confidence": 0.925,
                            "bbox": [x1, y1, x2, y2],
                        }
                    ]
                }
            model_version: 모델 버전
            inference_time_ms: 추론 소요 시간
            inspector_id: 검사자 ID
            inspector_name: 검사자 이름

        Returns: result_id
        """

        # 결함 정보 변환
        defects = []
        defect_class_names = {
            "0": {"ko": "없음", "en": "No Defect"},
            "1": {"ko": "주황색 굳음", "en": "Orange Peel"},
            "2": {"ko": "흘리고 내림", "en": "Runs and Sags"},
            "3": {"ko": "용제 파열", "en": "Solvent Pop"},
            "4": {"ko": "물 얼룩", "en": "Water Spotting"},
        }

        if yolo_predictions.get("detections"):
            for detection in yolo_predictions["detections"]:
                class_id = str(detection.get("class", 0))
                class_info = defect_class_names.get(
                    class_id, {"ko": "미분류", "en": "Unknown"}
                )
                bbox = detection.get("bbox", [0, 0, 0, 0])

                defect = {
                    "defectClass": detection.get("class_name", "unknown"),
                    "defectNameKo": class_info["ko"],
                    "defectNameEn": class_info["en"],
                    "confidence": float(detection.get("confidence", 0)),
                    "bbox": {
                        "x1": int(bbox[0]),
                        "y1": int(bbox[1]),
                        "x2": int(bbox[2]),
                        "y2": int(bbox[3]),
                    },
                    "severityLevel": self._calculate_severity(
                        float(detection.get("confidence", 0))
                    ),
                }
                defects.append(defect)

        # 분석 결과 생성
        payload = {
            "sessionId": session_id,
            "facilityName": facility_name,
            "imageFilename": image_filename,
            "imagePath": image_path,
            "imageUrl": image_url,
            "status": yolo_predictions.get("status", "FAIL").upper(),
            "primaryDefectType": yolo_predictions.get("primary_defect"),
            "confidence": float(yolo_predictions.get("confidence", 0)),
            "modelVersion": model_version,
            "inferenceTimeMs": int(inference_time_ms),
            "inspectorId": inspector_id,
            "inspectorName": inspector_name,
            "defects": defects,
        }

        response = requests.post(
            f"{self.api_base}/analysis",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        response.raise_for_status()
        return response.json()["resultId"]

    def _calculate_severity(self, confidence: float) -> str:
        """신뢰도에 따른 심각도 계산"""
        if confidence >= 0.9:
            return "CRITICAL"
        elif confidence >= 0.75:
            return "HIGH"
        elif confidence >= 0.5:
            return "MEDIUM"
        else:
            return "LOW"

    def get_recent_results(self, days: int = 7, limit: int = 50) -> List[Dict]:
        """최근 분석 결과 조회"""
        response = requests.get(
            f"{self.api_base}/results",
            params={"days": days, "limit": limit},
        )
        response.raise_for_status()
        return response.json()["data"]

    def get_defect_summary(self, days: int = 30) -> List[Dict]:
        """결함 유형별 통계"""
        response = requests.get(
            f"{self.api_base}/defect-types",
            params={"days": days},
        )
        response.raise_for_status()
        return response.json()["data"]

    def get_daily_stats(self, start_date: str, end_date: str) -> List[Dict]:
        """일일 통계 조회"""
        response = requests.get(
            f"{self.api_base}/daily-stats",
            params={"startDate": start_date, "endDate": end_date},
        )
        response.raise_for_status()
        return response.json()["data"]


# 사용 예제
if __name__ == "__main__":
    # 초기화
    saver = AnalysisResultSaver(backend_url="http://localhost:8080")

    # 1. 검사 세션 생성
    session_id = saver.create_session(
        facility_name="도장실 A",
        location_code="Area-A-001",
        notes="일일 검사",
    )
    print(f"✓ Session created: {session_id}")

    # 2. 분석 결과 저장 (예제 데이터)
    yolo_result = {
        "status": "FAIL",
        "primary_defect": "orange_peel",
        "confidence": 0.925,
        "detections": [
            {
                "class": "1",
                "class_name": "orange_peel",
                "confidence": 0.925,
                "bbox": [100, 150, 300, 350],
            },
            {
                "class": "3",
                "class_name": "solvent_pop",
                "confidence": 0.753,
                "bbox": [400, 200, 550, 400],
            },
        ],
    }

    result_id = saver.save_analysis_result(
        session_id=session_id,
        facility_name="도장실 A",
        image_filename="sample_001.jpg",
        image_path="/uploads/sample_001.jpg",
        image_url="http://localhost:8000/static/sample_001.jpg",
        yolo_predictions=yolo_result,
        model_version="v1.0",
        inference_time_ms=145,
        inspector_id="user123",
        inspector_name="김철수",
    )
    print(f"✓ Analysis result saved: {result_id}")

    # 3. 최근 결과 조회
    recent = saver.get_recent_results(days=7, limit=10)
    print(f"\n✓ Recent results ({len(recent)} items):")
    for item in recent[:3]:
        print(f"  - {item['result_id']}: {item['status']} (confidence: {item['confidence']}%)")

    # 4. 결함 유형별 통계
    defect_summary = saver.get_defect_summary(days=30)
    print(f"\n✓ Defect summary ({len(defect_summary)} types):")
    for defect in defect_summary[:3]:
        print(
            f"  - {defect['defect_name_ko']}: {defect['occurrence_count']} occurrences "
            f"(avg confidence: {defect['avg_confidence']}%)"
        )

    # 5. 일일 통계
    daily = saver.get_daily_stats("2024-01-15", "2024-01-22")
    print(f"\n✓ Daily statistics ({len(daily)} days):")
    for stat in daily[-3:]:
        print(
            f"  - {stat['stat_date']}: {stat['total_inspections']} inspections, "
            f"{stat['defect_count']} defects"
        )
