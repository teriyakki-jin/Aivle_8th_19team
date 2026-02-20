import { api } from "./client";

export type OrderDto = Record<string, any>;

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
  first: boolean;
  last: boolean;
}

export const orderApi = {
  list: (page = 0, size = 10) => api.get<PageResponse<OrderDto>>(`/api/v1/order?page=${page}&size=${size}&sort=id,asc`),
  listAll: () => api.get<PageResponse<OrderDto>>("/api/v1/order?page=0&size=1000&sort=id,asc"),
  create: (payload: any) => api.post<OrderDto>("/api/v1/order", payload),
  complete: (id: string | number) => api.patch(`/api/v1/order/${id}/complete`),
  cancel: (id: string | number) => api.patch(`/api/v1/order/${id}/cancel`),
  patch: (id: string | number, payload: any) => api.patch(`/api/v1/order/${id}`, payload),
};
