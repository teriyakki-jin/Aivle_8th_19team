"""
Digital Twin Automotive - FastAPI Backend
자동차 제조 공정 디지털 트윈 시뮬레이션 백엔드
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import uvicorn
from datetime import datetime
import uuid

from app.simulation.engine import ProductionLineSimulator
from app.simulation.optimizer import GeneticOptimizer, ParameterSensitivityAnalyzer
from app.models.schemas import (
    SimulationConfig,
    SimulationState,
    OptimizationRequest,
    OptimizationResult,
    ProcessMetrics,
    ScenarioComparison
)

app = FastAPI(
    title="Digital Twin Automotive API",
    description="자동차 제조 공정 디지털 트윈 시뮬레이션 API",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 전역 시뮬레이터 인스턴스
simulators: Dict[str, ProductionLineSimulator] = {}
optimization_results: Dict[str, OptimizationResult] = {}


@app.get("/")
def read_root():
    """API 루트 엔드포인트"""
    return {
        "message": "Digital Twin Automotive API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_simulations": len(simulators)
    }


# ==================== 시뮬레이션 API ====================

@app.post("/api/simulation/create", response_model=Dict[str, str])
def create_simulation(config: SimulationConfig):
    """
    새로운 시뮬레이션 생성
    
    Args:
        config: 시뮬레이션 설정
        
    Returns:
        simulation_id: 생성된 시뮬레이션 ID
    """
    simulation_id = str(uuid.uuid4())
    simulator = ProductionLineSimulator(config.dict())
    simulators[simulation_id] = simulator
    
    return {
        "simulation_id": simulation_id,
        "status": "created",
        "message": "시뮬레이션이 생성되었습니다"
    }


@app.post("/api/simulation/{simulation_id}/start")
def start_simulation(simulation_id: str):
    """시뮬레이션 시작"""
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    simulator.start()
    
    return {
        "simulation_id": simulation_id,
        "status": "running",
        "message": "시뮬레이션이 시작되었습니다"
    }


@app.post("/api/simulation/{simulation_id}/pause")
def pause_simulation(simulation_id: str):
    """시뮬레이션 일시정지"""
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    simulator.pause()
    
    return {
        "simulation_id": simulation_id,
        "status": "paused",
        "message": "시뮬레이션이 일시정지되었습니다"
    }


@app.post("/api/simulation/{simulation_id}/stop")
def stop_simulation(simulation_id: str):
    """시뮬레이션 정지"""
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    simulator.stop()
    
    return {
        "simulation_id": simulation_id,
        "status": "stopped",
        "message": "시뮬레이션이 정지되었습니다"
    }


@app.post("/api/simulation/{simulation_id}/reset")
def reset_simulation(simulation_id: str):
    """시뮬레이션 리셋"""
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    simulator.reset()
    
    return {
        "simulation_id": simulation_id,
        "status": "reset",
        "message": "시뮬레이션이 리셋되었습니다"
    }


@app.get("/api/simulation/{simulation_id}/state", response_model=SimulationState)
def get_simulation_state(simulation_id: str):
    """
    현재 시뮬레이션 상태 조회
    
    Returns:
        SimulationState: 현재 시뮬레이션 상태
    """
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    return simulator.get_state()


@app.post("/api/simulation/{simulation_id}/update-params")
def update_simulation_params(simulation_id: str, params: Dict[str, Any]):
    """
    시뮬레이션 파라미터 업데이트
    
    Args:
        simulation_id: 시뮬레이션 ID
        params: 업데이트할 파라미터
    """
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    simulator.update_parameters(params)
    
    return {
        "simulation_id": simulation_id,
        "status": "updated",
        "message": "파라미터가 업데이트되었습니다",
        "updated_params": params
    }


@app.post("/api/simulation/{simulation_id}/speed")
def set_simulation_speed(simulation_id: str, speed: float):
    """
    시뮬레이션 속도 설정 (1x, 2x, 5x, 10x)
    
    Args:
        simulation_id: 시뮬레이션 ID
        speed: 시뮬레이션 속도 배수
    """
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    if speed not in [1, 2, 5, 10]:
        raise HTTPException(status_code=400, detail="속도는 1, 2, 5, 10 중 하나여야 합니다")
    
    simulator = simulators[simulation_id]
    simulator.set_speed(speed)
    
    return {
        "simulation_id": simulation_id,
        "speed": speed,
        "message": f"시뮬레이션 속도가 {speed}x로 설정되었습니다"
    }


@app.delete("/api/simulation/{simulation_id}")
def delete_simulation(simulation_id: str):
    """시뮬레이션 삭제"""
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    del simulators[simulation_id]
    
    return {
        "simulation_id": simulation_id,
        "status": "deleted",
        "message": "시뮬레이션이 삭제되었습니다"
    }


# ==================== 최적화 API ====================

@app.post("/api/optimization/analyze", response_model=OptimizationResult)
def run_optimization(request: OptimizationRequest):
    """
    최적화 분석 실행
    
    Args:
        request: 최적화 요청 (목표, 제약조건 등)
        
    Returns:
        OptimizationResult: 최적화 결과
    """
    optimizer = GeneticOptimizer(
        objectives=request.objectives,
        constraints=request.constraints
    )
    
    result = optimizer.optimize(
        current_params=request.current_params,
        generations=request.generations or 50,
        population_size=request.population_size or 100
    )
    
    # 결과 저장
    optimization_id = str(uuid.uuid4())
    optimization_results[optimization_id] = result
    result.optimization_id = optimization_id
    
    return result


@app.get("/api/optimization/{optimization_id}", response_model=OptimizationResult)
def get_optimization_result(optimization_id: str):
    """최적화 결과 조회"""
    if optimization_id not in optimization_results:
        raise HTTPException(status_code=404, detail="최적화 결과를 찾을 수 없습니다")
    
    return optimization_results[optimization_id]


@app.post("/api/optimization/sensitivity")
def analyze_sensitivity(params: Dict[str, float]):
    """
    파라미터 민감도 분석
    
    Args:
        params: 분석할 파라미터
        
    Returns:
        민감도 분석 결과
    """
    analyzer = ParameterSensitivityAnalyzer()
    sensitivity = analyzer.analyze(params)
    
    return {
        "sensitivity": sensitivity,
        "most_sensitive": max(sensitivity.items(), key=lambda x: x[1]),
        "least_sensitive": min(sensitivity.items(), key=lambda x: x[1])
    }


# ==================== 메트릭 API ====================

@app.get("/api/metrics/{simulation_id}", response_model=ProcessMetrics)
def get_process_metrics(simulation_id: str):
    """
    공정 메트릭 조회
    
    Returns:
        ProcessMetrics: 공정별 메트릭
    """
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    return simulator.get_metrics()


@app.get("/api/metrics/{simulation_id}/history")
def get_metrics_history(simulation_id: str, limit: int = 100):
    """
    메트릭 히스토리 조회
    
    Args:
        simulation_id: 시뮬레이션 ID
        limit: 조회할 데이터 포인트 수
        
    Returns:
        메트릭 히스토리
    """
    if simulation_id not in simulators:
        raise HTTPException(status_code=404, detail="시뮬레이션을 찾을 수 없습니다")
    
    simulator = simulators[simulation_id]
    return simulator.get_metrics_history(limit)


# ==================== 시나리오 비교 API ====================

@app.post("/api/scenarios/compare", response_model=ScenarioComparison)
def compare_scenarios(scenario_ids: List[str]):
    """
    여러 시나리오 비교
    
    Args:
        scenario_ids: 비교할 시뮬레이션 ID 리스트 (최대 3개)
        
    Returns:
        ScenarioComparison: 시나리오 비교 결과
    """
    if len(scenario_ids) > 3:
        raise HTTPException(status_code=400, detail="최대 3개의 시나리오만 비교할 수 있습니다")
    
    scenarios = []
    for sid in scenario_ids:
        if sid not in simulators:
            raise HTTPException(status_code=404, detail=f"시뮬레이션 {sid}를 찾을 수 없습니다")
        scenarios.append(simulators[sid].get_state())
    
    # 비교 분석
    comparison = {
        "scenarios": scenarios,
        "comparison_metrics": _calculate_comparison_metrics(scenarios),
        "recommendations": _generate_recommendations(scenarios)
    }
    
    return comparison


def _calculate_comparison_metrics(scenarios: List[SimulationState]) -> Dict[str, Any]:
    """시나리오 비교 메트릭 계산"""
    metrics = {
        "quality": [s.overall_quality for s in scenarios],
        "speed": [s.throughput for s in scenarios],
        "cost": [s.total_cost for s in scenarios],
        "oee": [s.oee for s in scenarios]
    }
    
    return {
        "metrics": metrics,
        "best_quality": max(range(len(scenarios)), key=lambda i: scenarios[i].overall_quality),
        "best_speed": max(range(len(scenarios)), key=lambda i: scenarios[i].throughput),
        "best_cost": min(range(len(scenarios)), key=lambda i: scenarios[i].total_cost)
    }


def _generate_recommendations(scenarios: List[SimulationState]) -> List[str]:
    """시나리오 기반 추천사항 생성"""
    recommendations = []
    
    # 품질이 가장 좋은 시나리오
    best_quality_idx = max(range(len(scenarios)), key=lambda i: scenarios[i].overall_quality)
    recommendations.append(f"시나리오 {best_quality_idx + 1}이 품질 면에서 가장 우수합니다")
    
    # 속도가 가장 빠른 시나리오
    best_speed_idx = max(range(len(scenarios)), key=lambda i: scenarios[i].throughput)
    recommendations.append(f"시나리오 {best_speed_idx + 1}이 처리량 면에서 가장 우수합니다")
    
    # 비용이 가장 낮은 시나리오
    best_cost_idx = min(range(len(scenarios)), key=lambda i: scenarios[i].total_cost)
    recommendations.append(f"시나리오 {best_cost_idx + 1}이 비용 면에서 가장 효율적입니다")
    
    return recommendations


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
