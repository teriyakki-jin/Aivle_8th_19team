import { api } from "./client";

export interface MLAnalysisResultDto {
  id: number;
  serviceType: string;
  status: string;
  prediction?: number | null;
  confidence?: number | null;
  reconstructionError?: number | null;
  threshold?: number | null;
  isAnomaly?: number | null;
  originalImageUrl?: string | null;
  resultImageUrl?: string | null;
  additionalInfo?: string | null;
  inferenceTimeMs?: number | null;
  target?: string | null;
  message?: string | null;
  orderId?: number | null;
  productionId?: number | null;
  processExecutionId?: number | null;
  processName?: string | null;
  createdDate?: string | null;
  lastModifiedDate?: string | null;
}

export const mlResultsApi = {
  list: (params: {
    orderId?: number;
    processName?: string;
    serviceType?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params.orderId !== undefined) qs.set("orderId", String(params.orderId));
    if (params.processName) qs.set("process", params.processName);
    if (params.serviceType) qs.set("serviceType", params.serviceType);
    if (params.limit !== undefined) qs.set("limit", String(params.limit));
    const query = qs.toString();
    const path = query ? `/api/v1/ml-results?${query}` : "/api/v1/ml-results";
    return api.get<MLAnalysisResultDto[]>(path);
  },
};
