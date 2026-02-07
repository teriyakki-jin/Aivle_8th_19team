import { api } from "./client";

export type MlInputDatasetDto = {
  id: number;
  processName: string;
  serviceType?: string | null;
  name: string;
  format: "IMAGE" | "JSON" | "CSV" | "ARFF";
  storageKey: string;
  description?: string | null;
  createdDate?: string | null;
};

export const mlDatasetsApi = {
  list: (processName?: string) => {
    const qs = processName ? `?processName=${encodeURIComponent(processName)}` : "";
    return api.get<MlInputDatasetDto[]>(`/api/v1/ml-datasets${qs}`);
  },
  create: (payload: Omit<MlInputDatasetDto, "id">) =>
    api.post<MlInputDatasetDto>("/api/v1/ml-datasets", payload),
};
