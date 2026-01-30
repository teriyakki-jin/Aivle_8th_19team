"""엔진 조립 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator


class EngineSimulator(BaseProcessSimulator):
    """엔진 조립 공정 시뮬레이터"""
    
    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.ENGINE, params)
        self.target_cycle_time = 150.0  # 150초
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산"""
        torque = self.params.get('torque', 250.0)
        rpm = self.params.get('rpm', 6000.0)
        
        # 토크와 RPM이 높을수록 조립 시간 증가 (복잡도)
        base_time = 150.0
        complexity_factor = (torque / 250.0 + rpm / 6000.0) / 2
        
        self.target_cycle_time = base_time * complexity_factor
        self.target_cycle_time += random.uniform(-4, 4)
    
    def _calculate_quality(self):
        """품질 계산"""
        torque = self.params.get('torque', 250.0)
        rpm = self.params.get('rpm', 6000.0)
        
        # 최적: 250Nm, 6000RPM
        torque_deviation = abs(torque - 250.0) / 250.0
        rpm_deviation = abs(rpm - 6000.0) / 6000.0
        
        quality_penalty = (torque_deviation + rpm_deviation) * 10
        self.quality_score = max(75.0, 97.0 - quality_penalty + random.uniform(-2, 2))
        self.defect_rate = 100 - self.quality_score
