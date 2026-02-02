"""
납기 예측 서비스
Backend DB에서 주문 및 이벤트 데이터를 읽어 납기 지연을 예측
"""
import os
import pickle
import traceback
from typing import Dict, Optional, List
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sqlalchemy import create_engine, text
import warnings
warnings.filterwarnings('ignore')


class DelayPredictionService:
    """납기 예측 서비스"""
    
    def __init__(self, db_url: Optional[str] = None, model_path: Optional[str] = None):
        """
        Args:
            db_url: PostgreSQL 연결 URL (기본값: localhost:5432/automobile_risk)
            model_path: 사전 훈련된 모델 경로 (선택)
        """
        self.db_url = db_url or os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/automobile_risk"
        )
        self.engine = None
        self.model = None
        self.feature_names = None
        self.is_model_loaded = False
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
    
    def connect(self) -> bool:
        """DB 연결"""
        try:
            self.engine = create_engine(self.db_url)
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception as e:
            print(f"DB 연결 실패: {e}")
            return False
    
    def extract_orders(self) -> pd.DataFrame:
        """주문 데이터 추출"""
        if not self.engine:
            self.connect()
        
        query = """
            SELECT 
                o.order_id,
                o.order_status,
                o.order_qty,
                o.order_date,
                o.due_date,
                o.completed_at,
                vm.model_name as vehicle_model,
                EXTRACT(EPOCH FROM (o.completed_at - o.due_date))/3600 as actual_delay_hours
            FROM orders o
            LEFT JOIN vehicle_models vm ON o.vehicle_model_id = vm.model_id
            ORDER BY o.order_id
        """
        return pd.read_sql(query, self.engine)
    
    def extract_events(self) -> pd.DataFrame:
        """공정 이벤트 데이터 추출"""
        if not self.engine:
            self.connect()
        
        query = """
            SELECT 
                pe.event_id,
                pe.order_id,
                pe.process,
                pe.event_code,
                pe.severity,
                pe.qty_affected,
                pe.line_hold,
                pe.resolved_at,
                pe.created_at
            FROM process_events pe
            ORDER BY pe.order_id, pe.created_at
        """
        return pd.read_sql(query, self.engine)
    
    def prepare_features(self, orders_df: pd.DataFrame, events_df: pd.DataFrame) -> pd.DataFrame:
        """특성 엔지니어링"""
        # 주문별 이벤트 집계
        event_stats = events_df.groupby('order_id').agg({
            'event_id': 'count',  # 총 이벤트 수
            'severity': ['mean', 'max'],  # 심각도 평균/최대
            'qty_affected': 'sum',  # 영향받은 총 수량
            'line_hold': 'sum'  # 라인 정지 횟수
        }).reset_index()
        
        event_stats.columns = ['order_id', 'event_count', 'severity_mean', 'severity_max', 
                                'qty_affected_total', 'line_hold_count']
        
        # 공정별 이벤트 수
        process_counts = events_df.pivot_table(
            index='order_id',
            columns='process',
            values='event_id',
            aggfunc='count',
            fill_value=0
        ).reset_index()
        process_counts.columns = ['order_id'] + [f'{col}_events' for col in process_counts.columns[1:]]
        
        # 주문 특성
        features = orders_df[['order_id', 'order_qty']].copy()
        
        # 이벤트 특성 병합
        features = features.merge(event_stats, on='order_id', how='left')
        features = features.merge(process_counts, on='order_id', how='left')
        
        # 결측치 처리
        features = features.fillna(0)
        
        return features
    
    def train_model(self, features_df: pd.DataFrame, orders_df: pd.DataFrame) -> Dict:
        """모델 훈련"""
        # 완료된 주문만 사용
        completed_orders = orders_df[orders_df['order_status'] == 'COMPLETED'].copy()
        
        if len(completed_orders) < 20:
            raise ValueError(f"훈련 데이터가 부족합니다 (최소 20개 필요, 현재 {len(completed_orders)}개)")
        
        # 특성과 타겟 준비
        train_features = features_df[features_df['order_id'].isin(completed_orders['order_id'])].copy()
        train_features = train_features.merge(
            completed_orders[['order_id', 'actual_delay_hours']], 
            on='order_id'
        )
        
        X = train_features.drop(['order_id', 'actual_delay_hours'], axis=1)
        y = train_features['actual_delay_hours'].fillna(0)
        
        # 모델 훈련
        self.model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        self.model.fit(X, y)
        self.feature_names = list(X.columns)
        self.is_model_loaded = True
        
        # 성능 평가
        train_pred = self.model.predict(X)
        rmse = np.sqrt(np.mean((y - train_pred) ** 2))
        mae = np.mean(np.abs(y - train_pred))
        
        return {
            "rmse": float(rmse),
            "mae": float(mae),
            "train_samples": len(X),
            "features": len(self.feature_names)
        }
    
    def predict(self, order_id: int, features_df: pd.DataFrame, 
                orders_df: pd.DataFrame, events_df: pd.DataFrame) -> Dict:
        """특정 주문의 납기 예측"""
        if not self.is_model_loaded:
            raise ValueError("모델이 로드되지 않았습니다. train_model()을 먼저 실행하세요.")
        
        # 주문 특성 추출
        order_features = features_df[features_df['order_id'] == order_id].copy()
        if order_features.empty:
            raise ValueError(f"주문 {order_id}를 찾을 수 없습니다.")
        
        X = order_features.drop(['order_id'], axis=1)
        X = X[self.feature_names]  # 훈련 시 사용한 특성 순서 유지
        
        # 예측
        predicted_delay = float(self.model.predict(X)[0])
        delay_probability = min(max(predicted_delay / 48.0, 0.0), 1.0)  # 0~1 정규화
        
        # 위험도 계산
        if predicted_delay < 2:
            risk_level = "LOW"
        elif predicted_delay < 8:
            risk_level = "MEDIUM"
        elif predicted_delay < 24:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        
        # 공정별 점수 계산 (특성 중요도 기반)
        feature_importance = dict(zip(self.feature_names, self.model.feature_importances_))
        process_scores = {}
        
        for feat in self.feature_names:
            if '_events' in feat:
                process = feat.replace('_events', '')
                importance = feature_importance.get(feat, 0)
                event_count = float(X[feat].iloc[0])
                process_scores[process] = importance * event_count * 10  # 스케일링
        
        # 주문 정보
        order_info = orders_df[orders_df['order_id'] == order_id].iloc[0]
        order_events = events_df[events_df['order_id'] == order_id]
        
        return {
            "order_id": int(order_id),
            "delay_probability": delay_probability,
            "expected_delay_hours": predicted_delay,
            "risk_level": risk_level,
            "total_score": float(X.sum().sum()),
            "process_scores": process_scores,
            "event_count": int(len(order_events)),
            "order_status": order_info['order_status'],
            "order_qty": int(order_info['order_qty']),
            "vehicle_model": order_info.get('vehicle_model', 'Unknown'),
            "actual_delay_hours": float(order_info['actual_delay_hours']) if pd.notna(order_info['actual_delay_hours']) else None
        }
    
    def predict_all(self) -> Dict:
        """전체 주문 예측"""
        # 데이터 추출
        orders_df = self.extract_orders()
        events_df = self.extract_events()
        features_df = self.prepare_features(orders_df, events_df)
        
        # 모델 훈련 (필요시)
        if not self.is_model_loaded:
            completed_count = (orders_df['order_status'] == 'COMPLETED').sum()
            if completed_count >= 20:
                self.train_model(features_df, orders_df)
            else:
                # 모델 없이 기본 예측
                return self._predict_without_model(orders_df, events_df, features_df)
        
        # 전체 주문 예측
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
            risk_dist = {}
            for p in predictions:
                risk = p['risk_level']
                risk_dist[risk] = risk_dist.get(risk, 0) + 1
            
            # 공정별 기여도
            process_breakdown = {}
            for p in predictions:
                for proc, score in p['process_scores'].items():
                    if proc not in process_breakdown:
                        process_breakdown[proc] = {'total_score': 0, 'count': 0}
                    process_breakdown[proc]['total_score'] += score
                    process_breakdown[proc]['count'] += 1
            
            breakdown_list = [
                {
                    "process": proc,
                    "total_score": stats['total_score'],
                    "avg_score": stats['total_score'] / stats['count'],
                    "count": stats['count']
                }
                for proc, stats in process_breakdown.items()
            ]
            breakdown_list.sort(key=lambda x: x['total_score'], reverse=True)
            
            return {
                "total_orders": len(predictions),
                "max_delay_hours": max(delay_hours),
                "avg_delay_hours": sum(delay_hours) / len(delay_hours),
                "risk_distribution": risk_dist,
                "process_breakdown": breakdown_list,
                "orders": predictions
            }
        
        return {
            "total_orders": 0,
            "max_delay_hours": 0,
            "avg_delay_hours": 0,
            "risk_distribution": {},
            "process_breakdown": [],
            "orders": []
        }
    
    def _predict_without_model(self, orders_df: pd.DataFrame, 
                                events_df: pd.DataFrame, 
                                features_df: pd.DataFrame) -> Dict:
        """모델 없이 규칙 기반 예측"""
        predictions = []
        
        for _, order in orders_df.iterrows():
            order_id = order['order_id']
            order_events = events_df[events_df['order_id'] == order_id]
            
            # 간단한 규칙: 이벤트 수와 심각도에 따라 지연 예측
            event_count = len(order_events)
            avg_severity = order_events['severity'].mean() if len(order_events) > 0 else 0
            
            predicted_delay = event_count * 0.5 + avg_severity * 2
            delay_probability = min(predicted_delay / 24.0, 1.0)
            
            if predicted_delay < 2:
                risk_level = "LOW"
            elif predicted_delay < 8:
                risk_level = "MEDIUM"
            elif predicted_delay < 24:
                risk_level = "HIGH"
            else:
                risk_level = "CRITICAL"
            
            predictions.append({
                "order_id": int(order_id),
                "delay_probability": delay_probability,
                "expected_delay_hours": predicted_delay,
                "risk_level": risk_level,
                "total_score": float(event_count * avg_severity),
                "process_scores": {},
                "event_count": event_count,
                "order_status": order['order_status'],
                "order_qty": int(order['order_qty']),
                "vehicle_model": order.get('vehicle_model', 'Unknown')
            })
        
        delay_hours = [p['expected_delay_hours'] for p in predictions]
        risk_dist = {}
        for p in predictions:
            risk = p['risk_level']
            risk_dist[risk] = risk_dist.get(risk, 0) + 1
        
        return {
            "total_orders": len(predictions),
            "max_delay_hours": max(delay_hours) if delay_hours else 0,
            "avg_delay_hours": sum(delay_hours) / len(delay_hours) if delay_hours else 0,
            "risk_distribution": risk_dist,
            "process_breakdown": [],
            "orders": predictions
        }
    
    def save_model(self, path: str):
        """모델 저장"""
        if not self.is_model_loaded:
            raise ValueError("저장할 모델이 없습니다.")
        
        with open(path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'feature_names': self.feature_names
            }, f)
        print(f"모델 저장 완료: {path}")
    
    def load_model(self, path: str):
        """모델 로드"""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.model = data['model']
            self.feature_names = data['feature_names']
            self.is_model_loaded = True
        print(f"모델 로드 완료: {path}")


# 전역 서비스 인스턴스
_service_instance: Optional[DelayPredictionService] = None


def initialize_service(db_url: Optional[str] = None, model_path: Optional[str] = None):
    """서비스 초기화"""
    global _service_instance
    _service_instance = DelayPredictionService(db_url, model_path)
    return _service_instance


def get_service() -> DelayPredictionService:
    """서비스 인스턴스 반환"""
    global _service_instance
    if _service_instance is None:
        _service_instance = DelayPredictionService()
    return _service_instance
