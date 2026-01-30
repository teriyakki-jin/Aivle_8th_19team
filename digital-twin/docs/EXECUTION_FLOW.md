# 🔄 디지털 트윈 시뮬레이션 실행 흐름

이 문서는 디지털 트윈 자동차 제조 시뮬레이션 시스템이 어떻게 실행되는지 전체 흐름을 설명합니다.

---

## 📋 목차

1. [백엔드 시작](#1️⃣-백엔드-시작)
2. [프론트엔드 시작](#2️⃣-프론트엔드-시작)
3. [브라우저 접속 후 초기화](#3️⃣-브라우저-접속-후-초기화)
4. [실시간 상태 폴링](#4️⃣-실시간-상태-폴링-시작)
5. [시뮬레이션 시작](#5️⃣-사용자가-시작-버튼-클릭)
6. [개별 공정 시뮬레이션](#6️⃣-개별-공정-시뮬레이션)
7. [최적화 실행](#7️⃣-최적화-실행)
8. [3D 시각화](#8️⃣-3d-시각화-렌더링)

---

## 1️⃣ 백엔드 시작

### 실행 명령어
```bash
cd d:\digital-twin-automotive\backend
python main.py
```

### 실행 순서
```
main.py 실행
    ↓
FastAPI 앱 초기화
    ↓
CORS 미들웨어 설정 (프론트엔드 연결 허용)
    ↓
전역 변수 초기화
    - simulators = {} (시뮬레이터 저장소)
    - optimization_results = {} (최적화 결과 저장소)
    ↓
API 엔드포인트 등록
    - /api/simulation/create
    - /api/simulation/{id}/start
    - /api/optimization/analyze
    - 등등...
    ↓
Uvicorn 서버 시작 (포트 8000)
    ↓
✅ 백엔드 준비 완료!
```

### 주요 컴포넌트
- **FastAPI**: 웹 프레임워크
- **ProductionLineSimulator**: 메인 시뮬레이션 엔진
- **GeneticOptimizer**: 최적화 엔진
- **6개 공정 시뮬레이터**: Press, Welding, Body, Paint, Engine, Windshield

---

## 2️⃣ 프론트엔드 시작

### 실행 명령어
```bash
cd d:\digital-twin-automotive\frontend
npm run dev
```

### 실행 순서
```
Vite 개발 서버 시작
    ↓
React 앱 빌드
    ↓
index.html 로드
    ↓
main.tsx 실행
    ↓
App.tsx 렌더링
    ↓
DigitalTwinDashboard 컴포넌트 마운트
    ↓
✅ 프론트엔드 준비 완료!
```

### 주요 컴포넌트
- **Vite**: 빌드 도구
- **React**: UI 프레임워크
- **Three.js**: 3D 렌더링
- **Recharts**: 차트 라이브러리

---

## 3️⃣ 브라우저 접속 후 초기화

사용자가 **http://localhost:5173** 접속 시:

```
브라우저 접속
    ↓
DigitalTwinDashboard 컴포넌트 로드
    ↓
useEffect 실행 (컴포넌트 마운트 시)
    ↓
initializeSimulation() 함수 호출
    ↓
[프론트엔드] POST /api/simulation/create 요청
    {
        name: "Production Line Simulation",
        scenario: "normal"
    }
    ↓
[백엔드] create_simulation() 함수 실행
    ↓
ProductionLineSimulator 객체 생성
    - 6개 공정 시뮬레이터 초기화
      • PressSimulator
      • WeldingSimulator
      • BodyAssemblySimulator
      • PaintSimulator
      • EngineSimulator
      • WindshieldSimulator
    ↓
시뮬레이션 ID 생성 (UUID)
    ↓
simulators 딕셔너리에 저장
    ↓
[백엔드] 응답 반환
    {
        "simulation_id": "abc-123-...",
        "status": "created"
    }
    ↓
[프론트엔드] simulation_id 저장
    ↓
✅ 시뮬레이션 초기화 완료!
    ↓
로딩 화면 → 대시보드 표시
```

---

## 4️⃣ 실시간 상태 폴링 시작

초기화 완료 후 자동으로 1초마다 반복:

```
setInterval (1초마다 반복)
    ↓
[프론트엔드] GET /api/simulation/{id}/state 요청
    ↓
[백엔드] get_simulation_state() 실행
    ↓
simulator.get_state() 호출
    - 각 공정의 현재 상태 수집
    - 전체 메트릭 계산 (OEE, 품질, 처리량 등)
    ↓
[백엔드] SimulationState 반환
    ↓
[프론트엔드] 상태 업데이트
    - setSimulationState(state)
    - 화면 리렌더링
    - KPI 카드 업데이트
    - 3D 뷰 업데이트
    - 공정 카드 업데이트
    ↓
(1초 후 반복)
```

### 업데이트되는 데이터
- **전체 KPI**: OEE, 품질, 처리량, 비용
- **공정별 상태**: 진행률, 품질, 사이클 타임, 가동률
- **생산 통계**: 생산량, 불량, WIP

---

## 5️⃣ 사용자가 "시작" 버튼 클릭

```
사용자 클릭: "시작" 버튼
    ↓
handleStart() 함수 실행
    ↓
[프론트엔드] POST /api/simulation/{id}/start
    ↓
[백엔드] start_simulation() 실행
    ↓
simulator.start() 호출
    ↓
시뮬레이션 스레드 시작
    ↓
_run_simulation() 메인 루프 시작
    ↓
무한 루프 (is_running = True)
```

### 시뮬레이션 메인 루프 (매 50ms)

```
┌─────────────────────────────────┐
│  매 50ms마다 (20 FPS):          │
│                                 │
│  1. delta_time 계산            │
│     (실제 시간 × 시뮬레이션 속도)│
│                                 │
│  2. simulation_time 증가       │
│                                 │
│  3. 각 공정 업데이트            │
│     for process in processes:  │
│         process.update(delta)  │
│                                 │
│  4. 공정 간 워크플로우 처리     │
│     - Press 완료 → Welding     │
│     - Welding 완료 → Body      │
│     - Body 완료 → Paint        │
│     - Paint 완료 → Engine      │
│     - Engine 완료 → Windshield │
│                                 │
│  5. 통계 업데이트               │
│     - WIP 계산                 │
│     - 생산량/불량 집계         │
│                                 │
│  6. 히스토리 기록 (5초마다)    │
│                                 │
│  7. 0.05초 대기                │
│                                 │
└─────────────────────────────────┘
    ↓
(계속 반복)
```

---

## 6️⃣ 개별 공정 시뮬레이션

### 공정 상태 머신

```
PressSimulator.update(delta_time) 호출
    ↓
현재 상태 확인
    ↓
┌─ status == IDLE ─────────────┐
│  • 가동률 감소               │
│  • 다음 사이클 대기          │
└──────────────────────────────┘
    ↓
┌─ status == RUNNING ──────────┐
│  1. current_cycle_time += dt│
│  2. progress 계산           │
│     = (current / target) × 100│
│  3. 가동률 증가             │
│  4. 랜덤 경고 체크 (5%)     │
│  5. 완료 체크               │
│     if current >= target:   │
│         status = COMPLETED  │
└──────────────────────────────┘
    ↓
┌─ status == COMPLETED ────────┐
│  • 다음 공정으로 전달        │
│  • 불량 체크 (defect_rate)  │
│  • units_processed++        │
│  • status = IDLE로 리셋     │
└──────────────────────────────┘
```

### 파라미터 기반 계산 (예: Press)

```python
# 사이클 타임 계산
force = params['force']  # 1000톤
speed = params['speed']  # 30회/분
temp = params['temperature']  # 25°C

# 최적값과의 차이로 사이클 타임 결정
cycle_time = 45 × (1000/force) × (30/speed)

# 품질 계산
force_deviation = |force - 1000| / 1000
temp_deviation = |temp - 25| / 25

quality = 98 - (force_deviation + temp_deviation) × 10

# 불량률 계산
defect_rate = max(0, (100 - quality) / 100)
```

---

## 7️⃣ 최적화 실행

사용자가 "최적화 실행" 버튼 클릭 시:

```
handleOptimize() 실행
    ↓
현재 파라미터 수집
    ↓
[프론트엔드] POST /api/optimization/analyze
    {
        objectives: ["balanced"],
        current_params: {...},
        generations: 30,
        population_size: 50
    }
    ↓
[백엔드] run_optimization() 실행
    ↓
GeneticOptimizer 생성
```

### 유전 알고리즘 실행

```
┌─────────────────────────────────┐
│  유전 알고리즘 실행:            │
│                                 │
│  1. 초기 개체군 생성 (50개)    │
│     - 현재 파라미터            │
│     - 랜덤 파라미터 49개       │
│                                 │
│  2. 30세대 진화:               │
│     for gen in range(30):      │
│                                 │
│       a) 적합도 평가           │
│          fitness = quality×0.4 │
│                  + speed×0.3   │
│                  - cost×0.3    │
│                                 │
│       b) 선택 (토너먼트)       │
│          - 3개 중 최고 선택    │
│                                 │
│       c) 교차                  │
│          - 부모 2개 조합       │
│                                 │
│       d) 돌연변이 (10%)        │
│          - 랜덤 변이           │
│                                 │
│       e) 파레토 프론티어 업데이트│
│                                 │
│  3. 최적 개체 반환             │
│                                 │
└─────────────────────────────────┘
    ↓
성능 예측
    - predicted_quality
    - predicted_speed
    - predicted_cost
    ↓
개선율 계산
    - quality_improvement
    - speed_improvement
    - cost_reduction
    ↓
추천사항 생성
    ↓
[백엔드] OptimizationResult 반환
    ↓
[프론트엔드] 최적화 탭 표시
    - 개선율 카드
    - 추천사항 리스트
    - "최적화 적용" 버튼
```

### 적합도 함수

```python
def fitness(params):
    quality = predict_quality(params)
    speed = predict_speed(params)
    cost = predict_cost(params)
    
    # 다목적 최적화
    return quality * 0.4 + speed * 0.3 - cost * 0.3
```

---

## 8️⃣ 3D 시각화 렌더링

### Three.js 렌더링 루프

```
Canvas 컴포넌트 (Three.js)
    ↓
ProductionLineScene 렌더링
    ↓
매 프레임 (60 FPS):
```

### 렌더링 요소

```
┌─────────────────────────────────┐
│  1. 카메라 설정                 │
│     - 위치: [0, 5, 10]         │
│     - 타입: Perspective        │
│                                 │
│  2. 조명 설정                   │
│     - 앰비언트 라이트 (0.5)    │
│     - 디렉셔널 라이트 (1.0)    │
│     - 포인트 라이트 (0.5)      │
│                                 │
│  3. 6개 공정 박스 렌더링        │
│     for each process:          │
│       - 위치 설정              │
│       - 상태별 색상            │
│         • running: 녹색 (#10b981)│
│         • idle: 회색 (#64748b) │
│         • warning: 주황 (#f59e0b)│
│         • error: 빨강 (#ef4444)│
│       - 진행률 텍스트          │
│       - 회전 애니메이션        │
│                                 │
│  4. 연결선 렌더링               │
│     - 공정 간 파란 선          │
│                                 │
│  5. OrbitControls              │
│     - 마우스로 회전/줌/팬      │
│                                 │
└─────────────────────────────────┘
```

### 공정 위치 (X축)

| 공정 | X 좌표 | 라벨 |
|------|--------|------|
| Press | -6.0 | Press |
| Welding | -3.5 | Welding |
| Body Assembly | -1.0 | Body |
| Paint | 1.5 | Paint |
| Engine | 4.0 | Engine |
| Windshield | 6.5 | Windshield |

---

## 📊 전체 데이터 흐름 요약

```
사용자 입력
    ↓
프론트엔드 (React)
    ↓
HTTP 요청 (axios)
    ↓
백엔드 API (FastAPI)
    ↓
시뮬레이션 엔진 (ProductionLineSimulator)
    ↓
개별 공정 시뮬레이터 (PressSimulator 등)
    ↓
상태 계산 (사이클 타임, 품질 등)
    ↓
HTTP 응답
    ↓
프론트엔드 상태 업데이트
    ↓
화면 리렌더링 (3D, 차트, KPI)
    ↓
사용자에게 표시
```

---

## ⚙️ 핵심 기술 요소

### 1. 멀티스레딩
- 백엔드 시뮬레이션이 별도 스레드에서 실행
- 메인 스레드는 API 요청 처리
- `threading.Thread`로 구현

### 2. 폴링 (Polling)
- 프론트엔드가 1초마다 상태 조회
- `setInterval()`로 구현
- 실시간 업데이트 효과

### 3. 상태 머신
- 각 공정이 IDLE → RUNNING → COMPLETED 순환
- 명확한 상태 전환 규칙

### 4. 유전 알고리즘
- 최적화 시 30세대 진화
- 토너먼트 선택, 교차, 돌연변이
- 파레토 프론티어 관리

### 5. 3D 렌더링
- Three.js로 60 FPS 렌더링
- React Three Fiber 통합
- 인터랙티브 컨트롤

### 6. 실시간 차트
- Recharts로 메트릭 시각화
- 라인 차트, 레이더 차트
- 자동 업데이트

---

## 🔧 성능 특성

| 항목 | 값 | 설명 |
|------|-----|------|
| 시뮬레이션 업데이트 | 50ms (20 FPS) | 메인 루프 주기 |
| 상태 폴링 | 1초 | 프론트엔드 업데이트 |
| 3D 렌더링 | 60 FPS | Three.js 목표 |
| 히스토리 기록 | 5초 | 메트릭 저장 주기 |
| 최적화 시간 | 10-30초 | 30세대, 50개체 |

---

## 🚀 실행 체크리스트

### 백엔드
- [ ] Python 가상환경 활성화
- [ ] 의존성 설치 (`pip install -r requirements.txt`)
- [ ] 서버 시작 (`python main.py`)
- [ ] http://localhost:8000 확인

### 프론트엔드
- [ ] Node.js 의존성 설치 (`npm install`)
- [ ] 개발 서버 시작 (`npm run dev`)
- [ ] http://localhost:5173 접속
- [ ] 대시보드 로딩 확인

### 시뮬레이션
- [ ] "시작" 버튼 클릭
- [ ] 3D 뷰에서 공정 진행 확인
- [ ] KPI 실시간 업데이트 확인
- [ ] 최적화 실행 및 결과 확인

---

## 📚 관련 문서

- [README.md](../README.md) - 프로젝트 개요
- [QUICKSTART.md](../QUICKSTART.md) - 빠른 시작 가이드
- [walkthrough.md](../../.gemini/antigravity/brain/0bd497fb-f240-4015-8a9a-2532d92e2c5e/walkthrough.md) - 완성 보고서

---

**작성일**: 2026-01-29  
**버전**: 1.0.0
