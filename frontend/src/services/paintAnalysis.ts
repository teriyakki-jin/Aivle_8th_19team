// frontend/src/services/paintAnalysis.ts
import http from './http';

export interface PaintStatistics {
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  warningInspections: number;
  defectCount: number;
  defectRate: number;
  passRate: number;
  avgConfidence: number;
}

export interface DefectDetail {
  defectClass: string;
  defectNameKo: string;
  confidence: number;
  severityLevel: string;
}

export interface AnalysisHistory {
  id: number;
  resultId: string;
  imageFilename: string;
  imageUrl: string;
  resultImageUrl: string;
  status: string;
  primaryDefectType?: string;
  confidence: number;
  analyzedAt: string;
  locationCode?: string;
  detectedDefects: DefectDetail[];
}

export interface AnalysisDetail extends AnalysisHistory {
  imageSizeKb: number;
  modelVersion: string;
  inferenceTimeMs: number;
}

export interface DefectTypeSummary {
  defectClass: string;
  defectNameKo: string;
  occurrenceCount: number;
  avgConfidence: number;
  criticalCount: number;
}

export interface RecentAnalysisResult {
  resultId: string;
  status: string;
  primaryDefectType?: string;
  confidence: number;
  analyzedAt: string;
  locationCode?: string;
  defectCount: number;
}

export interface DailyStatistic {
  statDate: string;
  facilityName?: string;
  totalInspections: number;
  passedInspections: number;
  failedInspections: number;
  defectCount: number;
  defectRate: number;
}

// 오늘 통계 가져오기 (백엔드 API 연동)
export async function getTodayStatistics(): Promise<PaintStatistics> {
  try {
    const response = await http.get('/api/paint-analysis/statistics/today');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch today statistics:', error);
    // 실패 시 기본값 반환
    return {
      totalInspections: 0,
      passedInspections: 0,
      failedInspections: 0,
      warningInspections: 0,
      defectCount: 0,
      defectRate: 0,
      passRate: 0,
      avgConfidence: 0,
    };
  }
}

// 전체 분석 이력 가져오기
export async function getAnalysisHistory(): Promise<AnalysisHistory[]> {
  try {
    const response = await http.get('/api/paint-analysis/history');
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analysis history:', error);
    return [];
  }
}

// 특정 분석 결과 상세 조회
export async function getAnalysisDetail(resultId: string): Promise<AnalysisDetail | null> {
  try {
    const response = await http.get(`/api/paint-analysis/detail/${resultId}`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch analysis detail:', error);
    return null;
  }
}
