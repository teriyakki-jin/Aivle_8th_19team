"""
납기 예측 모델 테스트 베드 (Delay Prediction Testbed)

공정 이상이 누적될 경우 최종 납기가 지연될 확률과 예상 지연 시간을 예측합니다.
각 공정별로 점수화하여 지연 경과를 계산합니다.

기능:
1. 샘플 데이터 생성 (주문, 공정 이벤트)
2. 공정별 점수화 및 지연 계산
3. XGBoost 모델 훈련 (분류 + 회귀)
4. 예측 및 시각화
"""

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import pickle
import json
from typing import Dict, List, Tuple

# ML 라이브러리
try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, f1_score, mean_squared_error, r2_score
    import xgboost as xgb
    print("✓ ML 라이브러리 로드 성공")
except ImportError as e:
    print(f"⚠ 경고: {e}")
    print("  pip install xgboost scikit-learn")

# 시각화 (선택사항)
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    plt.rcParams['font.family'] = 'Malgun Gothic'  # 한글 폰트
    plt.rcParams['axes.unicode_minus'] = False
    PLOT_ENABLED = True
except ImportError:
    PLOT_ENABLED = False
    print("⚠ 시각화 라이브러리 없음 (선택사항)")


class DelayPredictionTestbed:
    """
    납기 예측 테스트베드
    
    주요 메서드:
    - generate_sample_data(): 샘플 데이터 생성
    - calculate_process_scores(): 공정별 점수 계산
    - train_model(): 모델 훈련
    - predict(): 지연 예측
    - visualize(): 결과 시각화
    """
    
    def __init__(self):
        self.classifier = None
        self.regressor = None
        self.feature_names = []
        
        # 공정 정의
        self.processes = ['Press', 'Welding', 'Paint', 'Body_Assembly', 'Engine', 'Windshield']
        
        # 이벤트 타입별 기본 점수
        self.event_scores = {
            'DEFECT': 2.0,        # 결함: 기본 2시간
            'BREAKDOWN': 8.0,     # 고장: 기본 8시간
            'LINE_HOLD': 4.0      # 라인정지: 기본 4시간
        }
        
        # 공정별 가중치 (병목 공정은 영향도 높음)
        self.process_weights = {
            'Press': 1.0,
            'Welding': 1.3,       # 용접은 병목 공정
            'Paint': 1.2,         # 도장도 중요
            'Body_Assembly': 1.1,
            'Engine': 1.0,
            'Windshield': 0.9
        }
        
        # 심각도별 배수
        self.severity_multipliers = {
            0: 0.5,   # 낮음
            1: 1.0,   # 보통
            2: 2.0,   # 높음
            3: 4.0    # 치명적
        }
    
    def generate_sample_data(self, n_orders: int = 200) -> Tuple[pd.DataFrame, pd.DataFrame]:
        """
        샘플 데이터 생성
        
        Args:
            n_orders: 생성할 주문 수
            
        Returns:
            (orders_df, events_df): 주문 데이터프레임, 이벤트 데이터프레임
        """
        print(f"\n{'='*60}")
        print(f"샘플 데이터 생성: {n_orders}개 주문")
        print(f"{'='*60}")
        
        np.random.seed(42)
        orders = []
        events = []
        
        base_date = datetime(2025, 1, 1)
        
        for order_id in range(1, n_orders + 1):
            # 주문 생성
            order_date = base_date + timedelta(days=np.random.randint(0, 180))
            planned_days = np.random.randint(10, 30)
            due_date = order_date + timedelta(days=planned_days)
            order_qty = np.random.choice([1, 2, 3, 5, 10], p=[0.4, 0.3, 0.2, 0.05, 0.05])
            
            # 실제 완료일 (일부는 지연)
            delay_prob = 0.3  # 30% 확률로 지연
            if np.random.random() < delay_prob:
                # 지연 발생
                actual_delay_hours = np.random.exponential(scale=8) + 2
                actual_completion = due_date + timedelta(hours=actual_delay_hours)
            else:
                # 정상
                actual_delay_hours = 0
                actual_completion = due_date - timedelta(hours=np.random.randint(1, 24))
            
            orders.append({
                'order_id': order_id,
                'order_date': order_date,
                'due_date': due_date,
                'order_qty': order_qty,
                'planned_days': planned_days,
                'actual_completion_date': actual_completion,
                'actual_delay_hours': max(0, actual_delay_hours)
            })
            
            # 이벤트 생성 (지연이 있는 주문은 더 많은 이벤트)
            if actual_delay_hours > 0:
                n_events = np.random.randint(2, 8)
            else:
                n_events = np.random.randint(0, 3)
            
            for _ in range(n_events):
                process = np.random.choice(self.processes)
                event_type = np.random.choice(['DEFECT', 'BREAKDOWN', 'LINE_HOLD'], 
                                              p=[0.6, 0.2, 0.2])
                severity = np.random.choice([0, 1, 2, 3], p=[0.3, 0.4, 0.2, 0.1])
                qty_affected = np.random.randint(1, min(order_qty + 1, 5))
                
                occurred_at = order_date + timedelta(
                    hours=np.random.randint(0, int(planned_days * 24))
                )
                
                # 해결 여부
                is_resolved = np.random.random() > 0.2  # 80% 해결
                resolved_at = (occurred_at + timedelta(hours=np.random.randint(1, 48))) if is_resolved else None
                
                events.append({
                    'order_id': order_id,
                    'process': process,
                    'event_type': event_type,
                    'severity': severity,
                    'qty_affected': qty_affected,
                    'occurred_at': occurred_at,
                    'resolved_at': resolved_at,
                    'is_line_hold': (event_type == 'LINE_HOLD')
                })
        
        orders_df = pd.DataFrame(orders)
        events_df = pd.DataFrame(events)
        
        print(f"✓ {len(orders_df)}개 주문 생성")
        print(f"✓ {len(events_df)}개 이벤트 생성")
        print(f"✓ 지연 주문: {(orders_df['actual_delay_hours'] > 0).sum()}개 ({(orders_df['actual_delay_hours'] > 0).mean()*100:.1f}%)")
        
        return orders_df, events_df
    
    def calculate_process_scores(self, order_id: int, events_df: pd.DataFrame) -> Dict:
        """
        공정별 점수 계산
        
        Args:
            order_id: 주문 ID
            events_df: 이벤트 데이터프레임
            
        Returns:
            {
                'total_score': 총 점수,
                'process_scores': {공정명: 점수},
                'event_details': [이벤트별 상세]
            }
        """
        order_events = events_df[events_df['order_id'] == order_id]
        
        if len(order_events) == 0:
            return {
                'total_score': 0.0,
                'process_scores': {p: 0.0 for p in self.processes},
                'event_details': []
            }
        
        process_scores = {p: 0.0 for p in self.processes}
        event_details = []
        
        for _, event in order_events.iterrows():
            # 기본 점수
            base_score = self.event_scores[event['event_type']]
            
            # 공정 가중치
            process_weight = self.process_weights.get(event['process'], 1.0)
            
            # 심각도 배수
            severity_mult = self.severity_multipliers[event['severity']]
            
            # 수량 가중치 (영향받은 수량이 많을수록 높음)
            qty_mult = 1.0 + (event['qty_affected'] - 1) * 0.2
            
            # 미해결 배수
            unresolved_mult = 1.5 if pd.isna(event['resolved_at']) else 1.0
            
            # 라인정지 배수
            line_hold_mult = 2.0 if event['is_line_hold'] else 1.0
            
            # 최종 점수 계산
            score = (base_score * 
                    process_weight * 
                    severity_mult * 
                    qty_mult * 
                    unresolved_mult * 
                    line_hold_mult)
            
            process_scores[event['process']] += score
            
            event_details.append({
                'process': event['process'],
                'event_type': event['event_type'],
                'severity': event['severity'],
                'base_score': base_score,
                'final_score': score,
                'multipliers': {
                    'process': process_weight,
                    'severity': severity_mult,
                    'qty': qty_mult,
                    'unresolved': unresolved_mult,
                    'line_hold': line_hold_mult
                }
            })
        
        # 총 점수 (공정 간 병목 효과 반영)
        # 가장 높은 공정은 100%, 두 번째는 30%, 세 번째는 10%...
        sorted_scores = sorted(process_scores.values(), reverse=True)
        total_score = sum(s * (0.3 ** i) for i, s in enumerate(sorted_scores))
        
        return {
            'total_score': round(total_score, 2),
            'process_scores': {k: round(v, 2) for k, v in process_scores.items()},
            'event_details': event_details
        }
    
    def prepare_features(self, orders_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
        """
        특성 엔지니어링
        
        Args:
            orders_df: 주문 데이터
            events_df: 이벤트 데이터
            
        Returns:
            특성 데이터프레임
        """
        print(f"\n{'='*60}")
        print("특성 엔지니어링")
        print(f"{'='*60}")
        
        features_list = []
        
        for _, order in orders_df.iterrows():
            order_id = order['order_id']
            order_events = events_df[events_df['order_id'] == order_id]
            
            # 공정별 점수 계산
            score_result = self.calculate_process_scores(order_id, events_df)
            
            # 기본 특성
            feat = {
                'order_id': order_id,
                'order_qty': order['order_qty'],
                'planned_days': order['planned_days'],
                
                # 점수 특성
                'total_score': score_result['total_score'],
            }
            
            # 공정별 점수
            for process in self.processes:
                feat[f'{process.lower()}_score'] = score_result['process_scores'][process]
            
            # 이벤트 통계
            feat['total_events'] = len(order_events)
            feat['severity_sum'] = order_events['severity'].sum() if len(order_events) > 0 else 0
            feat['severity_max'] = order_events['severity'].max() if len(order_events) > 0 else 0
            feat['severity_mean'] = order_events['severity'].mean() if len(order_events) > 0 else 0
            feat['qty_affected_sum'] = order_events['qty_affected'].sum() if len(order_events) > 0 else 0
            feat['line_hold_count'] = order_events['is_line_hold'].sum() if len(order_events) > 0 else 0
            feat['unresolved_count'] = order_events['resolved_at'].isna().sum() if len(order_events) > 0 else 0
            
            # 이벤트 타입별 개수
            for event_type in ['DEFECT', 'BREAKDOWN', 'LINE_HOLD']:
                feat[f'{event_type.lower()}_count'] = len(order_events[order_events['event_type'] == event_type])
            
            # 공정별 이벤트 개수
            for process in self.processes:
                feat[f'{process.lower()}_event_count'] = len(order_events[order_events['process'] == process])
            
            features_list.append(feat)
        
        features_df = pd.DataFrame(features_list)
        
        # order_id를 인덱스로
        features_df = features_df.set_index('order_id')
        
        print(f"✓ 특성 개수: {features_df.shape[1]}개")
        print(f"✓ 샘플 개수: {len(features_df)}개")
        
        return features_df
    
    def train_model(self, features_df: pd.DataFrame, orders_df: pd.DataFrame) -> Dict:
        """
        모델 훈련 (2단계: 분류 + 회귀)
        
        Args:
            features_df: 특성 데이터
            orders_df: 주문 데이터 (타겟 포함)
            
        Returns:
            평가 메트릭
        """
        print(f"\n{'='*60}")
        print("모델 훈련")
        print(f"{'='*60}")
        
        # 타겟 변수 생성
        orders_indexed = orders_df.set_index('order_id')
        y_class = (orders_indexed['actual_delay_hours'] > 0).astype(int)  # 지연 여부
        y_reg = orders_indexed['actual_delay_hours'].clip(lower=0)        # 지연 시간
        
        # 인덱스 정렬
        y_class = y_class.loc[features_df.index]
        y_reg = y_reg.loc[features_df.index]
        
        # 학습/테스트 분할
        X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
            features_df, y_class, y_reg, test_size=0.2, random_state=42
        )
        
        print(f"✓ 학습 데이터: {len(X_train)}개")
        print(f"✓ 테스트 데이터: {len(X_test)}개")
        
        # Stage 1: 분류 모델 (지연 여부)
        print("\n[Stage 1] 분류 모델 훈련 (지연 여부)")
        self.classifier = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42,
            eval_metric='logloss'
        )
        self.classifier.fit(X_train, y_class_train)
        
        y_class_pred = self.classifier.predict(X_test)
        y_class_proba = self.classifier.predict_proba(X_test)[:, 1]
        
        class_metrics = {
            'roc_auc': roc_auc_score(y_class_test, y_class_proba),
            'f1': f1_score(y_class_test, y_class_pred),
            'accuracy': (y_class_pred == y_class_test).mean()
        }
        
        print(f"  ROC-AUC: {class_metrics['roc_auc']:.3f}")
        print(f"  F1-Score: {class_metrics['f1']:.3f}")
        print(f"  Accuracy: {class_metrics['accuracy']:.3f}")
        
        # Stage 2: 회귀 모델 (지연 시간)
        print("\n[Stage 2] 회귀 모델 훈련 (지연 시간)")
        # 지연된 샘플만 사용
        delay_mask_train = y_reg_train > 0
        delay_mask_test = y_reg_test > 0
        
        if delay_mask_train.sum() < 10:
            print("  ⚠ 지연 샘플 부족, 전체 데이터 사용")
            delay_mask_train = pd.Series(True, index=y_reg_train.index)
            delay_mask_test = pd.Series(True, index=y_reg_test.index)
        
        self.regressor = xgb.XGBRegressor(
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            random_state=42
        )
        self.regressor.fit(X_train[delay_mask_train], y_reg_train[delay_mask_train])
        
        y_reg_pred = self.regressor.predict(X_test[delay_mask_test])
        
        reg_metrics = {
            'rmse': np.sqrt(mean_squared_error(y_reg_test[delay_mask_test], y_reg_pred)),
            'mae': np.mean(np.abs(y_reg_test[delay_mask_test] - y_reg_pred)),
            'r2': r2_score(y_reg_test[delay_mask_test], y_reg_pred)
        }
        
        print(f"  RMSE: {reg_metrics['rmse']:.2f} 시간")
        print(f"  MAE: {reg_metrics['mae']:.2f} 시간")
        print(f"  R²: {reg_metrics['r2']:.3f}")
        
        self.feature_names = features_df.columns.tolist()
        
        return {
            'classification': class_metrics,
            'regression': reg_metrics
        }
    
    def predict(self, order_id: int, features_df: pd.DataFrame, 
                orders_df: pd.DataFrame, events_df: pd.DataFrame) -> Dict:
        """
        납기 지연 예측
        
        Args:
            order_id: 주문 ID
            features_df: 특성 데이터
            orders_df: 주문 데이터
            events_df: 이벤트 데이터
            
        Returns:
            예측 결과
        """
        if self.classifier is None or self.regressor is None:
            raise ValueError("모델이 훈련되지 않았습니다. train_model()을 먼저 실행하세요.")
        
        # 특성 추출
        X = features_df.loc[[order_id]]
        
        # 분류 예측 (지연 확률)
        delay_probability = self.classifier.predict_proba(X)[0, 1]
        
        # 회귀 예측 (지연 시간)
        expected_delay_hours = self.regressor.predict(X)[0]
        expected_delay_hours = max(0, expected_delay_hours)
        
        # 위험도 분류
        if expected_delay_hours < 4:
            risk_level = 'LOW'
        elif expected_delay_hours < 12:
            risk_level = 'MEDIUM'
        elif expected_delay_hours < 48:
            risk_level = 'HIGH'
        else:
            risk_level = 'CRITICAL'
        
        # 공정별 상세 점수
        score_result = self.calculate_process_scores(order_id, events_df)
        
        # 실제값 (테스트용)
        order_info = orders_df[orders_df['order_id'] == order_id].iloc[0]
        actual_delay = order_info['actual_delay_hours']
        
        return {
            'order_id': order_id,
            'delay_probability': round(delay_probability, 3),
            'expected_delay_hours': round(expected_delay_hours, 2),
            'risk_level': risk_level,
            'total_score': score_result['total_score'],
            'process_scores': score_result['process_scores'],
            'actual_delay_hours': round(actual_delay, 2),
            'prediction_error': round(abs(expected_delay_hours - actual_delay), 2)
        }
    
    def visualize_results(self, features_df: pd.DataFrame, orders_df: pd.DataFrame):
        """결과 시각화"""
        if not PLOT_ENABLED:
            print("⚠ 시각화 라이브러리가 설치되지 않았습니다.")
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        # 1. 지연 분포
        orders_df['delay_flag'] = (orders_df['actual_delay_hours'] > 0).astype(int)
        ax1 = axes[0, 0]
        orders_df['delay_flag'].value_counts().plot(kind='bar', ax=ax1, color=['green', 'red'])
        ax1.set_title('지연 발생 분포', fontsize=14, fontweight='bold')
        ax1.set_xlabel('지연 여부 (0: 정상, 1: 지연)')
        ax1.set_ylabel('주문 수')
        ax1.set_xticklabels(['정상', '지연'], rotation=0)
        
        # 2. 지연 시간 히스토그램
        ax2 = axes[0, 1]
        delay_orders = orders_df[orders_df['actual_delay_hours'] > 0]
        ax2.hist(delay_orders['actual_delay_hours'], bins=20, color='orange', alpha=0.7)
        ax2.set_title('지연 시간 분포', fontsize=14, fontweight='bold')
        ax2.set_xlabel('지연 시간 (시간)')
        ax2.set_ylabel('주문 수')
        ax2.axvline(x=delay_orders['actual_delay_hours'].mean(), color='red', 
                   linestyle='--', label=f'평균: {delay_orders["actual_delay_hours"].mean():.1f}h')
        ax2.legend()
        
        # 3. 점수 vs 실제 지연
        ax3 = axes[1, 0]
        merged = features_df.join(orders_df.set_index('order_id')['actual_delay_hours'])
        ax3.scatter(merged['total_score'], merged['actual_delay_hours'], alpha=0.5, color='blue')
        ax3.set_title('점수 vs 실제 지연 시간', fontsize=14, fontweight='bold')
        ax3.set_xlabel('총 점수')
        ax3.set_ylabel('실제 지연 시간 (시간)')
        
        # 추세선
        z = np.polyfit(merged['total_score'], merged['actual_delay_hours'], 1)
        p = np.poly1d(z)
        ax3.plot(merged['total_score'], p(merged['total_score']), "r--", alpha=0.8, label='추세선')
        ax3.legend()
        
        # 4. 공정별 평균 점수
        ax4 = axes[1, 1]
        process_cols = [col for col in features_df.columns if col.endswith('_score') and col != 'total_score']
        process_means = features_df[process_cols].mean().sort_values(ascending=False)
        process_means.plot(kind='barh', ax=ax4, color='skyblue')
        ax4.set_title('공정별 평균 점수', fontsize=14, fontweight='bold')
        ax4.set_xlabel('평균 점수')
        
        plt.tight_layout()
        plt.savefig('testbed/delay_prediction_results.png', dpi=150, bbox_inches='tight')
        print("\n✓ 시각화 저장: testbed/delay_prediction_results.png")
        plt.show()
    
    def save_model(self, filepath: str = 'testbed/delay_model.pkl'):
        """모델 저장"""
        model_data = {
            'classifier': self.classifier,
            'regressor': self.regressor,
            'feature_names': self.feature_names,
            'process_weights': self.process_weights,
            'event_scores': self.event_scores,
            'severity_multipliers': self.severity_multipliers
        }
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"\n✓ 모델 저장: {filepath}")
    
    def load_model(self, filepath: str = 'testbed/delay_model.pkl'):
        """모델 로드"""
        with open(filepath, 'rb') as f:
            model_data = pickle.load(f)
        
        self.classifier = model_data['classifier']
        self.regressor = model_data['regressor']
        self.feature_names = model_data['feature_names']
        self.process_weights = model_data['process_weights']
        self.event_scores = model_data['event_scores']
        self.severity_multipliers = model_data['severity_multipliers']
        print(f"✓ 모델 로드: {filepath}")


def main():
    """메인 실행"""
    print("\n" + "="*60)
    print("  납기 예측 모델 테스트베드")
    print("  Delay Prediction Testbed")
    print("="*60)
    
    # 1. 초기화
    testbed = DelayPredictionTestbed()
    
    # 2. 샘플 데이터 생성
    orders_df, events_df = testbed.generate_sample_data(n_orders=200)
    
    # 3. 특성 엔지니어링
    features_df = testbed.prepare_features(orders_df, events_df)
    
    # 4. 모델 훈련
    metrics = testbed.train_model(features_df, orders_df)
    
    # 5. 예측 예시 (몇 개 주문)
    print(f"\n{'='*60}")
    print("예측 결과 샘플")
    print(f"{'='*60}")
    
    sample_orders = orders_df.sample(5)['order_id'].tolist()
    
    for order_id in sample_orders:
        result = testbed.predict(order_id, features_df, orders_df, events_df)
        print(f"\n주문 #{result['order_id']}")
        print(f"  지연 확률: {result['delay_probability']*100:.1f}%")
        print(f"  예상 지연: {result['expected_delay_hours']:.1f} 시간")
        print(f"  실제 지연: {result['actual_delay_hours']:.1f} 시간")
        print(f"  위험도: {result['risk_level']}")
        print(f"  예측 오차: {result['prediction_error']:.1f} 시간")
        print(f"  총 점수: {result['total_score']:.1f}")
    
    # 6. 시각화
    testbed.visualize_results(features_df, orders_df)
    
    # 7. 모델 저장
    testbed.save_model()
    
    # 8. 데이터 저장 (선택사항)
    orders_df.to_csv('testbed/orders_sample.csv', index=False, encoding='utf-8-sig')
    events_df.to_csv('testbed/events_sample.csv', index=False, encoding='utf-8-sig')
    features_df.to_csv('testbed/features.csv', index=True, encoding='utf-8-sig')
    
    print(f"\n{'='*60}")
    print("✓ 테스트베드 실행 완료!")
    print(f"{'='*60}")
    print("\n생성된 파일:")
    print("  - testbed/orders_sample.csv: 주문 데이터")
    print("  - testbed/events_sample.csv: 이벤트 데이터")
    print("  - testbed/features.csv: 특성 데이터")
    print("  - testbed/delay_model.pkl: 훈련된 모델")
    print("  - testbed/delay_prediction_results.png: 시각화 결과")
    
    return testbed, features_df, orders_df, events_df, metrics


if __name__ == '__main__':
    testbed, features, orders, events, metrics = main()
