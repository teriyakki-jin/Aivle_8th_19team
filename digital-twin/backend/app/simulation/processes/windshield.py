"""윈드실드 설치 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator


class WindshieldSimulator(BaseProcessSimulator):
    """윈드실드 설치 공정 시뮬레이터"""
    
    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.WINDSHIELD, params)
        self.target_cycle_time = 60.0  # 60초
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산"""
        pressure = self.params.get('pressure', 2.0)
        
        # 압력이 높을수록 빠름
        base_time = 60.0
        pressure_factor = 2.0 / pressure
        
        self.target_cycle_time = base_time * pressure_factor
        self.target_cycle_time += random.uniform(-2, 2)
    
    def _calculate_quality(self):
        """품질 계산"""
        pressure = self.params.get('pressure', 2.0)
        temperature = self.params.get('temperature', 20.0)
        
        # 최적: 2bar, 20도
        pressure_deviation = abs(pressure - 2.0) / 2.0
        temp_deviation = abs(temperature - 20.0) / 20.0
        
        quality_penalty = (pressure_deviation + temp_deviation) * 15
        self.quality_score = max(70.0, 98.0 - quality_penalty + random.uniform(-2, 2))
        self.defect_rate = 100 - self.quality_score
