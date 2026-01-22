// backend/src/routes/paintAnalysis.ts
import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { PaintAnalysisService } from '../services/paintAnalysisService';
import { v4 as uuidv4 } from 'uuid';

export function createPaintAnalysisRouter(pool: Pool) {
  const router = Router();
  const analysisService = new PaintAnalysisService(pool);

  /**
   * POST /api/v1/paint/analysis
   * 분석 결과 저장
   *
   * Body:
   * {
   *   "sessionId": "uuid",
   *   "facilityName": "도장실 A",
   *   "locationCode": "Area-A-001",
   *   "imageFile": FormData File,
   *   "imagePath": "/uploads/image.jpg",
   *   "imageUrl": "http://localhost:8000/images/image.jpg",
   *   "status": "FAIL",
   *   "primaryDefectType": "orange_peel",
   *   "confidence": 92.5,
   *   "modelVersion": "v1.0",
   *   "inferenceTimeMs": 145,
   *   "inspectorId": "user123",
   *   "inspectorName": "김철수",
   *   "defects": [
   *     {
   *       "defectClass": "orange_peel",
   *       "defectNameKo": "주황색 굳음",
   *       "defectNameEn": "Orange Peel",
   *       "confidence": 92.5,
   *       "bbox": { "x1": 100, "y1": 150, "x2": 300, "y2": 350 },
   *       "severityLevel": "HIGH"
   *     }
   *   ]
   * }
   */
  router.post('/analysis', async (req: Request, res: Response) => {
    try {
      const {
        sessionId,
        facilityName,
        locationCode,
        imagePath,
        imageUrl,
        imageFilename,
        status,
        primaryDefectType,
        confidence,
        modelVersion,
        inferenceTimeMs,
        inspectorId,
        inspectorName,
        defects,
      } = req.body;

      // 입력 검증
      if (!sessionId || !facilityName || !status || confidence === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // 세션이 없으면 새로 생성
      let finalSessionId = sessionId;
      if (!sessionId) {
        finalSessionId = await analysisService.createInspectionSession(
          facilityName,
          locationCode
        );
      }

      // 분석 결과 저장
      const resultId = uuidv4();
      await analysisService.saveAnalysisResult({
        resultId,
        sessionId: finalSessionId,
        imageFilename,
        imagePath,
        imageUrl,
        status,
        primaryDefectType,
        confidence,
        modelVersion,
        inferenceTimeMs,
        inspectorId,
        inspectorName,
        defects: defects || [],
      });

      // 일일 통계 업데이트
      await analysisService.updateDailyStatistics(new Date(), facilityName);

      res.json({
        resultId,
        sessionId: finalSessionId,
        status: 'saved',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error saving analysis result:', error);
      res.status(500).json({ error: 'Failed to save analysis result' });
    }
  });

  /**
   * POST /api/v1/paint/session
   * 새 검사 세션 생성
   */
  router.post('/session', async (req: Request, res: Response) => {
    try {
      const { facilityName, locationCode, notes } = req.body;

      if (!facilityName) {
        return res.status(400).json({ error: 'facilityName is required' });
      }

      const sessionId = await analysisService.createInspectionSession(
        facilityName,
        locationCode,
        notes
      );

      res.json({
        sessionId,
        facilityName,
        locationCode,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error creating session:', error);
      res.status(500).json({ error: 'Failed to create session' });
    }
  });

  /**
   * GET /api/v1/paint/results
   * 최근 분석 결과 조회
   *
   * Query Parameters:
   * - days: 조회 기간 (기본값: 7)
   * - limit: 최대 결과 수 (기본값: 50)
   * - facility: 시설명 필터
   */
  router.get('/results', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const limit = parseInt(req.query.limit as string) || 50;
      const facility = req.query.facility as string;

      const results = await analysisService.getRecentResults(days, limit, facility);

      res.json({
        data: results,
        count: results.length,
        query: { days, limit, facility },
      });
    } catch (error) {
      console.error('Error fetching results:', error);
      res.status(500).json({ error: 'Failed to fetch results' });
    }
  });

  /**
   * GET /api/v1/paint/results/:resultId
   * 특정 분석 결과 상세 조회
   */
  router.get('/results/:resultId', async (req: Request, res: Response) => {
    try {
      const { resultId } = req.params;

      const detail = await analysisService.getAnalysisDetail(resultId);

      if (!detail) {
        return res.status(404).json({ error: 'Result not found' });
      }

      res.json(detail);
    } catch (error) {
      console.error('Error fetching result detail:', error);
      res.status(500).json({ error: 'Failed to fetch result detail' });
    }
  });

  /**
   * GET /api/v1/paint/defect-types
   * 결함 유형별 통계
   *
   * Query Parameters:
   * - days: 조회 기간 (기본값: 30)
   */
  router.get('/defect-types', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;

      const summary = await analysisService.getDefectTypeSummary(days);

      res.json({
        data: summary,
        period_days: days,
      });
    } catch (error) {
      console.error('Error fetching defect summary:', error);
      res.status(500).json({ error: 'Failed to fetch defect summary' });
    }
  });

  /**
   * GET /api/v1/paint/daily-stats
   * 일일 통계 조회
   *
   * Query Parameters:
   * - startDate: YYYY-MM-DD
   * - endDate: YYYY-MM-DD
   * - facility: 시설명 필터
   */
  router.get('/daily-stats', async (req: Request, res: Response) => {
    try {
      const { startDate, endDate, facility } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'startDate and endDate are required (YYYY-MM-DD format)',
        });
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ error: 'Invalid date format' });
      }

      const stats = await analysisService.getDailyStatistics(
        start,
        end,
        facility as string
      );

      res.json({
        data: stats,
        period: { startDate, endDate },
        facility,
      });
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      res.status(500).json({ error: 'Failed to fetch daily statistics' });
    }
  });

  /**
   * GET /api/v1/paint/today-stats
   * 오늘 통계 조회
   */
  router.get('/today-stats', async (req: Request, res: Response) => {
    try {
      const facility = req.query.facility as string;
      const stats = await analysisService.getTodayStatistics(facility);

      res.json(stats);
    } catch (error) {
      console.error('Error fetching today stats:', error);
      res.status(500).json({ error: 'Failed to fetch today statistics' });
    }
  });

  /**
   * POST /api/v1/paint/recalculate-daily-stats
   * 특정 날짜의 통계 재계산 (관리자용)
   */
  router.post('/recalculate-daily-stats', async (req: Request, res: Response) => {
    try {
      const { date, facility } = req.body;

      if (!date) {
        return res.status(400).json({ error: 'date is required' });
      }

      const statDate = new Date(date);
      await analysisService.updateDailyStatistics(statDate, facility);

      res.json({
        message: 'Daily statistics recalculated',
        date,
        facility,
      });
    } catch (error) {
      console.error('Error recalculating stats:', error);
      res.status(500).json({ error: 'Failed to recalculate statistics' });
    }
  });

  return router;
}
