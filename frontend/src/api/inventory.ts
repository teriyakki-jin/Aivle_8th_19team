import { api } from "./client";

export interface InventoryDto {
  inventoryId: number;
  partId: number;
  partName: string;
  currentQty: number;
}

export interface InventoryHistoryDto {
  id: number;
  changeQty: number;
  afterQty: number;
  changeType: string;
  occuredAt: string;
}

export interface InventoryCreateForm {
  partId: number;
  initialQty: number;
}

export interface InventoryAdjustForm {
  partId: number;
  qty: number;
  changeType: string;
}

export const inventoryApi = {
  list: () => api.get<InventoryDto[]>("/api/v1/inventory"),
  get: (partId: number) => api.get<InventoryDto>(`/api/v1/inventory/${partId}`),
  history: (partId: number) => api.get<InventoryHistoryDto[]>(`/api/v1/inventory/${partId}/history`),
  create: (payload: InventoryCreateForm) => api.post<number>("/api/v1/inventory", payload),
  adjust: (payload: InventoryAdjustForm) => api.post<number>("/api/v1/inventory/adjust", payload),
};
