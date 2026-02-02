import { api } from "./client";

export interface VehicleModelDto {
  vehicleModelId: number;
  modelName: string;
  segment: string;
  fuel: string;
}

export interface VehicleModelCreateDto {
  modelName: string;
  segment?: string;
  fuel?: string;
  description?: string;
  isActive?: boolean;
}

export const vehicleModelApi = {
  /** 차량 모델 목록 조회 */
  list: () => api.get<VehicleModelDto[]>("/api/v1/vehicle-model"),

  /** 차량 모델 단건 조회 */
  get: (id: number) => api.get<VehicleModelDto>(`/api/v1/vehicle-model/${id}`),

  /** 차량 모델 생성 */
  create: (data: VehicleModelCreateDto) => api.post<number>("/api/v1/vehicle-model", data),
};
