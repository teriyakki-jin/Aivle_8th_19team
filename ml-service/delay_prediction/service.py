"""
납기 예측 서비스
Delay Prediction Service

PostgreSQL에서 실시간으로 주문/이벤트 데이터를 가져와서 납기 지연을 예측합니다.
"""

import os
import numpy as np
import pandas as pd
from datetime import datetime
import pickle
from typing import Dict, List, Optional
import traceback

try:
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import roc_auc_score, f1_score, mean_squared_error, r2_score
    import xgboost as xgb
except ImportError:
    print("⚠ Warning: ML libraries not installed")

try:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Engine
except ImportError:
    print("⚠ Warning: SQLAlchemy not installed")


class DelayPredictionService:
    """
    납기 예측 서비스
    
    PostgreSQL에서 실시간 데이터를 가져와 납기 지연을 예측합니다.
    """
    
    def __init__(self, db_url: str = None, model_path: str = None):
        """
        초기화
        
        Args:
            db_url: PostgreSQL 연결 URL
            model_path: 사전 훈련된 모델 파일 경로
        """
        if db_url is None:
            db_url = os.getenv('DATABASE_URL', 
                              'postgresql://postgres:postgres@localhost:5432/automobile_risk')
        
        self.db_url = db_url
        self.engine: Optional[Engine] = None
        self.classifier = None
        self.regressor = None
        self.feature_names = []
        self.is_model_loaded = False
        
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
        
        # 모델 로드 시도
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
    
    def connect(self) -> bool:
        """데이터베이스 연결"""
        try:
            self.engine = create_engine(self.db_url)
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            print(f"✗ DB 연결 실패: {e}")
            return False
    
    def extract_orders(self) -> pd.DataFrame:
        """완료된 주문 데이터 추출"""
        if not self.engine:
            if not self.connect():
                raise Exception("데이터베이스 연결 실패")
        
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
        
        df = pd.read_sql(query, self.engine)
        
        # 실제 지연 시간 계산
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
        
        return df
    
    def extract_events(self) -> pd.DataFrame:
        """공정 이벤트 데이터 추출"""
        if not self.engine:
            if not self.connect():
                raise Exception("데이터베이스 연결 실패")
        
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
        
        df = pd.read_sql(query, self.engine)
        return df
    
    def calculate_process_scores(self, order_id: int, events_df: pd.DataFrame) -> Dict:
        """공정별 점수 계산"""
        order_events = events_df[events_df['order_id'] == order_id]
        
        if len(order_events) == 0:
            return {
                'total_score': 0.0,
                'process_scores': {},
                'event_count': 0
            }
        
        process_scores = {}
        
        for _, event in order_events.iterrows():
            base_score = self.event_scores.get(event['event_type'], 2.0)
            process_weight = self.process_weights.get(event['process'], 1.0)
            severity = event['severity'] if pd.notna(event['severity']) else 1
            severity_mult = self.severity_multipliers.get(severity, 1.0)
            qty = event['qty_affected'] if pd.notna(event['qty_affected']) else 1
            qty_mult = 1.0 + (qty - 1) * 0.2
            unresolved_mult = 1.5 if pd.isna(event['resolved_at']) else 1.0
            line_hold_mult = 2.0 if event['is_line_hold'] else 1.0
            
            score = (base_score * process_weight * severity_mult * 
                    qty_mult * unresolved_mult * line_hold_mult)
            
            process = event['process']
            process_scores[process] = process_scores.get(process, 0.0) + score
        
        sorted_scores = sorted(process_scores.values(), reverse=True)
        total_score = sum(s * (0.3 ** i) for i, s in enumerate(sorted_scores))
        
        return {
            'total_score': round(total_score, 2),
            'process_scores': {k: round(v, 2) for k, v in process_scores.items()},
            'event_count': len(order_events)
        }
    
    def prepare_features(self, orders_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
        """특성 엔지니어링"""
        features_list = []
        
        for _, order in orders_df.iterrows():
            order_id = order['order_id']
            order_events = events_df[events_df['order_id'] == order_id]
            
            score_result = self.calculate_process_scores(order_id, events_df)
            
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
        features_df = features_df.fillna(0)
        
        return features_df
    
    def train_model(self, features_df: pd.DataFrame, orders_df: pd.DataFrame) -> Dict:
        """모델 훈련"""
        completed_orders = orders_df[orders_df['order_status'] == 'COMPLETED'].copy()
        
        if len(completed_orders) < 20:
            raise ValueError(f"완료된 주문이 {len(completed_orders)}개뿐입니다. 최소 20개 필요")
        
        train_features = features_df.loc[completed_orders['order_id']]
        orders_indexed = completed_orders.set_index('order_id')
        y_class = (orders_indexed['actual_delay_hours'] > 0).astype(int)
        y_reg = orders_indexed['actual_delay_hours'].clip(lower=0)
        
        y_class = y_class.loc[train_features.index]
        y_reg = y_reg.loc[train_features.index]
        
        test_size = min(0.2, 10 / len(train_features))
        X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
            train_features, y_class, y_reg, test_size=test_size, random_state=42
        )
        
        # Stage 1: 분류
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
        
        # Stage 2: 회귀
        delay_mask_train = y_reg_train > 0
        delay_mask_test = y_reg_test > 0
        
        if delay_mask_train.sum() < 5:
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
            'rmse': float(np.sqrt(mean_squared_error(y_reg_test[delay_mask_test], y_reg_pred))),
            'mae': float(np.mean(np.abs(y_reg_test[delay_mask_test] - y_reg_pred))),
            'r2': float(r2_score(y_reg_test[delay_mask_test], y_reg_pred)) if len(y_reg_test[delay_mask_test]) > 1 else 0.0
        }
        
        self.feature_names = train_features.columns.tolist()
        self.is_model_loaded = True
        
        return {
            'classification': class_metrics,
            'regression': reg_metrics,
            'train_samples': len(X_train),
            'test_samples': len(X_test)
        }
    
    def predict(self, order_id: int, features_df: pd.DataFrame, 
                orders_df: pd.DataFrame, events_df: pd.DataFrame) -> Dict:
        """납기 지연 예측"""
        if not self.is_model_loaded:
            raise ValueError("모델이 훈련되지 않았습니다.")
        
        X = features_df.loc[[order_id]]
        
        delay_probability = float(self.classifier.predict_proba(X)[0, 1])
        expected_delay_hours = float(max(0, self.regressor.predict(X)[0]))
        
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
            'order_id': int(order_id),
            'delay_probability': round(delay_probability, 3),
            'expected_delay_hours': round(expected_delay_hours, 2),
            'risk_level': risk_level,
            'total_score': score_result['total_score'],
            'process_scores': score_result['process_scores'],
            'event_count': score_result['event_count'],
            'order_status': order_info['order_status'],
            'order_qty': int(order_info['order_qty']),
            'vehicle_model': order_info.get('vehicle_model', 'Unknown'),
            'actual_delay_hours': round(float(order_info['actual_delay_hours']), 2) if order_info['order_status'] == 'COMPLETED' else None
        }
    
    def predict_all(self) -> Dict:
        """모든 주문에 대한 예측"""
        try:
            orders_df = self.extract_orders()
            events_df = self.extract_events()
            features_df = self.prepare_features(orders_df, events_df)
            
            # 모델이 없으면 훈련
            if not self.is_model_loaded:
                completed_count = (orders_df['order_status'] == 'COMPLETED').sum()
                if completed_count >= 20:
                    self.train_model(features_df, orders_df)
                else:
                    return {
                        'status': 'insufficient_data',
                        'message': f'완료된 주문이 {completed_count}개뿐입니다. 최소 20개 필요',
                        'total_orders': len(orders_df),
                        'completed_orders': completed_count
                    }
            
            # 모든 주문 예측
            predictions = []
            for order_id in orders_df['order_id']:
                try:
                    pred = self.predict(order_id, features_df, orders_df, events_df)
                    predictions.append(pred)
                except Exception as e:
                    print(f"주문 {order_id} 예측 실패: {e}")
            
            # 통계 계산
            if predictions:
                delay_hours = [p['expected_delay_hours'] for p in predictions]
                risk_counts = {}
                for p in predictions:
                    risk = p['risk_level']
                    risk_counts[risk] = risk_counts.get(risk, 0) + 1
                
                # 공정별 지연 기여도
                process_breakdown = {}
                for p in predictions:
                    for process, score in p.get('process_scores', {}).items():
                        if process not in process_breakdown:
                            process_breakdown[process] = {
                                'total_score': 0.0,
                                'count': 0
                            }
                        process_breakdown[process]['total_score'] += score
                        process_breakdown[process]['count'] += 1
                
                process_breakdown_list = [
                    {
                        'process': process,
                        'total_score': round(data['total_score'], 2),
                        'count': data['count'],
                        'avg_score': round(data['total_score'] / data['count'], 2)
                    }
                    for process, data in process_breakdown.items()
                ]
                process_breakdown_list.sort(key=lambda x: x['total_score'], reverse=True)
                
                return {
                    'status': 'success',
                    'total_orders': len(predictions),
                    'max_delay_hours': round(max(delay_hours), 2) if delay_hours else 0,
                    'avg_delay_hours': round(sum(delay_hours) / len(delay_hours), 2) if delay_hours else 0,
                    'risk_distribution': risk_counts,
                    'process_breakdown': process_breakdown_list,
                    'orders': predictions
                }
            else:
                return {
                    'status': 'no_predictions',
                    'message': '예측 가능한 주문이 없습니다.',
                    'orders': []
                }
                
        except Exception as e:
            print(f"예측 실패: {e}")
            traceback.print_exc()
            return {
                'status': 'error',
                'message': str(e)
            }
    
    def save_model(self, filepath: str):
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
    
    def load_model(self, filepath: str):
        """모델 로드"""
        try:
            with open(filepath, 'rb') as f:
                model_data = pickle.load(f)
            
            self.classifier = model_data['classifier']
            self.regressor = model_data['regressor']
            self.feature_names = model_data['feature_names']
            self.process_weights = model_data.get('process_weights', self.process_weights)
            self.event_scores = model_data.get('event_scores', self.event_scores)
            self.severity_multipliers = model_data.get('severity_multipliers', self.severity_multipliers)
            self.is_model_loaded = True
            
            print(f"✓ 모델 로드 성공: {filepath}")
            return True
        except Exception as e:
            print(f"✗ 모델 로드 실패: {e}")
            return False


# 전역 서비스 인스턴스
_service_instance: Optional[DelayPredictionService] = None


def get_service() -> DelayPredictionService:
    """전역 서비스 인스턴스 반환"""
    global _service_instance
    if _service_instance is None:
        _service_instance = DelayPredictionService()
    return _service_instance


def initialize_service(db_url: str = None, model_path: str = None):
    """서비스 초기화"""
    global _service_instance
    _service_instance = DelayPredictionService(db_url=db_url, model_path=model_path)
    return _service_instance
