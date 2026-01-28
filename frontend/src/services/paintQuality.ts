
import http from './http';
import type { ApiResponse, PaintQualityData } from '@/types/paintQuality';

export async function fetchLatestPaintQuality(): Promise<PaintQualityData> {
  const res = await http.get<ApiResponse<PaintQualityData>>('/api/v1/paint-quality/latest');
  if (res.data.status !== 'success' || !res.data.data) {
    throw new Error(res.data.message || 'API error');
  }
  return res.data.data;
}
