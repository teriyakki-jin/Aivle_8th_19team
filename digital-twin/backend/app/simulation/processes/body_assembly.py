"""차체 조립 공정 시뮬레이터"""
import random
from typing import Dict
from app.models.schemas import ProcessType
from app.simulation.processes.base import BaseProcessSimulator

# 차체 조립 검사 이미지 폴더 경로
BODY_ASSEMBLY_IMAGE_FOLDER = r"D:\Aivle_8th_19team\ml-service\body_assembly\runs"


class BodyAssemblySimulator(BaseProcessSimulator):
    """차체 조립 공정 시뮬레이터"""

    def __init__(self, params: Dict[str, float]):
        super().__init__(ProcessType.BODY_ASSEMBLY, params)
        self.target_cycle_time = 120.0  # 120초
        self.set_image_folder(BODY_ASSEMBLY_IMAGE_FOLDER)
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산"""
        cycle_time = self.params.get('cycle_time', 120.0)
        self.target_cycle_time = cycle_time + random.uniform(-5, 5)
    
    def _calculate_quality(self):
        """품질 계산 - 공차"""
        tolerance = self.params.get('tolerance', 0.1)
        
        # 최적 공차: 0.1mm
        tolerance_deviation = abs(tolerance - 0.1) / 0.1
        
        quality_penalty = tolerance_deviation * 20
        self.quality_score = max(70.0, 97.0 - quality_penalty + random.uniform(-2, 2))
        self.defect_rate = 100 - self.quality_score
