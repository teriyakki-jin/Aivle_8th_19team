"""용접 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator

# 용접 검사 이미지 폴더 경로
WELDING_IMAGE_FOLDER = r"D:\Aivle_8th_19team\ml-service\welding_image\test"


class WeldingSimulator(BaseProcessSimulator):
    """용접 공정 시뮬레이터"""

    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.WELDING, params)
        self.target_cycle_time = 90.0  # 90초
        self.set_image_folder(WELDING_IMAGE_FOLDER)
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산 - 전류, 전압, 속도"""
        current = self.params.get('current', 200.0)
        voltage = self.params.get('voltage', 24.0)
        speed = self.params.get('speed', 50.0)
        
        # 전력(W) = 전류 * 전압
        power = current * voltage
        optimal_power = 200.0 * 24.0  # 4800W
        
        base_time = 90.0
        power_factor = optimal_power / power
        speed_factor = 50.0 / speed
        
        self.target_cycle_time = base_time * power_factor * speed_factor
        self.target_cycle_time += random.uniform(-3, 3)
    
    def _calculate_quality(self):
        """품질 계산 - 전류와 전압의 균형"""
        current = self.params.get('current', 200.0)
        voltage = self.params.get('voltage', 24.0)
        
        # 최적: 200A, 24V
        current_deviation = abs(current - 200.0) / 200.0
        voltage_deviation = abs(voltage - 24.0) / 24.0
        
        quality_penalty = (current_deviation + voltage_deviation) * 15
        self.quality_score = max(65.0, 96.0 - quality_penalty + random.uniform(-3, 3))
        self.defect_rate = 100 - self.quality_score
