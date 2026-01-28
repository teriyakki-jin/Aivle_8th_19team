# PostgreSQL DB 설계 및 이미지 분석 결과 저장 가이드

## 📋 개요

도장 품질 검사 시스템에서 YOLOv8 AI 모델로 분석한 이미지 결함 정보를 PostgreSQL DB에 저장하는 아키텍처입니다.

---

## 🗂️ 데이터베이스 스키마

### 1. **inspection_sessions** - 검사 세션
- 분석 배치/세션 정보 관리
- 시설명, 구역 코드, 검사 시간 기록

| Column | Type | 설명 |
|--------|------|------|
| id | SERIAL | PK |
| session_id | UUID | 고유 세션 ID |
| facility_name | VARCHAR | 시설명 (e.g., "도장실 A") |
| location_code | VARCHAR | 구역 코드 (e.g., "Area-A-001") |
| created_at | TIMESTAMP | 세션 생성 시간 |

### 2. **paint_analysis_results** - 분석 결과 (메인 테이블)
- 각 이미지 분석의 핵심 결과
- 상태(PASS/FAIL/WARNING), 주요 결함, 신뢰도 저장

| Column | Type | 설명 |
|--------|------|------|
| id | SERIAL | PK |
| result_id | UUID | 고유 분석 ID |
| session_id | UUID | FK - 검사 세션 |
| image_filename | VARCHAR | 원본 파일명 |
| image_path | VARCHAR | 로컬 저장 경로 |
| image_url | VARCHAR | 웹 서빙 URL |
| status | VARCHAR | 'PASS', 'FAIL', 'WARNING' |
| primary_defect_type | VARCHAR | 주 결함 유형 (orange_peel 등) |
| confidence | DECIMAL(5, 2) | 신뢰도 (0~100) |
| analyzed_at | TIMESTAMP | 분석 시간 |
| model_version | VARCHAR | 모델 버전 |
| inference_time_ms | INTEGER | 추론 소요 시간 |

### 3. **detected_defects** - 탐지된 결함 (상세 정보)
- 하나의 이미지에서 여러 결함이 감지될 때 각각 저장
- 결함 위치(바운딩박스), 신뢰도, 심각도 기록

| Column | Type | 설명 |
|--------|------|------|
| id | SERIAL | PK |
| result_id | UUID | FK - 분석 결과 |
| defect_class | VARCHAR | 결함 클래스 (orange_peel 등) |
| defect_name_ko | VARCHAR | 한글명 (주황색 굳음) |
| confidence | DECIMAL(5, 2) | 신뢰도 |
| bbox_x1, y1, x2, y2 | INTEGER | 결함 위치 좌표 |
| bbox_area | INTEGER | 결함 영역 크기 |
| severity_level | VARCHAR | 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL' |

### 4. **daily_statistics** - 일일 통계
- 매일 자동으로 업데이트되는 집계 데이터
- 검사 수, 결함률, 결함 유형별 분류

| Column | Type | 설명 |
|--------|------|------|
| stat_date | DATE | 통계 날짜 |
| facility_name | VARCHAR | 시설명 |
| total_inspections | INTEGER | 전체 검사 수 |
| passed_inspections | INTEGER | 정상 검사 수 |
| failed_inspections | INTEGER | 불량 검사 수 |
| defect_count | INTEGER | 총 결함 수 |
| defect_rate | DECIMAL(5, 2) | 결함률 (%) |

### 5. **hourly_statistics** - 시간대별 통계
- 추세 분석용 시간 단위 집계

### 6. **quality_trends** - 품질 트렌드
- 기간별 개선도 추적

---

## 🚀 구현 단계

### Step 1: PostgreSQL 설정

```bash
# PostgreSQL 설치 (Windows)
# https://www.postgresql.org/download/windows/

# 데이터베이스 생성
createdb paint_quality_analysis

# 스키마 적용
psql -U postgres -d paint_quality_analysis -f database_schema.sql
```

### Step 2: 백엔드 환경 설정

```bash
cd backend

# 필요 패키지 설치
npm install pg uuid express cors dotenv

# .env 파일 생성
cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_NAME=paint_quality_analysis
DB_USER=postgres
DB_PASSWORD=your_password
API_PORT=8080
EOF
```

### Step 3: 백엔드 서버 구현

`backend/src/index.ts` (Express 서버 메인):

```typescript
import express from 'express';
import { Pool } from 'pg';
import { createPaintAnalysisRouter } from './routes/paintAnalysis';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const app = express();
app.use(express.json());

// 라우트 등록
app.use('/api/v1/paint', createPaintAnalysisRouter(pool));

app.listen(process.env.API_PORT || 8080, () => {
  console.log(`Server running on port ${process.env.API_PORT || 8080}`);
});
```

### Step 4: ML 서비스에서 결과 저장

ML 서비스(`ml-service/main.py`)에서 분석 결과 저장:

```python
from save_results import AnalysisResultSaver

saver = AnalysisResultSaver(backend_url="http://localhost:8080")

# 1. 세션 생성
session_id = saver.create_session(
    facility_name="도장실 A",
    location_code="Area-A-001"
)

# 2. YOLO 추론 후 결과 저장
yolo_predictions = model_service.predict(image_path)

result_id = saver.save_analysis_result(
    session_id=session_id,
    facility_name="도장실 A",
    image_filename="image.jpg",
    image_path="/uploads/image.jpg",
    image_url="http://localhost:8000/image.jpg",
    yolo_predictions=yolo_predictions,
    model_version="v1.0",
    inference_time_ms=145
)
```

---

## 📊 API 엔드포인트

### 분석 결과 저장
```
POST /api/v1/paint/analysis
Content-Type: application/json

{
  "sessionId": "uuid",
  "facilityName": "도장실 A",
  "imageFilename": "image.jpg",
  "imagePath": "/uploads/image.jpg",
  "imageUrl": "http://localhost:8000/image.jpg",
  "status": "FAIL",
  "confidence": 92.5,
  "defects": [...]
}

Response: { resultId, sessionId, status, timestamp }
```

### 최근 결과 조회
```
GET /api/v1/paint/results?days=7&limit=50

Response: { data: [...], count: N }
```

### 결함 유형별 통계
```
GET /api/v1/paint/defect-types?days=30

Response: { data: [{defect_class, occurrence_count, avg_confidence, ...}] }
```

### 일일 통계
```
GET /api/v1/paint/daily-stats?startDate=2024-01-15&endDate=2024-01-22

Response: { data: [{stat_date, total_inspections, defect_count, ...}] }
```

---

## 🔄 데이터 흐름

```
YOLOv8 모델 추론
    ↓
이미지 분석 결과 (결함 위치, 신뢰도)
    ↓
ML 서비스 (save_results.py)
    ↓
POST /api/v1/paint/analysis
    ↓
PostgreSQL DB
├── paint_analysis_results (메인 결과)
├── detected_defects (상세 결함)
└── daily_statistics (통계 자동 업데이트)
    ↓
프론트엔드 대시보드 조회
GET /api/v1/paint/results
GET /api/v1/paint/defect-types
GET /api/v1/paint/daily-stats
```

---

## 💡 활용 사례

### 1. 실시간 품질 모니터링
```python
# 최근 1시간 검사 결과
recent = saver.get_recent_results(days=1)
failed_count = len([r for r in recent if r['status'] == 'FAIL'])
```

### 2. 결함 유형 분석
```python
# 지난 30일 결함 유형 랭킹
summary = saver.get_defect_summary(days=30)
for defect in summary[:5]:
    print(f"{defect['defect_name_ko']}: {defect['occurrence_count']}건")
```

### 3. 품질 추세 분석
```python
# 지난 주 일일 통계
daily = saver.get_daily_stats("2024-01-15", "2024-01-22")
for day in daily:
    defect_rate = (day['defect_count'] / day['total_inspections']) * 100
    print(f"{day['stat_date']}: 결함률 {defect_rate:.1f}%")
```

---

## 🛡️ 성능 최적화

1. **인덱스 생성**: 자주 조회되는 컬럼에 인덱스 추가
2. **파티셔닝**: 대량 데이터 시 `analyzed_at` 기준 파티셔닝
3. **배치 처리**: 통계 업데이트는 야간에 배치로 처리
4. **캐싱**: 자주 조회되는 결과는 Redis 캐시

---

## 📝 주의사항

- UUID는 고유성 보장 (결과 중복 방지)
- 트랜잭션 처리로 메인/상세 데이터 일관성 유지
- 이미지 파일은 별도 스토리지에 저장, DB에는 경로만 기록
- 정기적인 DB 백업 필요

---

## 🔗 참고 파일

- `database_schema.sql` - PostgreSQL 스키마
- `backend/src/services/paintAnalysisService.ts` - DB 서비스
- `backend/src/routes/paintAnalysis.ts` - API 라우트
- `ml-service/save_results.py` - ML 서비스 연동
