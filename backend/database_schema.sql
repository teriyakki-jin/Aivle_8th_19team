-- PostgreSQL Schema for Paint Quality Defect Analysis
-- 도장 결함 이미지 분석 결과 저장소

-- 1. 검사 세션 테이블 (분석 배치/세션 기록)
CREATE TABLE IF NOT EXISTS inspection_sessions (
    id SERIAL PRIMARY KEY,
    session_id UUID UNIQUE NOT NULL,
    facility_name VARCHAR(255) NOT NULL,      -- 시설명 (e.g., "도장실 A")
    location_code VARCHAR(50),                  -- 구역 코드 (e.g., "Area-A-001")
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

-- 2. 이미지 분석 결과 메인 테이블
CREATE TABLE IF NOT EXISTS paint_analysis_results (
    id SERIAL PRIMARY KEY,
    result_id UUID UNIQUE NOT NULL,
    session_id UUID NOT NULL,                   -- 검사 세션 참조
    
    -- 이미지 정보
    image_filename VARCHAR(255) NOT NULL,
    image_path VARCHAR(500),                    -- 저장 경로
    image_url VARCHAR(500),                     -- 웹 서빙 URL
    image_size_kb INTEGER,
    
    -- 분석 결과
    status VARCHAR(50) NOT NULL,                -- 'PASS', 'FAIL', 'WARNING'
    primary_defect_type VARCHAR(100),           -- 주 결함 유형 (orange_peel, runs_sags, etc.)
    confidence DECIMAL(5, 2),                   -- 신뢰도 0~100
    
    -- 메타데이터
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    model_version VARCHAR(50),                  -- 사용한 모델 버전
    inference_time_ms INTEGER,                  -- 추론 소요 시간(ms)
    
    -- 검사자 정보
    inspector_id VARCHAR(50),
    inspector_name VARCHAR(100),
    
    FOREIGN KEY (session_id) REFERENCES inspection_sessions(session_id),
    INDEX idx_session_id (session_id),
    INDEX idx_analyzed_at (analyzed_at),
    INDEX idx_status (status)
);

-- 3. 탐지된 결함 상세 테이블 (다중 결함 지원)
CREATE TABLE IF NOT EXISTS detected_defects (
    id SERIAL PRIMARY KEY,
    result_id UUID NOT NULL,                    -- paint_analysis_results 참조
    
    -- 결함 정보
    defect_class VARCHAR(100) NOT NULL,         -- 결함 유형 클래스
    defect_name_ko VARCHAR(100),                -- 한글명 (주황색 굳음, 흘리고 내림 등)
    defect_name_en VARCHAR(100),
    
    -- 탐지 품질
    confidence DECIMAL(5, 2),                   -- 해당 결함의 신뢰도
    bbox_x1 INTEGER,                            -- 바운딩박스 좌표
    bbox_y1 INTEGER,
    bbox_x2 INTEGER,
    bbox_y2 INTEGER,
    bbox_area INTEGER,                          -- 결함 영역 크기(픽셀)
    
    -- 심각도 (선택사항)
    severity_level VARCHAR(20),                 -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (result_id) REFERENCES paint_analysis_results(result_id),
    INDEX idx_result_id (result_id),
    INDEX idx_defect_class (defect_class)
);

-- 4. 일일 통계 테이블 (집계용)
CREATE TABLE IF NOT EXISTS daily_statistics (
    id SERIAL PRIMARY KEY,
    stat_date DATE UNIQUE NOT NULL,
    facility_name VARCHAR(255),
    
    -- 검사 통계
    total_inspections INTEGER DEFAULT 0,
    passed_inspections INTEGER DEFAULT 0,
    failed_inspections INTEGER DEFAULT 0,
    warning_inspections INTEGER DEFAULT 0,
    
    -- 결함 통계
    defect_count INTEGER DEFAULT 0,
    defect_rate DECIMAL(5, 2),                  -- 결함률 (%)
    
    -- 결함 유형별 집계
    defect_orange_peel INTEGER DEFAULT 0,
    defect_runs_sags INTEGER DEFAULT 0,
    defect_solvent_pop INTEGER DEFAULT 0,
    defect_water_spotting INTEGER DEFAULT 0,
    
    -- 신뢰도 통계
    avg_confidence DECIMAL(5, 2),
    min_confidence DECIMAL(5, 2),
    max_confidence DECIMAL(5, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_stat_date (stat_date),
    INDEX idx_facility_name (facility_name)
);

-- 5. 시간대별 통계 (추세 분석용)
CREATE TABLE IF NOT EXISTS hourly_statistics (
    id SERIAL PRIMARY KEY,
    stat_time TIMESTAMP NOT NULL,               -- 시간 (예: 2024-01-22 14:00:00)
    facility_name VARCHAR(255),
    
    inspection_count INTEGER DEFAULT 0,
    defect_count INTEGER DEFAULT 0,
    defect_rate DECIMAL(5, 2),
    avg_confidence DECIMAL(5, 2),
    
    INDEX idx_stat_time (stat_time),
    INDEX idx_facility_name (facility_name)
);

-- 6. 품질 트렌드 테이블 (장기 추세 분석)
CREATE TABLE IF NOT EXISTS quality_trends (
    id SERIAL PRIMARY KEY,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    facility_name VARCHAR(255),
    
    -- 개선도
    defect_rate_change DECIMAL(5, 2),           -- 이전 기간 대비 변화율
    trend_direction VARCHAR(20),                -- 'UP', 'DOWN', 'STABLE'
    
    -- 상세
    total_inspections INTEGER,
    total_defects INTEGER,
    avg_defect_rate DECIMAL(5, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_paint_result_created_at ON paint_analysis_results(created_at DESC);
CREATE INDEX idx_detected_defect_severity ON detected_defects(severity_level);
CREATE INDEX idx_daily_stats_date_facility ON daily_statistics(stat_date, facility_name);

-- 뷰 생성: 최근 검사 결과 요약
CREATE OR REPLACE VIEW recent_inspection_summary AS
SELECT 
    p.result_id,
    p.status,
    p.primary_defect_type,
    p.confidence,
    p.analyzed_at,
    s.location_code,
    COUNT(d.id) as defect_count
FROM paint_analysis_results p
LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
LEFT JOIN detected_defects d ON p.result_id = d.result_id
WHERE p.analyzed_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.result_id, p.status, p.primary_defect_type, p.confidence, 
         p.analyzed_at, s.location_code
ORDER BY p.analyzed_at DESC;

-- 뷰 생성: 결함 유형별 집계
CREATE OR REPLACE VIEW defect_type_summary AS
SELECT 
    dd.defect_class,
    dd.defect_name_ko,
    COUNT(*) as occurrence_count,
    ROUND(AVG(dd.confidence), 2) as avg_confidence,
    COUNT(CASE WHEN dd.severity_level = 'HIGH' OR dd.severity_level = 'CRITICAL' THEN 1 END) as critical_count,
    MAX(dd.detected_at) as last_detected_at
FROM detected_defects dd
WHERE dd.detected_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY dd.defect_class, dd.defect_name_ko
ORDER BY occurrence_count DESC;
