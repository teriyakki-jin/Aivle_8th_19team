"""도장 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator

# 도장 검사 이미지 폴더 경로
PAINT_IMAGE_FOLDER = r"D:\Aivle_8th_19team\ml-service\paint\sample_images"


class PaintSimulator(BaseProcessSimulator):
    """도장 공정 시뮬레이터"""

    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.PAINT, params)
        self.target_cycle_time = 180.0  # 180초
        self.set_image_folder(PAINT_IMAGE_FOLDER)
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산 - 두께에 따라"""
        thickness = self.params.get('thickness', 100.0)
        
        # 두께가 두꺼울수록 시간 증가
        base_time = 180.0
        thickness_factor = thickness / 100.0
        
        self.target_cycle_time = base_time * thickness_factor
        self.target_cycle_time += random.uniform(-5, 5)
    
    def _calculate_quality(self):
        """품질 계산 - 온도와 습도"""
        temperature = self.params.get('temperature', 60.0)
        humidity = self.params.get('humidity', 50.0)
        thickness = self.params.get('thickness', 100.0)
        
        # 최적: 60도, 50% 습도, 100μm 두께
        temp_deviation = abs(temperature - 60.0) / 60.0
        humidity_deviation = abs(humidity - 50.0) / 50.0
        thickness_deviation = abs(thickness - 100.0) / 100.0
        
        quality_penalty = (temp_deviation + humidity_deviation + thickness_deviation) * 12
        self.quality_score = max(60.0, 94.0 - quality_penalty + random.uniform(-3, 3))
        self.defect_rate = 100 - self.quality_score
