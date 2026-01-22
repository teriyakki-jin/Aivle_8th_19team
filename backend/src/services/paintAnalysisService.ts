// backend/src/services/paintAnalysisService.ts
import { Pool, PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export interface AnalysisResult {
  resultId: string;
  sessionId: string;
  imageFilename: string;
  imagePath: string;
  imageUrl: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  primaryDefectType?: string;
  confidence: number;
  modelVersion: string;
  inferenceTimeMs: number;
  inspectorId?: string;
  inspectorName?: string;
  defects: DetectedDefect[];
}

export interface DetectedDefect {
  defectClass: string;
  defectNameKo: string;
  defectNameEn?: string;
  confidence: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  severityLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export class PaintAnalysisService {
  constructor(private pool: Pool) {}

  /**
   * 검사 세션 생성
   */
  async createInspectionSession(
    facilityName: string,
    locationCode?: string,
    notes?: string
  ): Promise<string> {
    const sessionId = uuidv4();
    const query = `
      INSERT INTO inspection_sessions (session_id, facility_name, location_code, notes)
      VALUES ($1, $2, $3, $4)
      RETURNING session_id;
    `;
    
    const result = await this.pool.query(query, [
      sessionId,
      facilityName,
      locationCode || null,
      notes || null,
    ]);
    
    return result.rows[0].session_id;
  }

  /**
   * 분석 결과 저장 (메인 + 결함 상세)
   */
  async saveAnalysisResult(data: AnalysisResult): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // 1. 메인 분석 결과 저장
      const insertMainQuery = `
        INSERT INTO paint_analysis_results (
          result_id, session_id, image_filename, image_path, image_url,
          status, primary_defect_type, confidence, model_version,
          inference_time_ms, inspector_id, inspector_name
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);
      `;

      await client.query(insertMainQuery, [
        data.resultId,
        data.sessionId,
        data.imageFilename,
        data.imagePath,
        data.imageUrl,
        data.status,
        data.primaryDefectType || null,
        data.confidence,
        data.modelVersion,
        data.inferenceTimeMs,
        data.inspectorId || null,
        data.inspectorName || null,
      ]);

      // 2. 탐지된 결함들 저장 (다중 결함)
      if (data.defects && data.defects.length > 0) {
        const insertDefectsQuery = `
          INSERT INTO detected_defects (
            result_id, defect_class, defect_name_ko, defect_name_en,
            confidence, bbox_x1, bbox_y1, bbox_x2, bbox_y2, bbox_area,
            severity_level
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11);
        `;

        for (const defect of data.defects) {
          const bbox = defect.bbox;
          const bboxArea = (bbox.x2 - bbox.x1) * (bbox.y2 - bbox.y1);

          await client.query(insertDefectsQuery, [
            data.resultId,
            defect.defectClass,
            defect.defectNameKo,
            defect.defectNameEn || null,
            defect.confidence,
            bbox.x1,
            bbox.y1,
            bbox.x2,
            bbox.y2,
            bboxArea,
            defect.severityLevel || null,
          ]);
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 최근 분석 결과 조회
   */
  async getRecentResults(
    days: number = 7,
    limit: number = 50,
    facilityName?: string
  ): Promise<any[]> {
    let query = `
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
      WHERE p.analyzed_at >= CURRENT_DATE - INTERVAL '${days} days'
    `;

    const params: any[] = [];

    if (facilityName) {
      query += ` AND s.facility_name = $${params.length + 1}`;
      params.push(facilityName);
    }

    query += `
      GROUP BY p.result_id, p.status, p.primary_defect_type, p.confidence, 
               p.analyzed_at, s.location_code
      ORDER BY p.analyzed_at DESC
      LIMIT $${params.length + 1};
    `;

    params.push(limit);

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * 일일 통계 계산 및 업데이트
   */
  async updateDailyStatistics(date: Date, facilityName?: string): Promise<void> {
    const statDate = date.toISOString().split('T')[0];
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 기존 기록 확인
      const checkQuery = `
        SELECT id FROM daily_statistics
        WHERE stat_date = $1 AND (facility_name = $2 OR ($2 IS NULL AND facility_name IS NULL));
      `;

      const existing = await client.query(checkQuery, [statDate, facilityName]);

      let query: string;
      let params: any[];

      if (existing.rows.length > 0) {
        // UPDATE
        query = `
          UPDATE daily_statistics SET
            total_inspections = (
              SELECT COUNT(*) FROM paint_analysis_results p
              LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
              WHERE DATE(p.analyzed_at) = $1 AND (s.facility_name = $2 OR $2 IS NULL)
            ),
            passed_inspections = (
              SELECT COUNT(*) FROM paint_analysis_results p
              LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
              WHERE DATE(p.analyzed_at) = $1 AND p.status = 'PASS' AND (s.facility_name = $2 OR $2 IS NULL)
            ),
            failed_inspections = (
              SELECT COUNT(*) FROM paint_analysis_results p
              LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
              WHERE DATE(p.analyzed_at) = $1 AND p.status = 'FAIL' AND (s.facility_name = $2 OR $2 IS NULL)
            ),
            defect_count = (
              SELECT COUNT(*) FROM detected_defects d
              LEFT JOIN paint_analysis_results p ON d.result_id = p.result_id
              LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
              WHERE DATE(p.analyzed_at) = $1 AND (s.facility_name = $2 OR $2 IS NULL)
            ),
            updated_at = CURRENT_TIMESTAMP
          WHERE stat_date = $1 AND (facility_name = $2 OR ($2 IS NULL AND facility_name IS NULL));
        `;
        params = [statDate, facilityName];
      } else {
        // INSERT
        query = `
          INSERT INTO daily_statistics (
            stat_date, facility_name, total_inspections, passed_inspections,
            failed_inspections, defect_count
          )
          SELECT
            $1::DATE,
            $2,
            COUNT(DISTINCT p.result_id) as total,
            COUNT(DISTINCT CASE WHEN p.status = 'PASS' THEN p.result_id END) as passed,
            COUNT(DISTINCT CASE WHEN p.status = 'FAIL' THEN p.result_id END) as failed,
            COUNT(d.id) as defects
          FROM paint_analysis_results p
          LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
          LEFT JOIN detected_defects d ON p.result_id = d.result_id
          WHERE DATE(p.analyzed_at) = $1 AND (s.facility_name = $2 OR $2 IS NULL);
        `;
        params = [statDate, facilityName];
      }

      await client.query(query, params);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 결함 유형별 통계 조회
   */
  async getDefectTypeSummary(days: number = 30): Promise<any[]> {
    const query = `
      SELECT 
        dd.defect_class,
        dd.defect_name_ko,
        COUNT(*) as occurrence_count,
        ROUND(AVG(dd.confidence)::NUMERIC, 2) as avg_confidence,
        COUNT(CASE WHEN dd.severity_level = 'HIGH' OR dd.severity_level = 'CRITICAL' THEN 1 END) as critical_count,
        MAX(dd.detected_at) as last_detected_at
      FROM detected_defects dd
      WHERE dd.detected_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY dd.defect_class, dd.defect_name_ko
      ORDER BY occurrence_count DESC;
    `;

    const result = await this.pool.query(query);
    return result.rows;
  }

  /**
   * 일일 통계 조회
   */
  async getDailyStatistics(
    startDate: Date,
    endDate: Date,
    facilityName?: string
  ): Promise<any[]> {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    let query = `
      SELECT * FROM daily_statistics
      WHERE stat_date BETWEEN $1 AND $2
    `;

    const params: any[] = [start, end];

    if (facilityName) {
      query += ` AND facility_name = $${params.length + 1}`;
      params.push(facilityName);
    }

    query += ` ORDER BY stat_date ASC;`;

    const result = await this.pool.query(query, params);
    return result.rows;
  }

  /**
   * 특정 검사 결과 상세 조회
   */
  async getAnalysisDetail(resultId: string): Promise<any> {
    const mainQuery = `
      SELECT * FROM paint_analysis_results
      WHERE result_id = $1;
    `;

    const defectsQuery = `
      SELECT * FROM detected_defects
      WHERE result_id = $1
      ORDER BY confidence DESC;
    `;

    const [mainResult, defectsResult] = await Promise.all([
      this.pool.query(mainQuery, [resultId]),
      this.pool.query(defectsQuery, [resultId]),
    ]);

    if (mainResult.rows.length === 0) {
      return null;
    }

    return {
      ...mainResult.rows[0],
      defects: defectsResult.rows,
    };
  }

  /**
   * 오늘 통계 조회
   */
  async getTodayStatistics(facilityName?: string): Promise<any> {
    let query = `
      SELECT 
        COUNT(DISTINCT p.result_id) as total_inspections,
        COUNT(DISTINCT CASE WHEN p.status = 'PASS' THEN p.result_id END) as passed_inspections,
        COUNT(DISTINCT CASE WHEN p.status = 'FAIL' THEN p.result_id END) as failed_inspections,
        COUNT(DISTINCT CASE WHEN p.status = 'WARNING' THEN p.result_id END) as warning_inspections,
        COUNT(d.id) as defect_count,
        ROUND(AVG(p.confidence)::NUMERIC, 2) as avg_confidence
      FROM paint_analysis_results p
      LEFT JOIN inspection_sessions s ON p.session_id = s.session_id
      LEFT JOIN detected_defects d ON p.result_id = d.result_id
      WHERE DATE(p.analyzed_at) = CURRENT_DATE
    `;

    const params: any[] = [];

    if (facilityName) {
      query += ` AND s.facility_name = $${params.length + 1}`;
      params.push(facilityName);
    }

    const result = await this.pool.query(query, params);
    const row = result.rows[0];

    const totalInspections = parseInt(row.total_inspections) || 0;
    const passedInspections = parseInt(row.passed_inspections) || 0;
    const failedInspections = parseInt(row.failed_inspections) || 0;
    const warningInspections = parseInt(row.warning_inspections) || 0;
    const defectCount = parseInt(row.defect_count) || 0;

    const defectRate = totalInspections > 0 
      ? ((failedInspections / totalInspections) * 100).toFixed(1)
      : '0.0';

    const passRate = totalInspections > 0
      ? ((passedInspections / totalInspections) * 100).toFixed(1)
      : '0.0';

    return {
      totalInspections,
      passedInspections,
      failedInspections,
      warningInspections,
      defectCount,
      defectRate: parseFloat(defectRate),
      passRate: parseFloat(passRate),
      avgConfidence: parseFloat(row.avg_confidence) || 0,
    };
  }
}
