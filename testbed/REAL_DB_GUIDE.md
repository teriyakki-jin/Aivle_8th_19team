# 실제 데이터베이스 연동 가이드

## 📊 두 가지 테스트베드 비교

### 1️⃣ 샘플 데이터 테스트베드 (기존)
- **파일**: `delay_prediction_testbed.py`
- **데이터**: 자동 생성된 샘플 데이터 (200개 주문)
- **용도**: 알고리즘 검증, 점수화 로직 테스트
- **실행**: `run_testbed.bat`

### 2️⃣ 실제 DB 연동 테스트베드 (신규) ⭐
- **파일**: `real_data_testbed.py`
- **데이터**: PostgreSQL에서 실제 주문/이벤트 추출
- **용도**: 실전 모델 훈련, 실제 예측
- **실행**: `run_real_testbed.bat`

---

## 🚀 실제 DB 연동 실행 방법

### 1단계: 데이터베이스 연결 설정

**방법 1: 환경변수 설정 (권장)**
```bash
# Windows (cmd)
set DATABASE_URL=postgresql://user:password@localhost:5432/automobile_risk

# Windows (PowerShell)
$env:DATABASE_URL="postgresql://user:password@localhost:5432/automobile_risk"

# Linux/Mac
export DATABASE_URL="postgresql://user:password@localhost:5432/automobile_risk"
```

**방법 2: 코드에서 직접 설정**
```python
# real_data_testbed.py 실행 시
testbed = RealDataTestbed(
    db_url="postgresql://user:password@localhost:5432/automobile_risk"
)
```

### 2단계: 실행

```bash
# Windows
run_real_testbed.bat

# 또는 Python 직접 실행
cd testbed
python real_data_testbed.py
```

---

## 📋 실제 DB에서 추출하는 데이터

### 추출 SQL 쿼리

**주문 데이터**:
```sql
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
GROUP BY o.order_id, ...
```

**이벤트 데이터**:
```sql
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
```

---

## 📊 실행 결과

### 콘솔 출력 예시
```
============================================================
  실제 데이터베이스 연동 납기 예측 테스트베드
  Real Database Delay Prediction Testbed
============================================================

✓ 데이터베이스 연결 성공

============================================================
데이터 추출
============================================================
✓ 45개 주문 추출
  - 완료: 32개
  - 진행중: 10개
  - 계획: 3개
  - 지연: 8개 (25.0%)

✓ 127개 이벤트 추출
  - DEFECT: 89개
  - BREAKDOWN: 23개
  - LINE_HOLD: 15개
  - 미해결: 12개

✓ 데이터 CSV 저장 완료

============================================================
특성 엔지니어링
============================================================
✓ 특성 개수: 18개
✓ 주문 개수: 45개

============================================================
모델 훈련
============================================================
✓ 훈련 데이터: 32개
  - 지연: 8개 (25.0%)
  - 정상: 24개
✓ 학습 데이터: 26개
✓ 테스트 데이터: 6개

[Stage 1] 분류 모델 훈련
  ROC-AUC: 0.876
  F1-Score: 0.800
  Accuracy: 0.833

[Stage 2] 회귀 모델 훈련
  RMSE: 4.23 시간
  MAE: 2.87 시간
  R²: 0.745

============================================================
예측 결과 샘플
============================================================

주문 #12 (COMPLETED)
  지연 확률: 82.3%
  예상 지연: 9.5 시간
  실제 지연: 8.2 시간
  위험도: HIGH
  총 점수: 38.7

주문 #5 (COMPLETED)
  지연 확률: 15.2%
  예상 지연: 0.8 시간
  실제 지연: 0.0 시간
  위험도: LOW
  총 점수: 3.2

주문 #23 (IN_PROGRESS)
  지연 확률: 45.6%
  예상 지연: 5.3 시간
  위험도: MEDIUM
  총 점수: 18.9
```

### 생성되는 파일
```
testbed/
├── real_orders.csv          - 실제 주문 데이터
├── real_events.csv          - 실제 이벤트 데이터
├── real_features.csv        - 특성 데이터
└── real_delay_model.pkl     - 훈련된 모델
```

---

## 🔍 주요 차이점

| 항목 | 샘플 테스트베드 | 실제 DB 테스트베드 |
|-----|---------------|------------------|
| 데이터 소스 | 자동 생성 | PostgreSQL |
| 주문 수 | 200개 (고정) | 실제 DB 데이터 |
| 이벤트 수 | ~500개 | 실제 이벤트 |
| 지연 비율 | 30% (설정값) | 실제 비율 |
| 완료 주문 | 전체 | COMPLETED만 |
| 진행중 예측 | 불가 | 가능 ✅ |
| 모델 정확도 | 알고리즘 검증용 | 실전 사용 가능 |

---

## ⚠️ 주의사항

### 최소 데이터 요구사항
- **완료된 주문**: 최소 20개 이상
- **지연된 주문**: 최소 5개 이상
- **이벤트**: 주문당 평균 2~3개 이상

### 데이터 부족 시
```
⚠ 경고: 완료된 주문이 8개뿐입니다.
모델 훈련을 위해 최소 20개 이상의 완료된 주문이 필요합니다.

데이터는 CSV로 저장되었습니다:
  - testbed/real_orders.csv
  - testbed/real_events.csv
  - testbed/real_features.csv
```

**해결 방법**:
1. 더 많은 주문을 완료 상태로 변경
2. 샘플 데이터로 먼저 테스트 (`delay_prediction_testbed.py`)
3. 테스트 데이터 삽입

---

## 🎯 활용 시나리오

### 1. 진행 중인 주문 예측
```python
# IN_PROGRESS 주문의 지연 가능성 예측
in_progress_orders = orders_df[orders_df['order_status'] == 'IN_PROGRESS']

for order_id in in_progress_orders['order_id']:
    result = testbed.predict(order_id, features_df, orders_df, events_df)
    print(f"주문 #{order_id}: 지연 확률 {result['delay_probability']:.1%}")
```

### 2. 고위험 주문 식별
```python
# 모든 진행중/계획 주문 예측
active_orders = orders_df[orders_df['order_status'].isin(['IN_PROGRESS', 'PLANNED'])]

high_risk_orders = []
for order_id in active_orders['order_id']:
    result = testbed.predict(order_id, features_df, orders_df, events_df)
    if result['risk_level'] in ['HIGH', 'CRITICAL']:
        high_risk_orders.append(result)

# 위험도 순 정렬
sorted_risks = sorted(high_risk_orders, 
                     key=lambda x: x['expected_delay_hours'], 
                     reverse=True)
```

### 3. 공정별 병목 분석
```python
# 특정 주문의 공정별 점수 확인
order_id = 12
score_result = testbed.calculate_process_scores(order_id, events_df)

print(f"총 점수: {score_result['total_score']}")
print("공정별 기여도:")
for process, score in sorted(score_result['process_scores'].items(), 
                            key=lambda x: x[1], reverse=True):
    print(f"  {process}: {score:.1f}")
```

---

## 🔄 다음 단계

### 1단계: 실제 DB에서 데이터 확인
```bash
run_real_testbed.bat
```

### 2단계: 데이터가 충분하지 않으면
- 옵션 A: 샘플 테스트베드로 먼저 검증
- 옵션 B: 테스트 데이터 추가 삽입

### 3단계: 모델 성능 확인
- ROC-AUC > 0.80 목표
- RMSE < 5시간 목표

### 4단계: Backend 통합
- 점수 계산 로직을 Java로 이식
- DelayPredictionService에 적용

### 5단계: 프로덕션 배포
- FastAPI로 모델 서빙
- Backend에서 ML Service 호출
- Frontend 대시보드 연동

---

## 📞 문제 해결

### DB 연결 오류
```
✗ 데이터베이스 연결 실패: could not connect to server
```
**해결**:
1. PostgreSQL 서버 실행 확인
2. 연결 정보 확인 (호스트, 포트, 사용자명, 비밀번호)
3. 방화벽 확인

### 테이블 없음 오류
```
✗ 주문 데이터 추출 실패: relation "orders" does not exist
```
**해결**:
1. 데이터베이스 스키마 확인
2. Backend 애플리케이션 실행 (테이블 자동 생성)

### 데이터 부족
```
⚠ 경고: 완료된 주문이 8개뿐입니다.
```
**해결**:
1. 더 많은 주문 데이터 생성
2. 샘플 테스트베드로 알고리즘 먼저 검증

---

**작성일**: 2026-01-30  
**상태**: 🟢 실제 DB 연동 준비 완료

