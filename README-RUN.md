# 프로젝트 실행 가이드

## 빠른 시작

### Windows

#### 모든 서비스 시작
```bash
start.bat
```

이 명령은 다음을 수행합니다:
- 프론트엔드 (Vite) → http://localhost:3000
- 백엔드 (Spring Boot) → http://localhost:3001

각 서비스는 별도의 CMD 창에서 실행됩니다.

#### 모든 서비스 중지
```bash
stop.bat
```

### Linux/Mac

#### 프론트엔드 시작
```bash
cd frontend
npm run dev
```

#### 백엔드 시작 (새 터미널)
```bash
cd backend
./gradlew bootRun
```

## 개별 서비스 실행

### 프론트엔드만 실행
```bash
cd frontend
npm run dev
```

### 백엔드만 실행
```bash
cd backend
./gradlew bootRun
# 또는
./gradlew bootRun --no-daemon
```

### ML 서비스 (선택사항)
```bash
cd ml-service
python main.py
```

## 포트 정보

- **프론트엔드**: 3000
- **백엔드**: 3001
- **ML 서비스**: 8000
- **PostgreSQL**: 5432

## 문제 해결

### 프론트엔드가 시작되지 않을 때

```bash
cd frontend
rm -rf node_modules
rm package-lock.json
npm cache clean --force
npm install
npm run dev
```

### 포트가 이미 사용 중일 때

**Windows:**
```bash
# 포트 3000 프로세스 종료
netstat -ano | findstr :3000
taskkill /F /PID [PID번호]

# 포트 3001 프로세스 종료
netstat -ano | findstr :3001
taskkill /F /PID [PID번호]
```

**Linux/Mac:**
```bash
# 포트 3000 프로세스 종료
lsof -ti:3000 | xargs kill -9

# 포트 3001 프로세스 종료
lsof -ti:3001 | xargs kill -9
```

### PostgreSQL 연결 실패 시

1. PostgreSQL 서비스가 실행 중인지 확인
2. `backend/src/main/resources/application.properties`에서 DB 설정 확인
3. 데이터베이스 `automobile_risk`가 생성되어 있는지 확인

```sql
-- PostgreSQL에서 데이터베이스 생성
CREATE DATABASE automobile_risk;
```

## 빌드

### 프론트엔드 빌드
```bash
cd frontend
npm run build
```
빌드 결과: `frontend/build/`

### 백엔드 빌드
```bash
cd backend
./gradlew build
```
빌드 결과: `backend/build/libs/automobile-risk-0.0.1-SNAPSHOT.jar`
