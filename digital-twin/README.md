# 🚗 Automotive Digital Twin - 자동차 공정 디지털 트윈 시뮬레이션

실시간 3D 시각화와 AI 기반 최적화를 통한 자동차 제조 공정 디지털 트윈 시스템

## 🎯 주요 기능

### 1. 실시간 3D 시뮬레이션
- **6개 제조 공정 시뮬레이션**
  - 🔨 프레스 (Press)
  - ⚡ 용접 (Welding)
  - 🔧 차체 조립 (Body Assembly)
  - 🎨 도장 (Paint)
  - ⚙️ 엔진 조립 (Engine Assembly)
  - 🪟 윈드실드 설치 (Windshield)

- **인터랙티브 3D 뷰**
  - Three.js 기반 실시간 렌더링
  - 줌/팬/회전 컨트롤
  - 공정별 상태 시각화 (정상/경고/오류)
  - 애니메이션 효과

### 2. AI 기반 최적화
- **다목적 최적화**
  - 품질 (Quality)
  - 속도 (Speed)
  - 비용 (Cost)
  
- **최적화 알고리즘**
  - 유전 알고리즘 (Genetic Algorithm)
  - 파라미터 민감도 분석
  - 병목 구간 자동 탐지
  - 실행 가능한 개선 제안

### 3. 시나리오 분석
- What-if 분석
- 시나리오 비교 (최대 3개)
- 파레토 프론티어 시각화
- 히스토리 추적

### 4. 실시간 모니터링
- KPI 대시보드
  - OEE (Overall Equipment Effectiveness)
  - 처리량 (Throughput)
  - 품질률 (Quality Rate)
  - 사이클 타임 (Cycle Time)
- 실시간 차트 및 그래프
- 알람 및 알림

## 🏗️ 프로젝트 구조

```
digital-twin-automotive/
├── frontend/                 # React + Three.js 프론트엔드
│   ├── src/
│   │   ├── components/      # React 컴포넌트
│   │   │   ├── DigitalTwin/ # 디지털 트윈 관련 컴포넌트
│   │   │   ├── Simulation/  # 시뮬레이션 컨트롤
│   │   │   └── Optimization/# 최적화 UI
│   │   ├── services/        # API 서비스
│   │   ├── utils/           # 유틸리티
│   │   └── styles/          # CSS 스타일
│   ├── public/              # 정적 파일
│   └── package.json
│
├── backend/                 # FastAPI 백엔드
│   ├── app/
│   │   ├── simulation/      # 시뮬레이션 엔진
│   │   │   ├── processes/   # 각 공정 시뮬레이터
│   │   │   ├── optimizer.py # 최적화 엔진
│   │   │   └── engine.py    # 메인 시뮬레이션 엔진
│   │   ├── api/             # API 엔드포인트
│   │   ├── models/          # 데이터 모델
│   │   └── utils/           # 유틸리티
│   ├── tests/               # 테스트
│   ├── main.py              # FastAPI 앱
│   └── requirements.txt
│
├── docs/                    # 문서
│   ├── architecture.md      # 아키텍처 설명
│   ├── api.md              # API 문서
│   └── user-guide.md       # 사용자 가이드
│
└── README.md               # 이 파일
```

## 🚀 빠른 시작

### 사전 요구사항
- Node.js 18+
- Python 3.10+
- npm 또는 yarn

### 1. 백엔드 실행

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

백엔드 서버: http://localhost:8000
API 문서: http://localhost:8000/docs

### 2. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

프론트엔드: http://localhost:5173

## 📊 사용 방법

### 1. 시뮬레이션 시작
1. 브라우저에서 http://localhost:5173 접속
2. "시뮬레이션 시작" 버튼 클릭
3. 3D 뷰에서 실시간 공정 진행 확인

### 2. 파라미터 조정
1. 좌측 패널에서 공정별 파라미터 조정
2. 실시간으로 시뮬레이션 결과 반영
3. KPI 변화 모니터링

### 3. 최적화 실행
1. "최적화 실행" 버튼 클릭
2. 목표 설정 (품질 우선 / 속도 우선 / 비용 절감)
3. 최적화 결과 확인
4. 추천 파라미터 적용

### 4. 시나리오 비교
1. 여러 설정으로 시뮬레이션 실행
2. "시나리오 비교" 탭 이동
3. 레이더 차트로 비교 분석

## 🎨 기술 스택

### Frontend
- **React 18** - UI 프레임워크
- **TypeScript** - 타입 안전성
- **Three.js** - 3D 렌더링
- **D3.js** - 데이터 시각화
- **Recharts** - 차트 라이브러리
- **TailwindCSS** - 스타일링
- **Vite** - 빌드 도구

### Backend
- **FastAPI** - 웹 프레임워크
- **Python 3.10+** - 프로그래밍 언어
- **NumPy** - 수치 계산
- **SciPy** - 과학 계산
- **Pydantic** - 데이터 검증
- **SQLite** - 데이터베이스

### Optimization
- **DEAP** - 유전 알고리즘
- **SciPy.optimize** - 최적화 알고리즘
- **Pandas** - 데이터 분석

## 📈 성능

- **3D 렌더링**: 60 FPS (최적화된 환경)
- **시뮬레이션 속도**: 1x ~ 10x 조절 가능
- **최적화 시간**: 10-30초 (파라미터 수에 따라)
- **동시 시나리오**: 최대 3개

## 🔧 개발

### 백엔드 테스트
```bash
cd backend
pytest tests/ -v
```

### 프론트엔드 테스트
```bash
cd frontend
npm test
```

### 코드 포맷팅
```bash
# Backend
black app/
isort app/

# Frontend
npm run format
```

## 📝 라이선스

MIT License

## 👥 기여

이슈와 PR을 환영합니다!

## 📞 문의

프로젝트 관련 문의사항이 있으시면 이슈를 등록해주세요.
