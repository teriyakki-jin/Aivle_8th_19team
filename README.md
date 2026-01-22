
  # 자동차 공정 리스크 예측 플랫폼

AI 기반 도장 결함 검출 및 생산 공정 모니터링 시스템

## 프로젝트 개요

이 프로젝트는 자동차 생산 공정에서 발생하는 도장 불량을 AI 모델을 이용하여 자동 감지하고, 전체 생산 시설의 상태를 통합 관리하는 플랫폼입니다.

### 주요 기능

- **도장 품질 분석**: YOLO v8 기반 결함 자동 감지
  - 오렌지 필(Orange Peel)
  - 러닝 및 쇠갈음(Runs & Sags)
  - 용제 팝(Solvent Pop)
  - 워터 스팟팅(Water Spotting)

- **분석 이력 관리**: DB 기반 모든 분석 결과 저장 및 조회
- **실시간 통계**: 검사율, 결함률, 정상률, 신뢰도 등 실시간 대시보드
- **설비 관리**: 전력 사용량, 정비 일정 모니터링
- **배터리 성능 예측**: 머신러닝 기반 배터리 상태 예측

---

## 기술 스택

### Frontend
- **React 18** + TypeScript
- **Tailwind CSS**: 스타일링
- **Vite**: 빌드 도구
- **Recharts**: 데이터 시각화
- **Lucide React**: 아이콘

### Backend
- **Spring Boot 3.4.1**: Java 21
- **PostgreSQL**: 데이터베이스
- **JPA/Hibernate**: ORM
- **Spring Security**: 인증/인가

### ML Service
- **FastAPI**: Python 웹 프레임워크
- **YOLO v8**: 객체 감지 모델
- **OpenCV**: 이미지 처리
- **Python 3.10**: 런타임

---

## 프로젝트 구조

```
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── components/         # React 컴포넌트
│   │   │   ├── PaintQualityDashboard.tsx    # 도장품질 대시보드
│   │   │   ├── BatteryDashboard.tsx         # 배터리 관리
│   │   │   ├── FacilityDashboard.tsx        # 설비 관리
│   │   │   └── paint/                       # 도장 분석 컴포넌트
│   │   ├── services/           # API 클라이언트
│   │   │   └── paintAnalysis.ts
│   │   ├── store/              # 상태 관리
│   │   └── types/              # TypeScript 타입
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                     # Spring Boot 백엔드
│   ├── src/main/java/com/example/automobile_risk/
│   │   ├── controller/         # REST API
│   │   │   └── PaintAnalysisController.java
│   │   ├── service/            # 비즈니스 로직
│   │   │   └── PaintAnalysisService.java
│   │   ├── entity/             # JPA 엔티티
│   │   │   ├── PaintAnalysisResult.java
│   │   │   └── DetectedDefect.java
│   │   ├── repository/         # 데이터 접근
│   │   │   ├── PaintAnalysisResultRepository.java
│   │   │   └── DetectedDefectRepository.java
│   │   └── security/           # 보안 설정
│   └── build.gradle
│
├── model/                       # YOLO 모델 및 추론
│   ├── main.py                 # 통합 추론 + DB 저장
│   ├── best.pt                 # 학습된 YOLO 모델
│   └── detect/                 # 예측 결과
│
└── ml-service/                 # 레거시 ML 서비스
    └── *.py
```

---

## 작업 내용

### 1. 백엔드 구현 (Spring Boot)
- **Entity 설계**: PaintAnalysisResult, DetectedDefect
  - 1:N 관계로 분석 결과와 검출된 결함 매핑
  - 결함 심각도(Severity Level) 분류: CRITICAL/HIGH/MEDIUM/LOW

- **Repository 계층**: 커스텀 쿼리 메서드
  - `countByStatusAndAnalyzedAtAfter()`: 일일 상태별 통계
  - `getAverageConfidenceAfter()`: 신뢰도 추이
  - `countByDetectedAtAfter()`: 결함 건수 조회

- **Service 계층**: 비즈니스 로직
  - `saveAnalysisResult()`: ML 서비스의 결과 저장
  - `getAllAnalysisHistory()`: 분석 이력 조회
  - `getAnalysisDetail()`: 단일 분석 상세 조회
  - `getTodayStatistics()`: 실시간 통계 계산

- **Controller 계층**: REST API
  - `POST /api/paint-analysis/save`: 분석 결과 저장
  - `GET /api/paint-analysis/history`: 분석 이력 조회
  - `GET /api/paint-analysis/detail/{resultId}`: 상세 조회
  - `GET /api/paint-analysis/statistics/today`: 일일 통계

- **보안 설정**: SecurityConfig
  - Paint Analysis API를 permitAll 처리

### 2. ML 서비스 통합 (Python/FastAPI)
- **ml-service/main.py와 model/main.py 통합**
  - YOLO v8 모델 로드 및 추론
  - 배경 제거 및 결과 이미지 생성
  - 결함 심각도 자동 분류 (confidence 기반)

- **백엔드 연동**
  - 추론 결과를 `http://localhost:3001/api/paint-analysis/save`로 POST
  - 분석 이미지를 `/static/` 경로에 저장

- **이미지 관리**
  - 분석 후 원본 이미지 자동 삭제 (저장소 절약)
  - 분석 결과 이미지만 보관

### 3. 프론트엔드 구현 (React + TypeScript)
- **도장 품질 대시보드** (`PaintQualityDashboard.tsx`)
  - 메트릭 카드: 전체 검사, 결함률, 정상률, 신뢰도 (실시간 갱신)
  - 결함 비율 파이 차트 (DB 이력 기반)
  - 이미지 업로더 (드래그&드롭)
  - 분석 이력 테이블 (inline 상세보기)
    - 컬럼: 시간, 상태, 결함 유형, 신뢰도, 위치, 보기
    - 클릭 시 행 확장하여 이미지 + 정보 표시
  - 실시간 자동 갱신 (통계 30초, 이력 10초)

- **서비스 계층** (`paintAnalysis.ts`)
  - `getTodayStatistics()`: 일일 통계 조회
  - `getAnalysisHistory()`: 분석 이력 목록
  - `getAnalysisDetail()`: 단일 분석 상세 정보

- **UI/UX 개선**
  - MetricCard: 아이콘 우측 배치, 크기 확대
  - 레이아웃: 한 화면에 모든 정보 표시
  - 색상 코딩: 상태별(PASS/FAIL/WARNING), 심각도별 색상 적용
  - 반응형 디자인: 모바일/태블릿/데스크톱 지원

---

## 데이터베이스 스키마

### paint_analysis_results
```sql
CREATE TABLE paint_analysis_results (
  id BIGINT PRIMARY KEY,
  result_id VARCHAR(255) UNIQUE,
  session_id VARCHAR(255),
  analyzed_at TIMESTAMP,
  status VARCHAR(50),           -- PASS, FAIL, WARNING
  primary_defect_type VARCHAR(255),
  confidence DECIMAL(5,2),
  image_url VARCHAR(500),
  result_image_url VARCHAR(500),
  inference_time_ms INT,
  model_version VARCHAR(50),
  ...
);
```

### detected_defects
```sql
CREATE TABLE detected_defects (
  id BIGINT PRIMARY KEY,
  result_id VARCHAR(255) FOREIGN KEY,
  defect_class VARCHAR(100),
  defect_name_ko VARCHAR(255),
  confidence DECIMAL(5,2),
  severity_level VARCHAR(50),   -- CRITICAL, HIGH, MEDIUM, LOW
  bbox_x1, bbox_y1, bbox_x2, bbox_y2 DECIMAL,
  detected_at TIMESTAMP,
  ...
);
```

---

## 구동 방법

### 필수 요구사항
- Java 21 이상
- Python 3.10 이상
- PostgreSQL 14 이상
- Node.js 18 이상

### 1. 데이터베이스 설정
```bash
# PostgreSQL 시작
# Windows: services.msc에서 PostgreSQL 시작
# macOS/Linux: brew services start postgresql

# 데이터베이스 생성
createdb automobile_risk

# 테이블 자동 생성 (Spring Boot 실행 시)
```

### 2. 백엔드 실행 (Spring Boot)
```bash
cd backend

# Gradle 빌드 및 실행
./gradlew bootRun

# 또는 JAR 빌드
./gradlew bootJar
java -jar build/libs/automobile_risk-*.jar

# 포트: http://localhost:3001
```

**application.properties 설정** (필요 시):
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/automobile_risk
spring.datasource.username=postgres
spring.datasource.password=your_password
spring.jpa.hibernate.ddl-auto=update
```

### 3. ML 서비스 실행 (FastAPI)
```bash
cd /path/to/project

# Python 환경 설정
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 의존성 설치
pip install -r model/requirements.txt

# FastAPI 서버 실행
python -m uvicorn model.main:app --host 0.0.0.0 --port 8000 --reload

# 포트: http://localhost:8000
```

**주요 엔드포인트**:
- `POST /analyze`: 이미지 분석
  - 입력: 이미지 파일
  - 출력: 분석 결과 JSON + 백엔드 DB 저장

### 4. 프론트엔드 실행 (React + Vite)
```bash
cd frontend

# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 포트: http://localhost:5173
```

**빌드**:
```bash
npm run build   # 프로덕션 빌드
npm run preview # 빌드된 파일 미리보기
```

---

## 실행 순서

1. **PostgreSQL** 실행
   ```bash
   # Windows: PostgreSQL 서비스 시작
   ```

2. **백엔드** 실행
   ```bash
   cd backend && ./gradlew bootRun
   ```

3. **ML 서비스** 실행 (새 터미널)
   ```bash
   python -m uvicorn model.main:app --host 0.0.0.0 --port 8000 --reload
   ```

4. **프론트엔드** 실행 (새 터미널)
   ```bash
   cd frontend && npm run dev
   ```

5. **브라우저** 열기
   ```
   http://localhost:5173
   ```

---

## API 문서

### Paint Analysis API

#### 1. 분석 결과 저장
```
POST /api/paint-analysis/save
Content-Type: application/json

{
  "sessionId": "session-123",
  "resultId": "result-456",
  "status": "FAIL",
  "confidence": 0.95,
  "primaryDefectType": "오렌지 필",
  "resultImageUrl": "/static/result_123.jpg",
  "inferenceTimeMs": 1234,
  "modelVersion": "v1.0",
  "detectedDefects": [
    {
      "defectNameKo": "오렌지 필",
      "defectClass": "orange_peel",
      "confidence": 0.95,
      "severityLevel": "HIGH",
      "bboxX1": 100, "bboxY1": 100, "bboxX2": 200, "bboxY2": 200
    }
  ]
}
```

#### 2. 분석 이력 조회
```
GET /api/paint-analysis/history

Response:
[
  {
    "resultId": "result-456",
    "status": "FAIL",
    "confidence": 0.95,
    "analyzedAt": "2026-01-22T10:30:00",
    "primaryDefectType": "오렌지 필",
    "locationCode": "LINE-A",
    "detectedDefects": [...]
  }
]
```

#### 3. 분석 상세 조회
```
GET /api/paint-analysis/detail/{resultId}

Response:
{
  "resultId": "result-456",
  "status": "FAIL",
  "confidence": 0.95,
  "analyzedAt": "2026-01-22T10:30:00",
  "resultImageUrl": "/static/result_123.jpg",
  "inferenceTimeMs": 1234,
  "modelVersion": "v1.0",
  "detectedDefects": [
    {
      "defectNameKo": "오렌지 필",
      "defectClass": "orange_peel",
      "confidence": 0.95,
      "severityLevel": "HIGH"
    }
  ]
}
```

#### 4. 일일 통계 조회
```
GET /api/paint-analysis/statistics/today

Response:
{
  "totalInspections": 100,
  "passedInspections": 85,
  "failedInspections": 15,
  "defectRate": 15.0,
  "passRate": 85.0,
  "avgConfidence": 94.5,
  "defectCount": 23
}
```

---

## 주요 개선사항

✅ ML 서비스 + 백엔드 통합  
✅ DB 기반 분석 이력 관리  
✅ 실시간 통계 대시보드  
✅ 결함 심각도 자동 분류  
✅ 원본 이미지 자동 삭제  
✅ UI/UX 최적화  
✅ 한 화면에 모든 정보 표시  
✅ 색상 코딩 및 반응형 디자인  

---

## 개발자 정보

- **팀**: Aivle 8기 19팀
- **레포**: [chjomoon/Aivle_8th_19team](https://github.com/chjomoon/Aivle_8th_19team)
- **라이선스**: MIT
  