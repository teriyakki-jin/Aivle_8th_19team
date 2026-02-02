# 납기 예측 시스템 통합 가이드

## 개요

testbed의 실제 데이터베이스 연동 납기 예측 기능이 ml-service에 통합되었습니다.

## 구조

```
ml-service/
├── delay_prediction/
│   ├── __init__.py
│   └── service.py          # 납기 예측 서비스 (testbed 로직 통합)
└── main.py                  # FastAPI - 납기 예측 API 엔드포인트 추가
```

## API 엔드포인트

### 1. 전체 주문 예측 개요
```http
GET http://localhost:8000/api/v1/delay/prediction/overview
```

**응답:**
```json
{
  "status": "success",
  "total_orders": 50,
  "max_delay_hours": 72.5,
  "avg_delay_hours": 24.3,
  "risk_distribution": {
    "LOW": 10,
    "MEDIUM": 20,
    "HIGH": 15,
    "CRITICAL": 5
  },
  "process_breakdown": [
    {
      "process": "Welding",
      "total_score": 156.8,
      "count": 25,
      "avg_score": 6.27
    }
  ],
  "orders": [
    {
      "order_id": 1,
      "delay_probability": 0.856,
      "expected_delay_hours": 48.2,
      "risk_level": "HIGH",
      "total_score": 85.6,
      "process_scores": {
        "Welding": 45.2,
        "Paint": 28.4,
        "Press": 12.0
      },
      "event_count": 8,
      "order_status": "IN_PROGRESS",
      "order_qty": 100,
      "vehicle_model": "Model X"
    }
  ]
}
```

### 2. 특정 주문 예측
```http
GET http://localhost:8000/api/v1/delay/prediction/{order_id}
```

### 3. 모델 재훈련
```http
POST http://localhost:8000/api/v1/delay/train
```

### 4. 서비스 상태
```http
GET http://localhost:8000/api/v1/delay/status
```

## 프론트엔드 통합

### MainDashboard 컴포넌트

**URL:** `http://localhost:3000/dashboard`

새로 추가된 섹션:
- **납기 예측 분석**: 전체 주문의 예측 결과 요약
- **위험도별 주문 분포**: LOW, MEDIUM, HIGH, CRITICAL
- **주문별 예측 상세 테이블**: 주문 ID, 차량 모델, 지연 확률, 예상 지연 시간 등
- **공정별 지연 기여도**: 각 공정의 점수 및 기여도

## 실행 방법

### 1. ML Service 시작
```bash
cd ml-service
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

### 2. Backend 시작
```bash
cd backend
./gradlew bootRun
```

### 3. Frontend 시작
```bash
cd frontend
npm install
npm run dev
```

### 4. 대시보드 접속
```
http://localhost:3000/dashboard
```

## 환경 변수 설정

### DATABASE_URL (ml-service)
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/automobile_risk"
```

또는 `.env` 파일:
```
DATABASE_URL=postgresql://user:password@localhost:5432/automobile_risk
```

## 데이터 요구사항

납기 예측 모델 훈련을 위해서는:
- 최소 **20개 이상의 완료된 주문(COMPLETED)** 필요
- 주문에 대한 이벤트 데이터 (DEFECT, BREAKDOWN, LINE_HOLD)

데이터가 부족한 경우:
- testbed/real_data_testbed.py 실행하여 샘플 데이터 생성
- 또는 직접 데이터 입력 후 `/api/v1/delay/train` 호출

## 주요 기능

### 1. 자동 모델 로딩
- 서버 시작 시 `testbed/real_delay_model.pkl` 자동 로딩
- 모델이 없으면 첫 예측 시 자동 훈련

### 2. 실시간 예측
- 주문 상태 변경 시 실시간 예측
- 공정별 이벤트 발생 시 즉시 반영

### 3. 공정별 점수 계산
- 이벤트 타입, 심각도, 수량, 미해결 여부 고려
- 공정별 가중치 적용 (Welding 1.3, Paint 1.2 등)

### 4. 위험도 레벨
- **LOW**: 예상 지연 < 4시간
- **MEDIUM**: 4시간 ≤ 예상 지연 < 12시간
- **HIGH**: 12시간 ≤ 예상 지연 < 48시간
- **CRITICAL**: 예상 지연 ≥ 48시간

## 트러블슈팅

### 모델 훈련 실패
```
완료된 주문이 X개뿐입니다. 최소 20개 필요
```
**해결:** 더 많은 주문을 완료 상태로 변경하거나 샘플 데이터 추가

### DB 연결 실패
```
데이터베이스 연결 실패: could not connect to server
```
**해결:** DATABASE_URL 확인, PostgreSQL 서버 실행 확인

### 예측 데이터 표시 안됨
**해결:** 
1. ml-service health 체크: `http://localhost:8000/health`
2. delay_prediction_loaded: true 확인
3. 브라우저 콘솔에서 API 응답 확인

## 성능 지표

### 분류 모델 (지연 여부)
- ROC-AUC: 0.85+
- F1-Score: 0.75+
- Accuracy: 0.80+

### 회귀 모델 (지연 시간)
- RMSE: 15시간 이내
- MAE: 10시간 이내
- R²: 0.70+

## 다음 단계

1. **자동 재훈련**: 일정 주기마다 모델 자동 재훈련
2. **알림 시스템**: 위험도 CRITICAL 주문 자동 알림
3. **대시보드 확장**: 추세 분석, 예측 정확도 추적
4. **모델 개선**: 더 많은 특성 추가, 앙상블 모델 적용
