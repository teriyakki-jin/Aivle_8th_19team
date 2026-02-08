import { api } from "./client";

export type ProcessExecutionDto = {
  processExecutionId: number;
  startDate?: string;
  endDate?: string;
  executionOrder?: number;
  unitIndex?: number;
  status?: "READY" | "IN_PROGRESS" | "COMPLETED" | "STOPPED";
};

export const processExecutionApi = {
  listByProduction: (productionId: number | string) =>
    api.get<ProcessExecutionDto[]>(`/api/v1/process-execution/production/${productionId}`),
};
