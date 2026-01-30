"""프레스 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator


class PressSimulator(BaseProcessSimulator):
    """프레스 공정 시뮬레이터"""
    
    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.PRESS, params)
        self.target_cycle_time = 45.0  # 45초
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산 - 힘과 속도에 따라"""
        force = self.params.get('force', 1000.0)
        speed = self.params.get('speed', 30.0)
        
        # 힘이 높을수록, 속도가 빠를수록 사이클 타임 감소
        base_time = 45.0
        force_factor = 1000.0 / force  # 기준 1000톤
        speed_factor = 30.0 / speed    # 기준 30회/분
        
        self.target_cycle_time = base_time * force_factor * speed_factor
        self.target_cycle_time += random.uniform(-2, 2)
    
    def _calculate_quality(self):
        """품질 계산 - 온도와 힘의 균형"""
        force = self.params.get('force', 1000.0)
        temperature = self.params.get('temperature', 25.0)
        
        # 최적 조건: 1000톤, 25도
        force_deviation = abs(force - 1000.0) / 1000.0
        temp_deviation = abs(temperature - 25.0) / 25.0
        
        quality_penalty = (force_deviation + temp_deviation) * 10
        self.quality_score = max(70.0, 98.0 - quality_penalty + random.uniform(-2, 2))
        self.defect_rate = 100 - self.quality_score
