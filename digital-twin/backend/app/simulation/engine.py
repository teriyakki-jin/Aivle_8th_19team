"""
생산 라인 시뮬레이션 엔진
"""

import time
import random
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
import threading

from app.models.schemas import (
    SimulationConfig,
    SimulationState,
    ProcessState,
    ProcessType,
    ProcessStatus,
    ProcessMetrics
)
from app.simulation.processes.press import PressSimulator
from app.simulation.processes.welding import WeldingSimulator
from app.simulation.processes.body_assembly import BodyAssemblySimulator
from app.simulation.processes.paint import PaintSimulator
from app.simulation.processes.engine import EngineSimulator
from app.simulation.processes.windshield import WindshieldSimulator
from app.simulation.ml_client import ml_client

logger = logging.getLogger(__name__)


class ProductionLineSimulator:
    """생산 라인 전체 시뮬레이터"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.is_running = False
        self.is_paused = False
        self.simulation_speed = 1.0
        self.simulation_time = 0.0
        self.start_time = None
        
        # 공정 시뮬레이터 초기화
        self.processes = {
            ProcessType.PRESS: PressSimulator(config.get('press_params', {})),
            ProcessType.WELDING: WeldingSimulator(config.get('welding_params', {})),
            ProcessType.BODY_ASSEMBLY: BodyAssemblySimulator(config.get('body_params', {})),
            ProcessType.PAINT: PaintSimulator(config.get('paint_params', {})),
            ProcessType.ENGINE: EngineSimulator(config.get('engine_params', {})),
            ProcessType.WINDSHIELD: WindshieldSimulator(config.get('windshield_params', {}))
        }
        
        # 생산 통계
        self.total_units_produced = 0
        self.total_units_failed = 0
        self.current_wip = 0
        
        # 히스토리 데이터
        self.history = {
            'timestamps': [],
            'quality': [],
            'throughput': [],
            'cost': [],
            'oee': []
        }
        
        # 시뮬레이션 스레드
        self.simulation_thread: Optional[threading.Thread] = None
        self.lock = threading.RLock()  # RLock으로 변경 (재진입 가능)
    
    def start(self):
        """시뮬레이션 시작"""
        if not self.is_running:
            self.is_running = True
            self.is_paused = False
            self.start_time = time.time()

            # 첫 번째 공정(Welding) 자동 시작 (Press 모델 없으므로 건너뜀)
            self.processes[ProcessType.WELDING].start_cycle()

            # 시뮬레이션 스레드 시작
            self.simulation_thread = threading.Thread(target=self._run_simulation, daemon=True)
            self.simulation_thread.start()
    
    def pause(self):
        """시뮬레이션 일시정지"""
        self.is_paused = True
    
    def resume(self):
        """시뮬레이션 재개"""
        self.is_paused = False
    
    def stop(self):
        """시뮬레이션 정지"""
        self.is_running = False
        self.is_paused = False
        if self.simulation_thread:
            self.simulation_thread.join(timeout=2.0)
    
    def reset(self):
        """시뮬레이션 리셋"""
        self.stop()
        self.simulation_time = 0.0
        self.total_units_produced = 0
        self.total_units_failed = 0
        self.current_wip = 0
        
        # 모든 공정 리셋
        for process in self.processes.values():
            process.reset()
        
        # 히스토리 초기화
        self.history = {
            'timestamps': [],
            'quality': [],
            'throughput': [],
            'cost': [],
            'oee': []
        }
    
    def set_speed(self, speed: float):
        """시뮬레이션 속도 설정"""
        self.simulation_speed = speed
    
    def update_parameters(self, params: Dict[str, Any]):
        """파라미터 업데이트"""
        with self.lock:
            for process_name, process_params in params.items():
                process_type = ProcessType(process_name)
                if process_type in self.processes:
                    self.processes[process_type].update_parameters(process_params)
    
    def _run_simulation(self):
        """시뮬레이션 메인 루프"""
        last_update = time.time()
        
        while self.is_running:
            if self.is_paused:
                time.sleep(0.1)
                continue
            
            current_time = time.time()
            delta_time = (current_time - last_update) * self.simulation_speed
            last_update = current_time
            
            with self.lock:
                # 시뮬레이션 시간 업데이트
                self.simulation_time += delta_time
                
                # 각 공정 업데이트
                for process in self.processes.values():
                    process.update(delta_time)
                
                # 공정 간 연계 처리
                self._process_workflow()
                
                # 통계 업데이트
                self._update_statistics()
                
                # 히스토리 기록 (5초마다)
                if int(self.simulation_time) % 5 == 0:
                    self._record_history()
            
            # CPU 사용률 조절
            time.sleep(0.05)  # 20 FPS
    
    def _process_workflow(self):
        """공정 간 워크플로우 처리 (ML 서비스 연동)"""
        # 간단한 순차 처리 모델
        # Welding -> Body Assembly -> Paint -> Engine -> Windshield (Press 제외)

        process_order = [
            # ProcessType.PRESS,  # Press 모델 없으므로 제외
            ProcessType.WELDING,
            ProcessType.BODY_ASSEMBLY,
            ProcessType.PAINT,
            ProcessType.ENGINE,
            ProcessType.WINDSHIELD
        ]

        for i, process_type in enumerate(process_order):
            process = self.processes[process_type]

            # 공정 완료 시 다음 공정으로 전달
            if process.status == ProcessStatus.COMPLETED:
                # ML 서비스로 품질 검사
                is_defect = self._check_quality_with_ml(process_type, process)

                if not is_defect:
                    # 정상품
                    if i < len(process_order) - 1:
                        # 다음 공정으로 전달
                        next_process = self.processes[process_order[i + 1]]
                        if next_process.status == ProcessStatus.IDLE:
                            next_process.start_cycle()
                    else:
                        # 마지막 공정 완료 - 생산 완료 및 새 사이클 시작
                        self.total_units_produced += 1
                        # 첫 공정 다시 시작 (연속 생산)
                        first_process = self.processes[process_order[0]]
                        if first_process.status == ProcessStatus.IDLE:
                            first_process.start_cycle()
                else:
                    # 불량품 - 해당 라인 새로 시작
                    self.total_units_failed += 1
                    process.units_failed += 1
                    # 첫 공정 다시 시작
                    first_process = self.processes[process_order[0]]
                    if first_process.status == ProcessStatus.IDLE:
                        first_process.start_cycle()

                # 현재 공정 리셋
                process.complete_cycle()

    def _check_quality_with_ml(self, process_type: ProcessType, process) -> bool:
        """ML 서비스를 사용하여 품질 검사 (불량이면 True 반환)"""
        import concurrent.futures

        def call_ml_api():
            try:
                if process_type == ProcessType.WELDING:
                    result = ml_client.predict_welding()
                    is_defect = result.get("status") == "defect" or len(result.get("defects", [])) > 0
                    return is_defect, result

                elif process_type == ProcessType.BODY_ASSEMBLY:
                    result = ml_client.predict_body_assembly("door")
                    is_defect = result.get("pass_fail") == "FAIL"
                    return is_defect, result

                elif process_type == ProcessType.PAINT:
                    result = ml_client.predict_paint()
                    is_defect = result.get("status") == "defect" or len(result.get("defects", [])) > 0
                    return is_defect, result

                else:
                    # Engine, Windshield, Press: 랜덤 방식
                    return None, None
            except Exception as e:
                logger.error(f"ML API error: {e}")
                return None, None

        # 별도 스레드에서 ML 호출 (타임아웃 2초)
        defect_info = None
        try:
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(call_ml_api)
                ml_result, ml_response = future.result(timeout=2.0)

                if ml_result is not None:
                    is_defect = ml_result
                    logger.info(f"ML Result - {process_type.value}: defect={is_defect}")

                    # 불량인 경우 상세 정보 저장
                    if is_defect and ml_response:
                        defect_info = self._extract_defect_info(process_type, ml_response, process.current_image)
                else:
                    # ML 결과 없으면 랜덤
                    is_defect = random.random() < (process.defect_rate / 100)
                    if is_defect:
                        defect_info = {
                            "process": process_type.value,
                            "reason": "랜덤 불량 (ML 서비스 미연결)",
                            "defects": [],
                            "image": process.current_image
                        }
        except concurrent.futures.TimeoutError:
            logger.warning(f"ML timeout for {process_type.value}, using random")
            is_defect = random.random() < (process.defect_rate / 100)
            if is_defect:
                defect_info = {
                    "process": process_type.value,
                    "reason": "랜덤 불량 (ML 타임아웃)",
                    "defects": [],
                    "image": process.current_image
                }
        except Exception as e:
            logger.error(f"ML check failed: {e}")
            is_defect = random.random() < (process.defect_rate / 100)

        # 불량 정보 저장
        if is_defect:
            process.set_defect_info(defect_info)
            process.quality_score = max(0, process.quality_score - 5)
        else:
            process.set_defect_info(None)
            process.quality_score = min(100, process.quality_score + 1)

        return is_defect

    def _extract_defect_info(self, process_type: ProcessType, ml_response: dict, image_path: str) -> dict:
        """ML 응답에서 불량 정보 추출"""
        defect_info = {
            "process": process_type.value,
            "image": image_path,
            "timestamp": datetime.now().isoformat()
        }

        if process_type == ProcessType.WELDING:
            defects = ml_response.get("defects", [])
            defect_info["reason"] = "용접 결함 검출"
            defect_info["defects"] = defects
            defect_info["defect_types"] = list(set(d.get("class", "unknown") for d in defects))
            defect_info["count"] = len(defects)

        elif process_type == ProcessType.BODY_ASSEMBLY:
            detections = ml_response.get("detections", [])
            defect_info["reason"] = "차체 조립 불량"
            defect_info["pass_fail"] = ml_response.get("pass_fail", "FAIL")
            defect_info["detections"] = detections
            defect_info["missing_parts"] = ml_response.get("missing_parts", [])

        elif process_type == ProcessType.PAINT:
            defects = ml_response.get("defects", [])
            defect_info["reason"] = "도장 결함 검출"
            defect_info["defects"] = defects
            defect_info["defect_types"] = list(set(d.get("class", "unknown") for d in defects))
            defect_info["count"] = len(defects)

        return defect_info
    
    def _update_statistics(self):
        """통계 업데이트"""
        # WIP 계산
        self.current_wip = sum(
            1 for p in self.processes.values()
            if p.status in [ProcessStatus.RUNNING, ProcessStatus.WARNING]
        )
    
    def _record_history(self):
        """히스토리 기록"""
        state = self.get_state()
        
        self.history['timestamps'].append(datetime.now())
        self.history['quality'].append(state.overall_quality)
        self.history['throughput'].append(state.throughput)
        self.history['cost'].append(state.total_cost)
        self.history['oee'].append(state.oee)
        
        # 최대 1000개 포인트만 유지
        if len(self.history['timestamps']) > 1000:
            for key in self.history:
                self.history[key] = self.history[key][-1000:]
    
    def get_state(self) -> SimulationState:
        """현재 시뮬레이션 상태 반환"""
        with self.lock:
            # 공정별 상태 수집
            process_states = {}
            for process_type, process in self.processes.items():
                process_states[process_type] = process.get_state()
            
            # 전체 메트릭 계산
            overall_quality = sum(p.quality_score for p in process_states.values()) / len(process_states)
            
            # 처리량 계산 (units/hour)
            if self.simulation_time > 0:
                throughput = (self.total_units_produced / self.simulation_time) * 3600
            else:
                throughput = 0.0
            
            # 총 비용 계산
            total_cost = sum(
                p.units_processed * 100  # 임시: 단위당 100원
                for p in process_states.values()
            )
            
            # OEE 계산
            availability = sum(p.utilization for p in process_states.values()) / len(process_states)
            performance = min(100.0, throughput / 10 * 100)  # 임시: 목표 10 units/hour
            quality = 100 - (self.total_units_failed / max(1, self.total_units_produced + self.total_units_failed) * 100)
            oee = (availability * performance * quality) / 10000
            
            return SimulationState(
                simulation_id=str(id(self)),
                timestamp=datetime.now(),
                is_running=self.is_running,
                simulation_speed=self.simulation_speed,
                simulation_time=self.simulation_time,
                processes=process_states,
                overall_quality=overall_quality,
                throughput=throughput,
                total_cost=total_cost,
                oee=oee,
                total_units_produced=self.total_units_produced,
                total_units_failed=self.total_units_failed,
                current_wip=self.current_wip
            )
    
    def get_metrics(self) -> ProcessMetrics:
        """공정 메트릭 반환"""
        state = self.get_state()
        
        # 공정별 메트릭
        process_metrics = {}
        for process_type, process_state in state.processes.items():
            process_metrics[process_type] = {
                'quality_score': process_state.quality_score,
                'cycle_time': process_state.cycle_time,
                'utilization': process_state.utilization,
                'defect_rate': process_state.defect_rate
            }
        
        # 평균 사이클 타임
        cycle_times = [p.cycle_time for p in state.processes.values()]
        avg_cycle_time = sum(cycle_times) / len(cycle_times)
        
        # 품질률
        quality_rate = 100 - (state.total_units_failed / max(1, state.total_units_produced + state.total_units_failed) * 100)
        defect_rate = 100 - quality_rate
        
        # 단위당 비용
        cost_per_unit = state.total_cost / max(1, state.total_units_produced)
        
        return ProcessMetrics(
            oee=state.oee,
            availability=sum(p.utilization for p in state.processes.values()) / len(state.processes),
            performance=min(100.0, state.throughput / 10 * 100),
            quality=quality_rate,
            throughput=state.throughput,
            cycle_time_avg=avg_cycle_time,
            quality_rate=quality_rate,
            defect_rate=defect_rate,
            cost_per_unit=cost_per_unit,
            total_cost=state.total_cost,
            process_metrics=process_metrics
        )
    
    def get_metrics_history(self, limit: int = 100):
        """메트릭 히스토리 반환"""
        with self.lock:
            return {
                'timestamps': [t.isoformat() for t in self.history['timestamps'][-limit:]],
                'quality': self.history['quality'][-limit:],
                'throughput': self.history['throughput'][-limit:],
                'cost': self.history['cost'][-limit:],
                'oee': self.history['oee'][-limit:]
            }
