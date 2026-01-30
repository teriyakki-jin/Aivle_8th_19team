"""
Pydantic 스키마 정의
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from enum import Enum
from datetime import datetime


class ProcessStatus(str, Enum):
    """공정 상태"""
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    WARNING = "warning"


class ProcessType(str, Enum):
    """공정 타입"""
    PRESS = "press"
    WELDING = "welding"
    BODY_ASSEMBLY = "body_assembly"
    PAINT = "paint"
    ENGINE = "engine"
    WINDSHIELD = "windshield"


class SimulationConfig(BaseModel):
    """시뮬레이션 설정"""
    name: str = Field(..., description="시뮬레이션 이름")
    scenario: str = Field(default="normal", description="시나리오 타입")
    
    # 공정별 파라미터
    press_params: Dict[str, float] = Field(
        default={
            "force": 1000.0,  # 톤
            "speed": 30.0,     # 회/분
            "temperature": 25.0  # °C
        }
    )
    welding_params: Dict[str, float] = Field(
        default={
            "current": 200.0,  # A
            "voltage": 24.0,   # V
            "speed": 50.0      # cm/min
        }
    )
    body_params: Dict[str, float] = Field(
        default={
            "tolerance": 0.1,  # mm
            "cycle_time": 120.0  # 초
        }
    )
    paint_params: Dict[str, float] = Field(
        default={
            "thickness": 100.0,  # μm
            "temperature": 60.0,  # °C
            "humidity": 50.0      # %
        }
    )
    engine_params: Dict[str, float] = Field(
        default={
            "torque": 250.0,  # Nm
            "rpm": 6000.0
        }
    )
    windshield_params: Dict[str, float] = Field(
        default={
            "pressure": 2.0,  # bar
            "temperature": 20.0  # °C
        }
    )


class ProcessState(BaseModel):
    """개별 공정 상태"""
    process_type: ProcessType
    status: ProcessStatus
    progress: float = Field(ge=0.0, le=100.0, description="진행률 (%)")
    cycle_time: float = Field(description="사이클 타임 (초)")
    quality_score: float = Field(ge=0.0, le=100.0, description="품질 점수")
    defect_rate: float = Field(ge=0.0, le=100.0, description="불량률 (%)")
    utilization: float = Field(ge=0.0, le=100.0, description="가동률 (%)")
    current_params: Dict[str, float]

    # 추가 메트릭
    units_processed: int = 0
    units_failed: int = 0
    total_time: float = 0.0

    # 검사 이미지
    inspection_image: Optional[str] = Field(default=None, description="검사 이미지 경로")

    # 불량 정보
    last_defect_info: Optional[Dict[str, Any]] = Field(default=None, description="마지막 불량 상세 정보")


class SimulationState(BaseModel):
    """전체 시뮬레이션 상태"""
    simulation_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    is_running: bool = False
    simulation_speed: float = 1.0
    simulation_time: float = 0.0  # 시뮬레이션 경과 시간 (초)
    
    # 공정별 상태
    processes: Dict[ProcessType, ProcessState]
    
    # 전체 메트릭
    overall_quality: float = Field(ge=0.0, le=100.0)
    throughput: float = Field(description="처리량 (units/hour)")
    total_cost: float = Field(description="총 비용")
    oee: float = Field(ge=0.0, le=100.0, description="종합설비효율")
    
    # 생산 통계
    total_units_produced: int = 0
    total_units_failed: int = 0
    current_wip: int = 0  # Work In Progress


class ProcessMetrics(BaseModel):
    """공정 메트릭"""
    timestamp: datetime = Field(default_factory=datetime.now)
    
    # KPI
    oee: float = Field(description="Overall Equipment Effectiveness")
    availability: float = Field(description="가용성 (%)")
    performance: float = Field(description="성능 (%)")
    quality: float = Field(description="품질 (%)")
    
    # 처리량
    throughput: float = Field(description="처리량 (units/hour)")
    cycle_time_avg: float = Field(description="평균 사이클 타임 (초)")
    
    # 품질
    quality_rate: float = Field(description="품질률 (%)")
    defect_rate: float = Field(description="불량률 (%)")
    
    # 비용
    cost_per_unit: float = Field(description="단위당 비용")
    total_cost: float = Field(description="총 비용")
    
    # 공정별 세부 메트릭
    process_metrics: Dict[ProcessType, Dict[str, float]]


class OptimizationObjective(str, Enum):
    """최적화 목표"""
    MAXIMIZE_QUALITY = "maximize_quality"
    MAXIMIZE_SPEED = "maximize_speed"
    MINIMIZE_COST = "minimize_cost"
    BALANCED = "balanced"


class OptimizationRequest(BaseModel):
    """최적화 요청"""
    objectives: List[OptimizationObjective] = Field(
        default=[OptimizationObjective.BALANCED]
    )
    current_params: Dict[str, Dict[str, float]]
    constraints: Optional[Dict[str, Any]] = None
    generations: Optional[int] = Field(default=50, ge=10, le=200)
    population_size: Optional[int] = Field(default=100, ge=20, le=500)


class OptimizationResult(BaseModel):
    """최적화 결과"""
    optimization_id: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)
    
    # 최적화된 파라미터
    optimized_params: Dict[str, Dict[str, float]]
    
    # 예상 성능
    predicted_quality: float
    predicted_speed: float
    predicted_cost: float
    
    # 개선율
    quality_improvement: float = Field(description="품질 개선률 (%)")
    speed_improvement: float = Field(description="속도 개선률 (%)")
    cost_reduction: float = Field(description="비용 절감률 (%)")
    
    # 파레토 프론티어
    pareto_frontier: List[Dict[str, float]]
    
    # 추천사항
    recommendations: List[str]
    
    # 민감도 분석
    sensitivity: Dict[str, float]


class ScenarioComparison(BaseModel):
    """시나리오 비교"""
    scenarios: List[SimulationState]
    comparison_metrics: Dict[str, Any]
    recommendations: List[str]


class HistoricalData(BaseModel):
    """히스토리 데이터"""
    timestamps: List[datetime]
    quality_scores: List[float]
    throughputs: List[float]
    costs: List[float]
    oee_values: List[float]
