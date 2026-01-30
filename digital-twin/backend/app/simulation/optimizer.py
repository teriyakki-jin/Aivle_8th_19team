"""
최적화 엔진 - 유전 알고리즘 기반
"""

import random
import numpy as np
from typing import Dict, List, Tuple, Any
from app.models.schemas import OptimizationObjective, OptimizationResult
from datetime import datetime


class GeneticOptimizer:
    """유전 알고리즘 기반 최적화"""
    
    def __init__(self, objectives: List[OptimizationObjective], constraints: Dict[str, Any] = None):
        self.objectives = objectives
        self.constraints = constraints or {}
        
        # 파라미터 범위 정의
        self.param_ranges = {
            'press_params': {
                'force': (800, 1200),
                'speed': (20, 40),
                'temperature': (20, 30)
            },
            'welding_params': {
                'current': (150, 250),
                'voltage': (20, 28),
                'speed': (40, 60)
            },
            'body_params': {
                'tolerance': (0.05, 0.15),
                'cycle_time': (100, 140)
            },
            'paint_params': {
                'thickness': (80, 120),
                'temperature': (55, 65),
                'humidity': (40, 60)
            },
            'engine_params': {
                'torque': (200, 300),
                'rpm': (5000, 7000)
            },
            'windshield_params': {
                'pressure': (1.5, 2.5),
                'temperature': (18, 22)
            }
        }
    
    def optimize(
        self,
        current_params: Dict[str, Dict[str, float]],
        generations: int = 50,
        population_size: int = 100
    ) -> OptimizationResult:
        """최적화 실행"""
        
        # 초기 개체군 생성
        population = self._create_initial_population(population_size, current_params)
        
        best_individual = None
        best_fitness = float('-inf')
        pareto_frontier = []
        
        # 세대 진화
        for generation in range(generations):
            # 적합도 평가
            fitness_scores = [self._evaluate_fitness(ind) for ind in population]
            
            # 최고 개체 추적
            max_fitness_idx = np.argmax(fitness_scores)
            if fitness_scores[max_fitness_idx] > best_fitness:
                best_fitness = fitness_scores[max_fitness_idx]
                best_individual = population[max_fitness_idx].copy()
            
            # 파레토 프론티어 업데이트
            pareto_frontier = self._update_pareto_frontier(population, pareto_frontier)
            
            # 선택
            selected = self._selection(population, fitness_scores, population_size // 2)
            
            # 교차
            offspring = self._crossover(selected, population_size - len(selected))
            
            # 돌연변이
            offspring = [self._mutate(ind) for ind in offspring]
            
            # 새로운 개체군
            population = selected + offspring
        
        # 최적 파라미터
        optimized_params = best_individual
        
        # 성능 예측
        predicted_quality, predicted_speed, predicted_cost = self._predict_performance(optimized_params)
        current_quality, current_speed, current_cost = self._predict_performance(current_params)
        
        # 개선율 계산
        quality_improvement = ((predicted_quality - current_quality) / current_quality) * 100
        speed_improvement = ((predicted_speed - current_speed) / current_speed) * 100
        cost_reduction = ((current_cost - predicted_cost) / current_cost) * 100
        
        # 추천사항 생성
        recommendations = self._generate_recommendations(
            current_params,
            optimized_params,
            quality_improvement,
            speed_improvement,
            cost_reduction
        )
        
        # 민감도 분석
        sensitivity = ParameterSensitivityAnalyzer().analyze(optimized_params)
        
        return OptimizationResult(
            optimized_params=optimized_params,
            predicted_quality=predicted_quality,
            predicted_speed=predicted_speed,
            predicted_cost=predicted_cost,
            quality_improvement=quality_improvement,
            speed_improvement=speed_improvement,
            cost_reduction=cost_reduction,
            pareto_frontier=pareto_frontier,
            recommendations=recommendations,
            sensitivity=sensitivity
        )
    
    def _create_initial_population(
        self,
        size: int,
        current_params: Dict[str, Dict[str, float]]
    ) -> List[Dict[str, Dict[str, float]]]:
        """초기 개체군 생성"""
        population = []
        
        # 현재 파라미터를 첫 개체로 추가
        population.append(current_params.copy())
        
        # 나머지는 랜덤 생성
        for _ in range(size - 1):
            individual = {}
            for process, params in self.param_ranges.items():
                individual[process] = {}
                for param_name, (min_val, max_val) in params.items():
                    individual[process][param_name] = random.uniform(min_val, max_val)
            population.append(individual)
        
        return population
    
    def _evaluate_fitness(self, individual: Dict[str, Dict[str, float]]) -> float:
        """적합도 평가"""
        quality, speed, cost = self._predict_performance(individual)
        
        # 목표에 따라 가중치 조정
        if OptimizationObjective.MAXIMIZE_QUALITY in self.objectives:
            fitness = quality * 0.6 + speed * 0.2 - cost * 0.2
        elif OptimizationObjective.MAXIMIZE_SPEED in self.objectives:
            fitness = quality * 0.2 + speed * 0.6 - cost * 0.2
        elif OptimizationObjective.MINIMIZE_COST in self.objectives:
            fitness = quality * 0.2 + speed * 0.2 - cost * 0.6
        else:  # BALANCED
            fitness = quality * 0.4 + speed * 0.3 - cost * 0.3
        
        return fitness
    
    def _predict_performance(
        self,
        params: Dict[str, Dict[str, float]]
    ) -> Tuple[float, float, float]:
        """성능 예측 (품질, 속도, 비용)"""
        
        # 간단한 모델 - 실제로는 더 복잡한 ML 모델 사용 가능
        quality_scores = []
        cycle_times = []
        costs = []
        
        # Press
        press = params.get('press_params', {})
        force_dev = abs(press.get('force', 1000) - 1000) / 1000
        temp_dev = abs(press.get('temperature', 25) - 25) / 25
        press_quality = 98 - (force_dev + temp_dev) * 10
        press_time = 45 * (1000 / press.get('force', 1000)) * (30 / press.get('speed', 30))
        press_cost = press.get('force', 1000) * 0.1 + press.get('speed', 30) * 2
        
        quality_scores.append(press_quality)
        cycle_times.append(press_time)
        costs.append(press_cost)
        
        # Welding
        welding = params.get('welding_params', {})
        current_dev = abs(welding.get('current', 200) - 200) / 200
        voltage_dev = abs(welding.get('voltage', 24) - 24) / 24
        welding_quality = 96 - (current_dev + voltage_dev) * 15
        welding_time = 90 * (4800 / (welding.get('current', 200) * welding.get('voltage', 24)))
        welding_cost = welding.get('current', 200) * 0.5 + welding.get('voltage', 24) * 3
        
        quality_scores.append(welding_quality)
        cycle_times.append(welding_time)
        costs.append(welding_cost)
        
        # Body Assembly
        body = params.get('body_params', {})
        tolerance_dev = abs(body.get('tolerance', 0.1) - 0.1) / 0.1
        body_quality = 97 - tolerance_dev * 20
        body_time = body.get('cycle_time', 120)
        body_cost = 150 + body.get('cycle_time', 120) * 0.5
        
        quality_scores.append(body_quality)
        cycle_times.append(body_time)
        costs.append(body_cost)
        
        # Paint
        paint = params.get('paint_params', {})
        paint_temp_dev = abs(paint.get('temperature', 60) - 60) / 60
        humidity_dev = abs(paint.get('humidity', 50) - 50) / 50
        thickness_dev = abs(paint.get('thickness', 100) - 100) / 100
        paint_quality = 94 - (paint_temp_dev + humidity_dev + thickness_dev) * 12
        paint_time = 180 * (paint.get('thickness', 100) / 100)
        paint_cost = paint.get('thickness', 100) * 2 + paint.get('temperature', 60) * 1.5
        
        quality_scores.append(paint_quality)
        cycle_times.append(paint_time)
        costs.append(paint_cost)
        
        # Engine
        engine = params.get('engine_params', {})
        torque_dev = abs(engine.get('torque', 250) - 250) / 250
        rpm_dev = abs(engine.get('rpm', 6000) - 6000) / 6000
        engine_quality = 97 - (torque_dev + rpm_dev) * 10
        engine_time = 150 * ((engine.get('torque', 250) / 250 + engine.get('rpm', 6000) / 6000) / 2)
        engine_cost = engine.get('torque', 250) * 0.8 + engine.get('rpm', 6000) * 0.02
        
        quality_scores.append(engine_quality)
        cycle_times.append(engine_time)
        costs.append(engine_cost)
        
        # Windshield
        windshield = params.get('windshield_params', {})
        pressure_dev = abs(windshield.get('pressure', 2) - 2) / 2
        ws_temp_dev = abs(windshield.get('temperature', 20) - 20) / 20
        ws_quality = 98 - (pressure_dev + ws_temp_dev) * 15
        ws_time = 60 * (2 / windshield.get('pressure', 2))
        ws_cost = windshield.get('pressure', 2) * 20 + 50
        
        quality_scores.append(ws_quality)
        cycle_times.append(ws_time)
        costs.append(ws_cost)
        
        # 전체 평균
        avg_quality = sum(quality_scores) / len(quality_scores)
        total_time = sum(cycle_times)
        speed = 3600 / total_time  # units per hour
        total_cost = sum(costs)
        
        return avg_quality, speed, total_cost
    
    def _selection(
        self,
        population: List[Dict],
        fitness_scores: List[float],
        num_selected: int
    ) -> List[Dict]:
        """토너먼트 선택"""
        selected = []
        for _ in range(num_selected):
            # 토너먼트 크기 3
            tournament_indices = random.sample(range(len(population)), 3)
            tournament_fitness = [fitness_scores[i] for i in tournament_indices]
            winner_idx = tournament_indices[np.argmax(tournament_fitness)]
            selected.append(population[winner_idx].copy())
        return selected
    
    def _crossover(self, parents: List[Dict], num_offspring: int) -> List[Dict]:
        """교차"""
        offspring = []
        for _ in range(num_offspring):
            parent1, parent2 = random.sample(parents, 2)
            child = {}
            for process in parent1.keys():
                child[process] = {}
                for param in parent1[process].keys():
                    # 50% 확률로 각 부모에서 선택
                    if random.random() < 0.5:
                        child[process][param] = parent1[process][param]
                    else:
                        child[process][param] = parent2[process][param]
            offspring.append(child)
        return offspring
    
    def _mutate(self, individual: Dict, mutation_rate: float = 0.1) -> Dict:
        """돌연변이"""
        mutated = {}
        for process, params in individual.items():
            mutated[process] = {}
            for param_name, value in params.items():
                if random.random() < mutation_rate:
                    # 범위 내에서 랜덤 변이
                    min_val, max_val = self.param_ranges[process][param_name]
                    mutated[process][param_name] = random.uniform(min_val, max_val)
                else:
                    mutated[process][param_name] = value
        return mutated
    
    def _update_pareto_frontier(
        self,
        population: List[Dict],
        current_frontier: List[Dict]
    ) -> List[Dict]:
        """파레토 프론티어 업데이트"""
        all_solutions = population + current_frontier
        pareto = []
        
        for solution in all_solutions:
            quality, speed, cost = self._predict_performance(solution)
            is_dominated = False
            
            for other in all_solutions:
                if other == solution:
                    continue
                other_q, other_s, other_c = self._predict_performance(other)
                
                # 다른 솔루션이 모든 목표에서 우세한지 확인
                if (other_q >= quality and other_s >= speed and other_c <= cost and
                    (other_q > quality or other_s > speed or other_c < cost)):
                    is_dominated = True
                    break
            
            if not is_dominated:
                pareto.append({
                    'quality': quality,
                    'speed': speed,
                    'cost': cost,
                    'params': solution
                })
        
        # 중복 제거 및 최대 20개로 제한
        unique_pareto = []
        seen = set()
        for p in pareto:
            key = (round(p['quality'], 2), round(p['speed'], 2), round(p['cost'], 2))
            if key not in seen:
                seen.add(key)
                unique_pareto.append(p)
        
        return unique_pareto[:20]
    
    def _generate_recommendations(
        self,
        current: Dict,
        optimized: Dict,
        quality_imp: float,
        speed_imp: float,
        cost_red: float
    ) -> List[str]:
        """추천사항 생성"""
        recommendations = []
        
        if quality_imp > 5:
            recommendations.append(f"품질을 {quality_imp:.1f}% 개선할 수 있습니다")
        if speed_imp > 5:
            recommendations.append(f"처리 속도를 {speed_imp:.1f}% 향상시킬 수 있습니다")
        if cost_red > 5:
            recommendations.append(f"비용을 {cost_red:.1f}% 절감할 수 있습니다")
        
        # 주요 파라미터 변경사항
        for process in optimized.keys():
            for param, opt_value in optimized[process].items():
                curr_value = current.get(process, {}).get(param, 0)
                if abs(opt_value - curr_value) / curr_value > 0.1:  # 10% 이상 변경
                    change_pct = ((opt_value - curr_value) / curr_value) * 100
                    recommendations.append(
                        f"{process}의 {param}을(를) {change_pct:+.1f}% 조정하세요"
                    )
        
        if not recommendations:
            recommendations.append("현재 파라미터가 이미 최적에 가깝습니다")
        
        return recommendations[:10]  # 최대 10개


class ParameterSensitivityAnalyzer:
    """파라미터 민감도 분석"""
    
    def analyze(self, params: Dict[str, Dict[str, float]]) -> Dict[str, float]:
        """민감도 분석 실행"""
        sensitivity = {}
        optimizer = GeneticOptimizer([OptimizationObjective.BALANCED])
        
        # 기준 성능
        base_quality, base_speed, base_cost = optimizer._predict_performance(params)
        base_score = base_quality * 0.4 + base_speed * 0.3 - base_cost * 0.3
        
        # 각 파라미터를 10% 변경했을 때의 영향 측정
        for process, process_params in params.items():
            for param_name, value in process_params.items():
                # 파라미터 10% 증가
                modified_params = self._copy_and_modify(params, process, param_name, value * 1.1)
                new_quality, new_speed, new_cost = optimizer._predict_performance(modified_params)
                new_score = new_quality * 0.4 + new_speed * 0.3 - new_cost * 0.3
                
                # 민감도 = 성능 변화율 / 파라미터 변화율
                score_change = abs(new_score - base_score) / base_score
                param_change = 0.1
                sensitivity[f"{process}.{param_name}"] = score_change / param_change
        
        return sensitivity
    
    def _copy_and_modify(
        self,
        params: Dict,
        process: str,
        param_name: str,
        new_value: float
    ) -> Dict:
        """파라미터 복사 및 수정"""
        import copy
        modified = copy.deepcopy(params)
        modified[process][param_name] = new_value
        return modified
