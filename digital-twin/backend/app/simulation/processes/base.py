"""
기본 공정 시뮬레이터 클래스
"""

import os
import random
from typing import Dict, Any, Optional, List
from app.models.schemas import ProcessState, ProcessType, ProcessStatus


class BaseProcessSimulator:
    """모든 공정 시뮬레이터의 기본 클래스"""

    def __init__(self, process_type: ProcessType, params: Dict[str, float]):
        self.process_type = process_type
        self.params = params
        self.status = ProcessStatus.IDLE
        self.progress = 0.0
        self.current_cycle_time = 0.0
        self.target_cycle_time = 60.0  # 기본 60초

        # 통계
        self.units_processed = 0
        self.units_failed = 0
        self.total_time = 0.0

        # 성능 지표
        self.quality_score = 95.0
        self.defect_rate = 5.0
        self.utilization = 0.0

        # 검사 이미지
        self.image_folder: Optional[str] = None
        self.current_image: Optional[str] = None
        self._image_cache: List[str] = []

        # 불량 정보
        self.last_defect_info: Optional[Dict[str, Any]] = None
    
    def update(self, delta_time: float):
        """시뮬레이션 업데이트"""
        if self.status in [ProcessStatus.RUNNING, ProcessStatus.WARNING]:
            self.current_cycle_time += delta_time
            self.total_time += delta_time
            self.progress = min(100.0, (self.current_cycle_time / self.target_cycle_time) * 100)

            # 사이클 완료 체크
            if self.current_cycle_time >= self.target_cycle_time:
                self.status = ProcessStatus.COMPLETED
                self.progress = 100.0

            # 가동률 업데이트
            self.utilization = min(100.0, self.utilization + delta_time / 10)

            # 랜덤 경고 발생 (5% 확률) - WARNING이 아닐 때만
            if self.status == ProcessStatus.RUNNING and random.random() < 0.05 * delta_time:
                self.status = ProcessStatus.WARNING
            # WARNING 상태에서 자동 복구 (30% 확률)
            elif self.status == ProcessStatus.WARNING and random.random() < 0.3 * delta_time:
                self.status = ProcessStatus.RUNNING

        elif self.status == ProcessStatus.IDLE:
            # 유휴 시간에는 가동률 감소
            self.utilization = max(0.0, self.utilization - delta_time / 20)
    
    def start_cycle(self):
        """사이클 시작"""
        self.status = ProcessStatus.RUNNING
        self.progress = 0.0
        self.current_cycle_time = 0.0
        self._calculate_cycle_time()
        self._calculate_quality()
        self._select_random_image()
    
    def complete_cycle(self):
        """사이클 완료"""
        self.units_processed += 1
        self.status = ProcessStatus.IDLE
        self.progress = 0.0
        self.current_cycle_time = 0.0
    
    def reset(self):
        """리셋"""
        self.status = ProcessStatus.IDLE
        self.progress = 0.0
        self.current_cycle_time = 0.0
        self.units_processed = 0
        self.units_failed = 0
        self.total_time = 0.0
        self.utilization = 0.0
    
    def update_parameters(self, params: Dict[str, float]):
        """파라미터 업데이트"""
        self.params.update(params)
        self._calculate_cycle_time()
        self._calculate_quality()
    
    def _calculate_cycle_time(self):
        """사이클 타임 계산 (서브클래스에서 구현)"""
        self.target_cycle_time = 60.0 + random.uniform(-5, 5)
    
    def _calculate_quality(self):
        """품질 점수 계산 (서브클래스에서 구현)"""
        self.quality_score = 95.0 + random.uniform(-5, 5)
        self.defect_rate = 100 - self.quality_score

    def _select_random_image(self):
        """검사용 이미지 랜덤 선택"""
        if not self.image_folder or not os.path.exists(self.image_folder):
            self.current_image = None
            return

        # 캐시가 비어있으면 이미지 목록 로드
        if not self._image_cache:
            self._load_image_cache()

        if self._image_cache:
            self.current_image = random.choice(self._image_cache)
        else:
            self.current_image = None

    def _load_image_cache(self):
        """이미지 목록 캐시 로드"""
        if not self.image_folder or not os.path.exists(self.image_folder):
            self._image_cache = []
            return

        valid_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
        self._image_cache = [
            os.path.join(self.image_folder, f)
            for f in os.listdir(self.image_folder)
            if os.path.splitext(f)[1].lower() in valid_extensions
        ]

    def set_image_folder(self, folder_path: str):
        """이미지 폴더 설정"""
        self.image_folder = folder_path
        self._image_cache = []  # 캐시 초기화
    
    def get_state(self) -> ProcessState:
        """현재 상태 반환"""
        return ProcessState(
            process_type=self.process_type,
            status=self.status,
            progress=self.progress,
            cycle_time=self.target_cycle_time,
            quality_score=self.quality_score,
            defect_rate=self.defect_rate,
            utilization=self.utilization,
            current_params=self.params.copy(),
            units_processed=self.units_processed,
            units_failed=self.units_failed,
            total_time=self.total_time,
            inspection_image=self.current_image,
            last_defect_info=self.last_defect_info
        )

    def set_defect_info(self, defect_info: Optional[Dict[str, Any]]):
        """불량 정보 설정"""
        self.last_defect_info = defect_info
