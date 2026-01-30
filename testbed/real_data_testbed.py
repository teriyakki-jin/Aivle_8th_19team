"""
실제 데이터베이스 연동 납기 예측 테스트베드
Real Database Delay Prediction Testbed

PostgreSQL에서 실제 주문/이벤트 데이터를 가져와서 모델 훈련 및 예측을 수행합니다.
"""

import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime
import pickle
from typing import Dict, List, Tuple

# 상위 디렉토리의 ml-service 모듈 import
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, f1_score, mean_squared_error, r2_score
    import xgboost as xgb
    print("✓ ML 라이브러리 로드 성공")
except ImportError as e:
    print(f"⚠ 경고: {e}")
    print("  pip install xgboost scikit-learn")

try:
    from sqlalchemy import create_engine, text
    print("✓ SQLAlchemy 로드 성공")
except ImportError:
    print("⚠ SQLAlchemy 필요: pip install sqlalchemy psycopg2-binary")

try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    plt.rcParams['font.family'] = 'Malgun Gothic'
    plt.rcParams['axes.unicode_minus'] = False
    PLOT_ENABLED = True
except ImportError:
    PLOT_ENABLED = False
    print("⚠ 시각화 라이브러리 없음 (선택사항)")


class RealDataTestbed:
    """
    실제 데이터베이스 연동 납기 예측 테스트베드
    
    PostgreSQL에서 완료된 주문 데이터를 추출하여 모델 훈련 및 예측
    """
    
    def __init__(self, db_url: str = None):
        """
        초기화
        
        Args:
            db_url: PostgreSQL 연결 URL
                   예: "postgresql://user:password@localhost:5432/automobile_risk"
                   None이면 환경변수 DATABASE_URL 사용
        """
        if db_url is None:
            db_url = os.getenv('DATABASE_URL', 
                              'postgresql://user:password@localhost:5432/automobile_risk')
        
        self.db_url = db_url
        self.engine = None
        self.classifier = None
        self.regressor = None
        self.feature_names = []
        
        # 공정별 가중치
        self.process_weights = {
            'Press': 1.0,
            'Welding': 1.3,
            'Paint': 1.2,
            'Body_Assembly': 1.1,
            'Engine': 1.0,
            'Windshield': 0.9
        }
        
        # 이벤트 타입별 기본 점수
        self.event_scores = {
            'DEFECT': 2.0,
            'BREAKDOWN': 8.0,
            'LINE_HOLD': 4.0
        }
        
        # 심각도별 배수
        self.severity_multipliers = {
            0: 0.5,
            1: 1.0,
            2: 2.0,
            3: 4.0
        }
    
    def connect(self):
        """데이터베이스 연결"""
        try:
            self.engine = create_engine(self.db_url)
            # 연결 테스트
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✓ 데이터베이스 연결 성공")
            return True
        except Exception as e:
            print(f"✗ 데이터베이스 연결 실패: {e}")
            print("\n연결 정보:")
            print(f"  URL: {self.db_url}")
            print("\n해결 방법:")
            print("  1. PostgreSQL 서버가 실행 중인지 확인")
            print("  2. DATABASE_URL 환경변수 설정")
            print("  3. 또는 db_url 매개변수로 직접 전달")
            return False
    
    def extract_orders(self) -> pd.DataFrame:
        """
        완료된 주문 데이터 추출
        
        Returns:
            주문 데이터프레임
        """
        query = """
        SELECT 
            o.order_id,
            o.order_date,
            o.due_date,
            o.order_qty,
            o.order_status,
            vm.model_name as vehicle_model,
            MAX(pe.completed_at) as actual_completion_date
        FROM orders o
        LEFT JOIN vehicle_model vm ON o.vehicle_model_id = vm.vehicle_model_id
        LEFT JOIN order_production op ON o.order_id = op.order_id
        LEFT JOIN production p ON op.order_production_id = p.production_id
        LEFT JOIN process_execution pe ON p.production_id = pe.production_id
        WHERE o.order_status IN ('COMPLETED', 'IN_PROGRESS', 'PLANNED')
        GROUP BY o.order_id, o.order_date, o.due_date, o.order_qty, o.order_status, vm.model_name
        ORDER BY o.order_id
        """
        
        try:
            df = pd.read_sql(query, self.engine)
            
            # 실제 지연 시간 계산 (완료된 주문만)
            completed_mask = df['order_status'] == 'COMPLETED'
            df['actual_delay_hours'] = 0.0
            
            if completed_mask.sum() > 0:
                df.loc[completed_mask, 'actual_delay_hours'] = (
                    (pd.to_datetime(df.loc[completed_mask, 'actual_completion_date']) - 
                     pd.to_datetime(df.loc[completed_mask, 'due_date']))
                    .dt.total_seconds() / 3600.0
                ).clip(lower=0)
            
            # 계획 기간
            df['planned_days'] = (
                (pd.to_datetime(df['due_date']) - pd.to_datetime(df['order_date']))
                .dt.days
            )
            
            print(f"✓ {len(df)}개 주문 추출")
            print(f"  - 완료: {(df['order_status']=='COMPLETED').sum()}개")
            print(f"  - 진행중: {(df['order_status']=='IN_PROGRESS').sum()}개")
            print(f"  - 계획: {(df['order_status']=='PLANNED').sum()}개")
            
            if completed_mask.sum() > 0:
                delay_count = (df.loc[completed_mask, 'actual_delay_hours'] > 0).sum()
                print(f"  - 지연: {delay_count}개 ({delay_count/completed_mask.sum()*100:.1f}%)")
            
            return df
            
        except Exception as e:
            print(f"✗ 주문 데이터 추출 실패: {e}")
            raise
    
    def extract_events(self) -> pd.DataFrame:
        """
        공정 이벤트 데이터 추출
        
        Returns:
            이벤트 데이터프레임
        """
        query = """
        SELECT 
            pe.event_id,
            o.order_id,
            pe.process,
            pe.event_code,
            pe.event_type,
            pe.severity,
            pe.qty_affected,
            pe.occurred_at,
            pe.resolved_at,
            pe.is_line_hold
        FROM process_event pe
        JOIN production p ON pe.production_id = p.production_id
        JOIN order_production op ON p.production_id = op.order_production_id
        JOIN orders o ON op.order_id = o.order_id
        ORDER BY o.order_id, pe.occurred_at
        """
        
        try:
            df = pd.read_sql(query, self.engine)
            print(f"✓ {len(df)}개 이벤트 추출")
            
            if len(df) > 0:
                print(f"  - DEFECT: {(df['event_type']=='DEFECT').sum()}개")
                print(f"  - BREAKDOWN: {(df['event_type']=='BREAKDOWN').sum()}개")
                print(f"  - LINE_HOLD: {(df['event_type']=='LINE_HOLD').sum()}개")
                print(f"  - 미해결: {df['resolved_at'].isna().sum()}개")
            
            return df
            
        except Exception as e:
            print(f"✗ 이벤트 데이터 추출 실패: {e}")
            raise
    
    def calculate_process_scores(self, order_id: int, events_df: pd.DataFrame) -> Dict:
        """
        공정별 점수 계산 (샘플 테스트베드와 동일한 로직)
        """
        order_events = events_df[events_df['order_id'] == order_id]
        
        if len(order_events) == 0:
            return {
                'total_score': 0.0,
                'process_scores': {},
                'event_count': 0
            }
        
        process_scores = {}
        
        for _, event in order_events.iterrows():
            # 기본 점수
            base_score = self.event_scores.get(event['event_type'], 2.0)
            
            # 공정 가중치
            process_weight = self.process_weights.get(event['process'], 1.0)
            
            # 심각도 배수
            severity = event['severity'] if pd.notna(event['severity']) else 1
            severity_mult = self.severity_multipliers.get(severity, 1.0)
            
            # 수량 가중치
            qty = event['qty_affected'] if pd.notna(event['qty_affected']) else 1
            qty_mult = 1.0 + (qty - 1) * 0.2
            
            # 미해결 배수
            unresolved_mult = 1.5 if pd.isna(event['resolved_at']) else 1.0
            
            # 라인정지 배수
            line_hold_mult = 2.0 if event['is_line_hold'] else 1.0
            
            # 최종 점수
            score = (base_score * process_weight * severity_mult * 
                    qty_mult * unresolved_mult * line_hold_mult)
            
            process = event['process']
            process_scores[process] = process_scores.get(process, 0.0) + score
        
        # 총 점수 (병목 효과 반영)
        sorted_scores = sorted(process_scores.values(), reverse=True)
        total_score = sum(s * (0.3 ** i) for i, s in enumerate(sorted_scores))
        
        return {
            'total_score': round(total_score, 2),
            'process_scores': {k: round(v, 2) for k, v in process_scores.items()},
            'event_count': len(order_events)
        }
    
    def prepare_features(self, orders_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
        """
        특성 엔지니어링
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
                'total_score': score_result['total_score'],
                'total_events': len(order_events),
            }
            
            # 공정별 점수
            for process, score in score_result['process_scores'].items():
                feat[f'{process.lower()}_score'] = score
            
            # 이벤트 통계
            if len(order_events) > 0:
                feat['severity_sum'] = order_events['severity'].sum()
                feat['severity_max'] = order_events['severity'].max()
                feat['severity_mean'] = order_events['severity'].mean()
                feat['qty_affected_sum'] = order_events['qty_affected'].sum()
                feat['line_hold_count'] = order_events['is_line_hold'].sum()
                feat['unresolved_count'] = order_events['resolved_at'].isna().sum()
                
                # 이벤트 타입별
                for event_type in ['DEFECT', 'BREAKDOWN', 'LINE_HOLD']:
                    feat[f'{event_type.lower()}_count'] = len(
                        order_events[order_events['event_type'] == event_type]
                    )
            else:
                feat.update({
                    'severity_sum': 0, 'severity_max': 0, 'severity_mean': 0,
                    'qty_affected_sum': 0, 'line_hold_count': 0, 'unresolved_count': 0,
                    'defect_count': 0, 'breakdown_count': 0, 'line_hold_count': 0
                })
            
            features_list.append(feat)
        
        features_df = pd.DataFrame(features_list).set_index('order_id')
        
        # NaN 처리
        features_df = features_df.fillna(0)
        
        print(f"✓ 특성 개수: {features_df.shape[1]}개")
        print(f"✓ 주문 개수: {len(features_df)}개")
        
        return features_df
    
    def train_model(self, features_df: pd.DataFrame, orders_df: pd.DataFrame) -> Dict:
        """
        모델 훈련 (완료된 주문만 사용)
        
        독립변수 (X): 
            - order_qty, planned_days (기본 특성)
            - total_score, 공정별_score (점수 특성)
            - total_events, severity_*, qty_affected_* (이벤트 통계)
            - defect_count, breakdown_count, line_hold_count (타입별)
            
        종속변수 (Y):
            - y_class: 지연 여부 (0: 정상, 1: 지연)
            - y_reg: 지연 시간 (0.0 이상, 단위: 시간)
        """
        print(f"\n{'='*60}")
        print("모델 훈련")
        print(f"{'='*60}")
        
        # 완료된 주문만 필터링
        completed_orders = orders_df[orders_df['order_status'] == 'COMPLETED'].copy()
        
        if len(completed_orders) < 20:
            print(f"⚠ 경고: 완료된 주문이 {len(completed_orders)}개뿐입니다.")
            print("   최소 20개 이상의 완료된 주문이 필요합니다.")
            print("   샘플 데이터로 대체하거나 더 많은 데이터를 추가하세요.")
            return None
        
        # 완료된 주문의 특성만 선택
        train_features = features_df.loc[completed_orders['order_id']]
        
        # 타겟 생성
        # 종속변수 1: 지연 여부 (이진 분류)
        # - 0: 납기 내 완료 (actual_delay_hours <= 0)
        # - 1: 납기 초과 (actual_delay_hours > 0)
        orders_indexed = completed_orders.set_index('order_id')
        y_class = (orders_indexed['actual_delay_hours'] > 0).astype(int)
        
        # 종속변수 2: 지연 시간 (회귀)
        # - 0.0: 지연 없음
        # - 양수: 지연 시간 (단위: 시간)
        y_reg = orders_indexed['actual_delay_hours'].clip(lower=0)
        
        # 인덱스 정렬
        y_class = y_class.loc[train_features.index]
        y_reg = y_reg.loc[train_features.index]
        
        print(f"✓ 훈련 데이터: {len(train_features)}개")
        print(f"  - 지연: {y_class.sum()}개 ({y_class.mean()*100:.1f}%)")
        print(f"  - 정상: {(~y_class.astype(bool)).sum()}개")
        
        # 독립변수 (X) 정보 출력
        print(f"\n독립변수 (X): {train_features.shape[1]}개 특성")
        print(f"  샘플 특성: {', '.join(train_features.columns[:5].tolist())}...")
        print(f"\n종속변수 (Y):")
        print(f"  - y_class (지연 여부): 0(정상) 또는 1(지연)")
        print(f"  - y_reg (지연 시간): 0.0~{y_reg.max():.1f} 시간")
        
        # 학습/테스트 분할
        test_size = min(0.2, 10 / len(train_features))
        X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
            train_features, y_class, y_reg, test_size=test_size, random_state=42
        )
        
        print(f"✓ 학습 데이터: {len(X_train)}개")
        print(f"✓ 테스트 데이터: {len(X_test)}개")
        
        # Stage 1: 분류
        print("\n[Stage 1] 분류 모델 훈련")
        self.classifier = xgb.XGBClassifier(
            n_estimators=50,
            max_depth=4,
            learning_rate=0.1,
            random_state=42,
            eval_metric='logloss'
        )
        self.classifier.fit(X_train, y_class_train)
        
        y_class_pred = self.classifier.predict(X_test)
        y_class_proba = self.classifier.predict_proba(X_test)[:, 1]
        
        class_metrics = {
            'roc_auc': roc_auc_score(y_class_test, y_class_proba) if len(y_class_test.unique()) > 1 else 0.5,
            'f1': f1_score(y_class_test, y_class_pred) if y_class_test.sum() > 0 else 0.0,
            'accuracy': (y_class_pred == y_class_test).mean()
        }
        
        print(f"  ROC-AUC: {class_metrics['roc_auc']:.3f}")
        print(f"  F1-Score: {class_metrics['f1']:.3f}")
        print(f"  Accuracy: {class_metrics['accuracy']:.3f}")
        
        # Stage 2: 회귀
        print("\n[Stage 2] 회귀 모델 훈련")
        delay_mask_train = y_reg_train > 0
        delay_mask_test = y_reg_test > 0
        
        if delay_mask_train.sum() < 5:
            print("  ⚠ 지연 샘플 부족, 전체 데이터 사용")
            delay_mask_train = pd.Series(True, index=y_reg_train.index)
            delay_mask_test = pd.Series(True, index=y_reg_test.index)
        
        self.regressor = xgb.XGBRegressor(
            n_estimators=50,
            max_depth=4,
            learning_rate=0.1,
            random_state=42
        )
        self.regressor.fit(X_train[delay_mask_train], y_reg_train[delay_mask_train])
        
        y_reg_pred = self.regressor.predict(X_test[delay_mask_test])
        
        reg_metrics = {
            'rmse': np.sqrt(mean_squared_error(y_reg_test[delay_mask_test], y_reg_pred)),
            'mae': np.mean(np.abs(y_reg_test[delay_mask_test] - y_reg_pred)),
            'r2': r2_score(y_reg_test[delay_mask_test], y_reg_pred) if len(y_reg_test[delay_mask_test]) > 1 else 0.0
        }
        
        print(f"  RMSE: {reg_metrics['rmse']:.2f} 시간")
        print(f"  MAE: {reg_metrics['mae']:.2f} 시간")
        print(f"  R²: {reg_metrics['r2']:.3f}")
        
        self.feature_names = train_features.columns.tolist()
        
        # 특성 중요도 출력 (상위 10개)
        print(f"\n{'='*60}")
        print("특성 중요도 (Feature Importance)")
        print(f"{'='*60}")
        
        importance_df = pd.DataFrame({
            'feature': self.feature_names,
            'importance': self.classifier.feature_importances_
        }).sort_values('importance', ascending=False)
        
        print("상위 10개 중요 특성:")
        for i, row in importance_df.head(10).iterrows():
            print(f"  {row['feature']:25s}: {row['importance']:.4f}")
        
        return {
            'classification': class_metrics,
            'regression': reg_metrics,
            'feature_importance': importance_df
        }
    
    def predict(self, order_id: int, features_df: pd.DataFrame, 
                orders_df: pd.DataFrame, events_df: pd.DataFrame) -> Dict:
        """납기 지연 예측"""
        if self.classifier is None or self.regressor is None:
            raise ValueError("모델이 훈련되지 않았습니다.")
        
        X = features_df.loc[[order_id]]
        
        delay_probability = self.classifier.predict_proba(X)[0, 1]
        expected_delay_hours = max(0, self.regressor.predict(X)[0])
        
        # 위험도
        if expected_delay_hours < 4:
            risk_level = 'LOW'
        elif expected_delay_hours < 12:
            risk_level = 'MEDIUM'
        elif expected_delay_hours < 48:
            risk_level = 'HIGH'
        else:
            risk_level = 'CRITICAL'
        
        score_result = self.calculate_process_scores(order_id, events_df)
        order_info = orders_df[orders_df['order_id'] == order_id].iloc[0]
        
        return {
            'order_id': order_id,
            'delay_probability': round(delay_probability, 3),
            'expected_delay_hours': round(expected_delay_hours, 2),
            'risk_level': risk_level,
            'total_score': score_result['total_score'],
            'process_scores': score_result['process_scores'],
            'order_status': order_info['order_status'],
            'actual_delay_hours': round(order_info['actual_delay_hours'], 2) if order_info['order_status'] == 'COMPLETED' else None
        }
    
    def save_model(self, filepath: str = 'real_delay_model.pkl'):
        """모델 저장"""
        model_data = {
            'classifier': self.classifier,
            'regressor': self.regressor,
            'feature_names': self.feature_names,
            'process_weights': self.process_weights,
            'event_scores': self.event_scores
        }
        with open(filepath, 'wb') as f:
            pickle.dump(model_data, f)
        print(f"\n✓ 모델 저장: {filepath}")


def main():
    """메인 실행"""
    print("\n" + "="*60)
    print("  실제 데이터베이스 연동 납기 예측 테스트베드")
    print("  Real Database Delay Prediction Testbed")
    print("="*60)
    
    # DB 연결 정보 설정
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        print("\n⚠ DATABASE_URL 환경변수가 설정되지 않았습니다.")
        print("기본값 사용: postgresql://user:password@localhost:5432/automobile_risk")
        db_url = "postgresql://user:password@localhost:5432/automobile_risk"
    
    # 초기화
    testbed = RealDataTestbed(db_url)
    
    # DB 연결
    if not testbed.connect():
        print("\n데이터베이스 연결 실패. 프로그램을 종료합니다.")
        return None
    
    print(f"\n{'='*60}")
    print("데이터 추출")
    print(f"{'='*60}")
    
    # 데이터 추출
    orders_df = testbed.extract_orders()
    events_df = testbed.extract_events()
    
    # CSV 저장
    orders_df.to_csv('testbed/real_orders.csv', index=False, encoding='utf-8-sig')
    events_df.to_csv('testbed/real_events.csv', index=False, encoding='utf-8-sig')
    print("\n✓ 데이터 CSV 저장 완료")
    
    # 특성 엔지니어링
    features_df = testbed.prepare_features(orders_df, events_df)
    features_df.to_csv('testbed/real_features.csv', encoding='utf-8-sig')
    
    # 완료된 주문이 충분한지 확인
    completed_count = (orders_df['order_status'] == 'COMPLETED').sum()
    
    if completed_count < 20:
        print(f"\n⚠ 경고: 완료된 주문이 {completed_count}개뿐입니다.")
        print("모델 훈련을 위해 최소 20개 이상의 완료된 주문이 필요합니다.")
        print("\n데이터는 CSV로 저장되었습니다:")
        print("  - testbed/real_orders.csv")
        print("  - testbed/real_events.csv")
        print("  - testbed/real_features.csv")
        return testbed, features_df, orders_df, events_df, None
    
    # 모델 훈련
    metrics = testbed.train_model(features_df, orders_df)
    
    if metrics is None:
        return testbed, features_df, orders_df, events_df, None
    
    # 예측 예시
    print(f"\n{'='*60}")
    print("예측 결과 샘플")
    print(f"{'='*60}")
    
    # 몇 개 주문 예측
    sample_orders = orders_df.sample(min(5, len(orders_df)))['order_id'].tolist()
    
    for order_id in sample_orders:
        result = testbed.predict(order_id, features_df, orders_df, events_df)
        print(f"\n주문 #{result['order_id']} ({result['order_status']})")
        print(f"  지연 확률: {result['delay_probability']*100:.1f}%")
        print(f"  예상 지연: {result['expected_delay_hours']:.1f} 시간")
        if result['actual_delay_hours'] is not None:
            print(f"  실제 지연: {result['actual_delay_hours']:.1f} 시간")
        print(f"  위험도: {result['risk_level']}")
        print(f"  총 점수: {result['total_score']:.1f}")
    
    # 모델 저장
    testbed.save_model('testbed/real_delay_model.pkl')
    
    print(f"\n{'='*60}")
    print("✓ 실제 데이터 테스트베드 실행 완료!")
    print(f"{'='*60}")
    print("\n생성된 파일:")
    print("  - testbed/real_orders.csv: 실제 주문 데이터")
    print("  - testbed/real_events.csv: 실제 이벤트 데이터")
    print("  - testbed/real_features.csv: 특성 데이터")
    print("  - testbed/real_delay_model.pkl: 훈련된 모델")
    
    return testbed, features_df, orders_df, events_df, metrics


if __name__ == '__main__':
    testbed, features, orders, events, metrics = main()
