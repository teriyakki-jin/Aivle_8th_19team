import { api } from "./client";

export type ProductionDto = {
  productionId: number;
  startDate?: string;
  endDate?: string;
  productionStatus?: string;
  plannedQty?: number;
  vehicleModelId?: number;
  vehicleModelName?: string;
  orderId?: number;
  orderQty?: number;
  dueDate?: string;
};

export type ProductionCompletePayload = {
  endDate: string;
  serialNumbers: string[];
};

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export const productionApi = {
  list: (page = 0, size = 1000) =>
    api.get<PageResponse<ProductionDto>>(`/api/v1/production?page=${page}&size=${size}&sort=id,desc`),
  create: (payload: any) => api.post<ProductionDto>("/api/v1/production", payload),
  start: (id: string | number) => api.patch(`/api/v1/production/${id}/start`),
  stop: (id: string | number) => api.patch(`/api/v1/production/${id}/stop`),
  restart: (id: string | number) => api.patch(`/api/v1/production/${id}/restart`),
  complete: (id: string | number, payload: ProductionCompletePayload) =>
    api.patch(`/api/v1/production/${id}/complete`, payload),
  cancel: (id: string | number) => api.patch(`/api/v1/production/${id}/cancel`),
  patch: (id: string | number, payload: any) => api.patch(`/api/v1/production/${id}`, payload),
};
